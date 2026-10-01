import { afterEach, describe, expect, it } from 'vitest'

import { createCatalogPool, migrateCatalogDatabase } from '../../../catalog/infrastructure/persistence/catalog.persistence.js'
import { PostgresSessionRepository } from '../../../sessions/infrastructure/persistence/repositories/postgres-session.repository.js'
import { createSessionsDatabase } from '../../../sessions/infrastructure/persistence/session.persistence.js'
import { createIsolatedPostgresDatabase } from '../../../../testing/isolated-postgres-database.js'
import type { CreateAllocationRecordInput } from '../../application/allocations.ports.js'
import { PostgresAllocationRepository } from './repositories/postgres-allocation.repository.js'
import { createAllocationsDatabase } from './allocation.persistence.js'

const baseConnectionString = process.env.POSTGRES_URL

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for allocation persistence integration tests.')
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

describe('allocation persistence integration', () => {
  it('migrates from empty and persists an allocation bound to a session', async () => {
    const harness = await createHarness()
    cleanups.push(harness.cleanup)

    await harness.seedSession()
    await harness.repository.withTransaction(async (transaction) => {
      await transaction.createAllocation(buildCreateAllocationInput())
    })

    const allocation = await harness.repository.getLatestBySessionId('session-1')
    expect(allocation).toMatchObject({
      allocationId: 'allocation-1',
      status: 'ready',
      sessionId: 'session-1',
    })
    expect(allocation?.connection).toMatchObject({ host: 'test.game.local', port: 7443 })
  }, 15_000)

  it('enforces at most one active allocation per session', async () => {
    const harness = await createHarness()
    cleanups.push(harness.cleanup)

    await harness.seedSession()
    await harness.repository.withTransaction(async (transaction) => {
      await transaction.createAllocation(buildCreateAllocationInput({ status: 'requested', connection: null, providerReference: null }))
    })

    await expectUniqueViolation(
      harness.repository.withTransaction(async (transaction) => {
        await transaction.createAllocation(
          buildCreateAllocationInput({
            allocationId: 'allocation-2',
            status: 'provisioning',
            connection: null,
            providerReference: null,
          }),
        )
      }),
    )
  }, 15_000)

  it('enforces provider reference uniqueness when present', async () => {
    const harness = await createHarness()
    cleanups.push(harness.cleanup)

    await harness.seedSession('session-1', 'match-1')
    await harness.seedSession('session-2', 'match-2')

    await harness.repository.withTransaction(async (transaction) => {
      await transaction.createAllocation(buildCreateAllocationInput())
    })

    await expectUniqueViolation(
      harness.repository.withTransaction(async (transaction) => {
        await transaction.createAllocation(
          buildCreateAllocationInput({
            allocationId: 'allocation-2',
            sessionId: 'session-2',
            providerReference: 'provider-ref-1',
          }),
        )
      }),
    )
  }, 15_000)
})

async function createHarness() {
  const database = await createIsolatedPostgresDatabase(baseConnectionString as string, 'allocations_test')
  const pool = createCatalogPool(database.connectionString)

  await migrateCatalogDatabase(database.connectionString)

  const sessionRepository = new PostgresSessionRepository(createSessionsDatabase(pool))
  const repository = new PostgresAllocationRepository(createAllocationsDatabase(pool))

  return {
    repository,
    seedSession: async (sessionId = 'session-1', matchId = 'match-1') => {
      await sessionRepository.withTransaction(async (transaction) => {
        await transaction.createSession({
          sessionId,
          sourceKind: 'matchmaking',
          matchId,
          proposalId: `proposal-${sessionId}`,
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
              sessionId,
              playerId: `${sessionId}-player-1`,
              sourceRequestId: `${sessionId}-request-1`,
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

function buildCreateAllocationInput(overrides: Partial<CreateAllocationRecordInput> = {}): CreateAllocationRecordInput {
  const base: CreateAllocationRecordInput = {
    allocationId: 'allocation-1',
    sessionId: 'session-1',
    provider: 'test',
    providerReference: 'provider-ref-1',
    status: 'ready',
    gameId: 'signal-grid',
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    buildVersion: 'prototype',
    serverType: 'dedicated',
    runtimeType: 'external',
    runtimeProfile: 'dedicated-server',
    region: null,
    participantCapacity: 2,
    requestedAt: '2026-10-01T10:00:00.000Z',
    provisioningAt: '2026-10-01T10:00:05.000Z',
    readyAt: '2026-10-01T10:00:10.000Z',
    failedAt: null,
    releasingAt: null,
    releasedAt: null,
    expiresAt: '2026-10-01T10:15:00.000Z',
    failureCode: null,
    connection: {
      transport: 'websocket',
      host: 'test.game.local',
      port: 7443,
      secure: true,
      protocolVersion: 'v1',
      tokenReference: 'token-ref-1',
      expiresAt: null,
    },
  }

  return {
    ...base,
    ...overrides,
    connection: overrides.connection === null ? null : { ...base.connection, ...overrides.connection },
  }
}

async function expectUniqueViolation(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    cause: {
      code: '23505',
    },
  })
}