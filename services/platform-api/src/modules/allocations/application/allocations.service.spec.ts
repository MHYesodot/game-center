import { HttpException, HttpStatus } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import type { CatalogAllocationArtifactQuery } from '../../../boundaries/catalog-allocation-artifact-query.js'
import { SessionAllocationError, type SessionAllocationCommand } from '../../../boundaries/session-allocation-orchestrator.js'
import type { Clock } from '../../../boundaries/clock.js'
import type { IdGenerator } from '../../../boundaries/id-generator.js'
import type { DurableGameServerAllocation } from '../domain/game-server-allocation.js'
import { AllocationProviderError } from './allocations.errors.js'
import type {
  AllocationRepository,
  AllocationRepositoryTransaction,
  GameServerAllocator,
  GameServerAllocatorRegistry,
} from './allocations.ports.js'
import { AllocationsService } from './allocations.service.js'

describe('AllocationsService', () => {
  it('creates an allocation and returns ready when the provider succeeds synchronously', async () => {
    const harness = createHarness()

    const allocation = await harness.service.requestAllocation(buildCommand())

    expect(allocation.status).toBe('ready')
    expect(allocation.connection?.host).toBe('test.game.local')
    expect(harness.provider.allocateCalls).toBe(1)
    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({
      allocationId: 'allocation-1',
      status: 'ready',
    })
  })

  it('keeps concurrent requestAllocation idempotent with one allocate call', async () => {
    const harness = createHarness()

    const [left, right] = await Promise.all([
      harness.service.requestAllocation(buildCommand()),
      harness.service.requestAllocation(buildCommand()),
    ])

    expect(left.allocationId).toBe(right.allocationId)
    expect(harness.provider.allocateCalls).toBe(1)
    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({ status: 'ready' })
  })

  it('marks the allocation failed when the provider throws a semantic provider error', async () => {
    const harness = createHarness({
      providerError: new AllocationProviderError('ALLOCATION_PROVIDER_UNAVAILABLE', 'allocator unavailable'),
    })

    await expect(harness.service.requestAllocation(buildCommand())).rejects.toBeInstanceOf(SessionAllocationError)
    await expect(harness.service.requestAllocation(buildCommand())).rejects.toMatchObject({ code: 'ALLOCATION_FAILED' })

    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({
      status: 'failed',
      failureCode: 'ALLOCATION_PROVIDER_UNAVAILABLE',
      connection: null,
    })
  })

  it('recovers from persistence failure after provider success by retrying the same allocation id', async () => {
    const harness = createHarness({ failReadyUpdateOnce: true })

    await expect(harness.service.requestAllocation(buildCommand())).rejects.toMatchObject({ code: 'ALLOCATION_UNAVAILABLE' })

    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({
      allocationId: 'allocation-1',
      status: 'provisioning',
    })

    const retried = await harness.service.requestAllocation(buildCommand())
    expect(retried.allocationId).toBe('allocation-1')
    expect(retried.status).toBe('ready')
    expect(harness.provider.allocateCalls).toBe(1)
    expect(harness.provider.getCalls).toBe(1)
  })

  it('keeps release idempotent and does not mark released when provider release fails', async () => {
    const harness = createHarness({ releaseError: new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'release failed') })
    await harness.service.requestAllocation(buildCommand())

    await expect(harness.service.releaseAllocation('session-1')).rejects.toMatchObject({ code: 'ALLOCATION_FAILED' })
    expect(await harness.repository.getLatestBySessionId('session-1')).toMatchObject({ status: 'releasing' })

    harness.provider.releaseError = undefined
    const released = await harness.service.releaseAllocation('session-1')
    expect(released).toMatchObject({ status: 'released', connection: null })

    const repeated = await harness.service.releaseAllocation('session-1')
    expect(repeated).toMatchObject({ status: 'released' })
  })

  it('maps catalog availability failure to ALLOCATION_UNAVAILABLE', async () => {
    const harness = createHarness({
      catalogError: new HttpException({ code: 'CATALOG_UNAVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE),
    })

    await expect(harness.service.requestAllocation(buildCommand())).rejects.toMatchObject({ code: 'ALLOCATION_UNAVAILABLE' })
  })
})

function createHarness(options: {
  providerError?: Error
  releaseError?: Error
  failReadyUpdateOnce?: boolean
  catalogError?: Error
} = {}) {
  const repository = new InMemoryAllocationRepository(options.failReadyUpdateOnce)
  const provider = new FakeAllocator(options.providerError, options.releaseError)
  const registry: GameServerAllocatorRegistry = {
    get() {
      return provider
    },
  }
  const catalogQuery: CatalogAllocationArtifactQuery = {
    async getGameServerArtifact() {
      if (options.catalogError) {
        throw options.catalogError
      }

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
  const idGenerator: IdGenerator = {
    nextId: () => 'allocation-1',
  }

  return {
    repository,
    provider,
    service: new AllocationsService(repository, registry, 'test', catalogQuery, clock, idGenerator),
  }
}

class InMemoryAllocationRepository implements AllocationRepository {
  private readonly records = new Map<string, DurableGameServerAllocation>()
  private transactionChain = Promise.resolve()

  constructor(private failReadyUpdateOnce = false) {}

  async getById(allocationId: string): Promise<DurableGameServerAllocation | null> {
    return this.records.has(allocationId) ? structuredClone(this.records.get(allocationId) as DurableGameServerAllocation) : null
  }

  async getLatestBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null> {
    const latest = [...this.records.values()]
      .filter((record) => record.sessionId === sessionId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.allocationId.localeCompare(left.allocationId))[0]

    return latest ? structuredClone(latest) : null
  }

  async getActiveBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null> {
    const active = [...this.records.values()].find(
      (record) =>
        record.sessionId === sessionId &&
        (record.status === 'requested' || record.status === 'provisioning' || record.status === 'ready' || record.status === 'releasing'),
    )

    return active ? structuredClone(active) : null
  }

  async withTransaction<T>(callback: (transaction: AllocationRepositoryTransaction) => Promise<T>): Promise<T> {
    const run = this.transactionChain.then(() =>
      callback({
        getById: async (allocationId) => this.getById(allocationId),
        getByIdForUpdate: async (allocationId) => this.getById(allocationId),
        getLatestBySessionId: async (sessionId) => this.getLatestBySessionId(sessionId),
        getActiveBySessionId: async (sessionId) => this.getActiveBySessionId(sessionId),
        getActiveBySessionIdForUpdate: async (sessionId) => this.getActiveBySessionId(sessionId),
        createAllocation: async (input) => {
          if (await this.getActiveBySessionId(input.sessionId)) {
            throw Object.assign(new Error('duplicate active allocation'), { code: '23505' })
          }

          this.records.set(input.allocationId, structuredClone(input))
        },
        updateAllocation: async (allocation) => {
          if (this.failReadyUpdateOnce && allocation.status === 'ready') {
            this.failReadyUpdateOnce = false
            throw new Error('transient update failure')
          }

          this.records.set(allocation.allocationId, structuredClone(allocation))
        },
      }),
    )

    this.transactionChain = run.then(
      () => undefined,
      () => undefined,
    )

    return run
  }
}

class FakeAllocator implements GameServerAllocator {
  readonly allocations = new Map<string, ProviderRecord>()
  allocateCalls = 0
  getCalls = 0

  constructor(private readonly providerError?: Error, public releaseError?: Error) {}

  async allocate(request: SessionAllocationCommand): Promise<ProviderRecord> {
    this.allocateCalls += 1

    if (this.providerError) {
      throw this.providerError
    }

    const existing = this.allocations.get(request.allocationId)
    if (existing) {
      return existing
    }

    const created: ProviderRecord = {
      providerReference: `provider-${request.allocationId}`,
      status: 'ready',
      connection: {
        transport: 'websocket',
        host: 'test.game.local',
        port: 7443,
        secure: true,
        protocolVersion: request.protocolVersion,
        tokenReference: `token:${request.allocationId}`,
        expiresAt: null,
      },
    }

    this.allocations.set(request.allocationId, created)
    return created
  }

  async getAllocation(reference: { allocationId: string }): Promise<ProviderRecord | null> {
    this.getCalls += 1
    return this.allocations.get(reference.allocationId) ?? null
  }

  async release(reference: { allocationId: string }): Promise<void> {
    if (this.releaseError) {
      throw this.releaseError
    }

    this.allocations.delete(reference.allocationId)
  }
}

type ProviderRecord = Awaited<ReturnType<FakeAllocator['allocate']>>

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