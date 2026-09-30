import { afterEach, describe, expect, it } from 'vitest'

import { createCatalogPool, migrateCatalogDatabase } from '../../../catalog/infrastructure/persistence/catalog.persistence.js'
import { createIsolatedPostgresDatabase } from '../../../../testing/isolated-postgres-database.js'
import type { CreateSessionRecordInput } from '../../application/sessions.ports.js'
import { PostgresSessionRepository } from './repositories/postgres-session.repository.js'
import { createSessionsDatabase } from './session.persistence.js'

const baseConnectionString = process.env.POSTGRES_URL

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for session integration tests.')
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

describe('session persistence integration', () => {
  it('migrates from empty and persists a session with participants', async () => {
    const harness = await createHarness()
    cleanups.push(harness.cleanup)

    await harness.repository.withTransaction(async (transaction) => {
      await transaction.createSession(buildCreateSessionInput())
    })

    const session = await harness.repository.getByMatchId('match-1')
    expect(session).toMatchObject({
      sessionId: 'session-1',
      status: 'created',
      matchId: 'match-1',
    })
    expect(session?.participants).toEqual([
      expect.objectContaining({ playerId: 'player-1', sourceRequestId: 'request-1' }),
      expect.objectContaining({ playerId: 'player-2', sourceRequestId: 'request-2' }),
    ])
  }, 15_000)

  it('enforces one durable session per match', async () => {
    const harness = await createHarness()
    cleanups.push(harness.cleanup)

    await harness.repository.withTransaction(async (transaction) => {
      await transaction.createSession(buildCreateSessionInput())
    })

    await expectUniqueViolation(
      harness.repository.withTransaction(async (transaction) => {
        await transaction.createSession(buildCreateSessionInput({ sessionId: 'session-2', proposalId: 'proposal-2' }))
      }),
    )
  }, 15_000)

  it('rolls back the whole insert when participant uniqueness is violated', async () => {
    const harness = await createHarness()
    cleanups.push(harness.cleanup)

    await expectUniqueViolation(
      harness.repository.withTransaction(async (transaction) => {
        await transaction.createSession(
          buildCreateSessionInput({
            participants: [
              {
                sessionId: 'session-1',
                playerId: 'player-1',
                sourceRequestId: 'request-1',
                sourceLobbyId: null,
                joinedAt: '2026-09-30T11:00:00.000Z',
              },
              {
                sessionId: 'session-1',
                playerId: 'player-1',
                sourceRequestId: 'request-2',
                sourceLobbyId: null,
                joinedAt: '2026-09-30T11:00:00.000Z',
              },
            ],
          }),
        )
      }),
    )

    expect(await harness.repository.getById('session-1')).toBeNull()
  }, 15_000)
})

async function createHarness() {
  const database = await createIsolatedPostgresDatabase(baseConnectionString as string, 'sessions_test')
  const pool = createCatalogPool(database.connectionString)

  await migrateCatalogDatabase(database.connectionString)

  const repository = new PostgresSessionRepository(createSessionsDatabase(pool))

  return {
    repository,
    cleanup: async () => {
      await pool.end()
      await database.cleanup()
    },
  }
}

function buildCreateSessionInput(overrides: Partial<CreateSessionRecordInput> = {}): CreateSessionRecordInput {
  const base: CreateSessionRecordInput = {
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
    createdAt: '2026-09-30T11:00:00.000Z',
    updatedAt: '2026-09-30T11:00:00.000Z',
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    expiresAt: '2026-09-30T11:15:00.000Z',
    failureCode: null,
    participants: [
      {
        sessionId: 'session-1',
        playerId: 'player-1',
        sourceRequestId: 'request-1',
        sourceLobbyId: null,
        joinedAt: '2026-09-30T11:00:00.000Z',
      },
      {
        sessionId: 'session-1',
        playerId: 'player-2',
        sourceRequestId: 'request-2',
        sourceLobbyId: null,
        joinedAt: '2026-09-30T11:00:00.000Z',
      },
    ],
  }

  return {
    ...base,
    ...overrides,
    participants: overrides.participants ?? base.participants,
  }
}

async function expectUniqueViolation(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    cause: {
      code: '23505',
    },
  })
}