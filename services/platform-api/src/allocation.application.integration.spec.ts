import { afterEach, describe, expect, it } from 'vitest'

import type { CatalogAllocationArtifactQuery } from './boundaries/catalog-allocation-artifact-query.js'
import type { Clock } from './boundaries/clock.js'
import type { IdGenerator } from './boundaries/id-generator.js'
import type { SessionAllocationCommand } from './boundaries/session-allocation-orchestrator.js'
import { createCatalogDatabase, createCatalogPool, migrateCatalogDatabase, seedCatalogReferenceDataWithClient } from './modules/catalog/infrastructure/persistence/catalog.persistence.js'
import { AllocationProviderError } from './modules/allocations/application/allocations.errors.js'
import type { AllocationRepository, GameServerAllocator, GameServerAllocatorRegistry } from './modules/allocations/application/allocations.ports.js'
import { AllocationsService } from './modules/allocations/application/allocations.service.js'
import { createAllocationsDatabase } from './modules/allocations/infrastructure/persistence/allocation.persistence.js'
import { PostgresAllocationRepository } from './modules/allocations/infrastructure/persistence/repositories/postgres-allocation.repository.js'
import { PostgresSessionRepository } from './modules/sessions/infrastructure/persistence/repositories/postgres-session.repository.js'
import { createSessionsDatabase } from './modules/sessions/infrastructure/persistence/session.persistence.js'
import { createIsolatedPostgresDatabase } from './testing/isolated-postgres-database.js'

const baseConnectionString = process.env.POSTGRES_URL

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for allocation integration tests.')
}

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    if (cleanup) {
      await cleanup()
    }
  }
})

describe('allocation application integration', () => {
  it('keeps concurrent requestAllocation(sessionId) idempotent with one active row and one provider allocate call', async () => {
    const harness = await createHarness()
    cleanups.push(harness.cleanup)

    await harness.seedSession()

    const [left, right] = await Promise.all([
      harness.service.requestAllocation(buildCommand()),
      harness.service.requestAllocation(buildCommand()),
    ])

    expect(left.allocationId).toBe(right.allocationId)
    expect(harness.provider.allocateCalls).toBe(1)
    expect(await harness.repository.getActiveBySessionId('session-1')).toMatchObject({ status: 'ready' })
  }, 15_000)

  it('marks the allocation failed on provider failure without fabricating connection data', async () => {
    const harness = await createHarness({ providerError: new AllocationProviderError('ALLOCATION_PROVIDER_UNAVAILABLE', 'provider unavailable') })
    cleanups.push(harness.cleanup)

    await harness.seedSession()

    await expect(harness.service.requestAllocation(buildCommand())).rejects.toMatchObject({ code: 'ALLOCATION_FAILED' })
    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({
      status: 'failed',
      failureCode: 'ALLOCATION_PROVIDER_UNAVAILABLE',
      connection: null,
    })
  }, 15_000)

  it('recovers a provisioning allocation after a one-shot persistence failure following provider success', async () => {
    const harness = await createHarness({ failReadyUpdateOnce: true })
    cleanups.push(harness.cleanup)

    await harness.seedSession()

    await expect(harness.service.requestAllocation(buildCommand())).rejects.toMatchObject({ code: 'ALLOCATION_UNAVAILABLE' })
    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({ status: 'provisioning' })

    const recovered = await harness.service.requestAllocation(buildCommand())
    expect(recovered).toMatchObject({ allocationId: 'allocation-1', status: 'ready' })
    expect(harness.provider.allocateCalls).toBe(1)
    expect(harness.provider.getCalls).toBe(1)
  }, 15_000)

  it('keeps release retryable when provider release fails', async () => {
    const harness = await createHarness({ releaseError: new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'release failed') })
    cleanups.push(harness.cleanup)

    await harness.seedSession()
    await harness.service.requestAllocation(buildCommand())

    await expect(harness.service.releaseAllocation('session-1')).rejects.toMatchObject({ code: 'ALLOCATION_FAILED' })
    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({ status: 'releasing' })
  }, 15_000)
})

async function createHarness(options: { providerError?: Error; releaseError?: Error; failReadyUpdateOnce?: boolean } = {}) {
  const database = await createIsolatedPostgresDatabase(baseConnectionString as string, 'allocation_app_test')
  const pool = createCatalogPool(database.connectionString)
  await migrateCatalogDatabase(database.connectionString)
  await seedCatalogReferenceDataWithClient(createCatalogDatabase(pool))

  const sessionRepository = new PostgresSessionRepository(createSessionsDatabase(pool))
  const baseRepository = new PostgresAllocationRepository(createAllocationsDatabase(pool))
  const repository = options.failReadyUpdateOnce ? new FailingReadyUpdateAllocationRepository(baseRepository) : baseRepository

  const provider = new CountingReadyAllocator(options.providerError, options.releaseError)
  const registry: GameServerAllocatorRegistry = {
    get() {
      return provider
    },
  }
  const catalogQuery: CatalogAllocationArtifactQuery = {
    async getGameServerArtifact() {
      return {
        gameId: 'signal-grid',
        gameVersion: '0.1.0-prototype',
        protocolVersion: 'v1',
        buildVersion: 'prototype',
        serverType: 'dedicated',
        runtimeType: 'external',
      }
    },
  }
  const clock: Clock = {
    now: () => new Date('2026-10-01T10:00:00.000Z'),
  }
  let nextId = 0
  const idGenerator: IdGenerator = {
    nextId: () => {
      nextId += 1
      return `allocation-${nextId}`
    },
  }

  return {
    repository: baseRepository,
    provider,
    service: new AllocationsService(repository, registry, 'test', catalogQuery, clock, idGenerator),
    seedSession: async () => {
      await sessionRepository.withTransaction(async (transaction) => {
        await transaction.createSession({
          sessionId: 'session-1',
          sourceKind: 'matchmaking',
          matchId: 'match-1',
          proposalId: 'proposal-1',
          gameId: 'signal-grid',
          queueType: 'quick-play',
          platform: 'web',
          region: null,
          gameVersion: '0.1.0-prototype',
          protocolVersion: 'v1',
          status: 'created',
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
          startedAt: null,
          completedAt: null,
          failedAt: null,
          cancelledAt: null,
          expiresAt: '2026-10-01T10:15:00.000Z',
          failureCode: null,
          participants: [
            {
              sessionId: 'session-1',
              playerId: 'player-1',
              sourceRequestId: 'request-1',
              sourceLobbyId: null,
              joinedAt: '2026-10-01T10:00:00.000Z',
            },
          ],
        })
      })
    },
    cleanup: async () => {
      await pool.end()
      await database.cleanup()
    },
  }
}

class FailingReadyUpdateAllocationRepository implements AllocationRepository {
  private failed = false

  constructor(private readonly inner: AllocationRepository) {}

  getById(allocationId: string) {
    return this.inner.getById(allocationId)
  }

  getLatestBySessionId(sessionId: string) {
    return this.inner.getLatestBySessionId(sessionId)
  }

  getActiveBySessionId(sessionId: string) {
    return this.inner.getActiveBySessionId(sessionId)
  }

  async withTransaction<T>(callback: Parameters<AllocationRepository['withTransaction']>[0]): Promise<T> {
    return this.inner.withTransaction(async (transaction) =>
      callback({
        getById: async (allocationId) => transaction.getById(allocationId),
        getByIdForUpdate: async (allocationId) => transaction.getByIdForUpdate(allocationId),
        getLatestBySessionId: async (sessionId) => transaction.getLatestBySessionId(sessionId),
        getActiveBySessionId: async (sessionId) => transaction.getActiveBySessionId(sessionId),
        getActiveBySessionIdForUpdate: async (sessionId) => transaction.getActiveBySessionIdForUpdate(sessionId),
        createAllocation: async (input) => transaction.createAllocation(input),
        updateAllocation: async (allocation) => {
          if (!this.failed && allocation.status === 'ready') {
            this.failed = true
            throw new Error('one-shot ready update failure')
          }

          await transaction.updateAllocation(allocation)
        },
      }),
    )
  }
}

class CountingReadyAllocator implements GameServerAllocator {
  readonly results = new Map<string, Awaited<ReturnType<GameServerAllocator['allocate']>>>()
  allocateCalls = 0
  getCalls = 0

  constructor(private readonly providerError?: Error, private readonly releaseError?: Error) {}

  async allocate(request: Parameters<GameServerAllocator['allocate']>[0]): Promise<Awaited<ReturnType<GameServerAllocator['allocate']>>> {
    this.allocateCalls += 1
    await Promise.resolve()

    if (this.providerError) {
      throw this.providerError
    }

    const existing = this.results.get(request.allocationId)
    if (existing) {
      return existing
    }

    const created = {
      providerReference: `provider-${request.allocationId}`,
      status: 'ready' as const,
      connection: {
        transport: 'websocket' as const,
        host: 'test.game.local',
        port: 7443,
        secure: true,
        protocolVersion: request.protocolVersion,
        tokenReference: `token:${request.allocationId}`,
        expiresAt: null,
      },
    }

    this.results.set(request.allocationId, created)
    return created
  }

  async getAllocation(reference: { allocationId: string }) {
    this.getCalls += 1
    return this.results.get(reference.allocationId) ?? null
  }

  async release(reference: { allocationId: string }): Promise<void> {
    if (this.releaseError) {
      throw this.releaseError
    }

    this.results.delete(reference.allocationId)
  }
}

function buildCommand(overrides: Partial<SessionAllocationCommand> = {}): SessionAllocationCommand {
  return {
    sessionId: 'session-1',
    matchId: 'match-1',
    proposalId: 'proposal-1',
    gameId: 'signal-grid',
    queueType: 'quick-play',
    platform: 'web',
    region: null,
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    playerIds: ['player-1', 'player-2'],
    participantCapacity: 2,
    requestedAt: '2026-10-01T10:00:00.000Z',
    expiresAt: '2026-10-01T10:15:00.000Z',
    ...overrides,
  }
}