import 'reflect-metadata'

import { randomUUID } from 'node:crypto'

import { Module, RequestMethod } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { afterEach, describe, expect, it } from 'vitest'

import { validateEnv } from './infrastructure/config/env.schema.js'
import { InfrastructureModule } from './infrastructure/infrastructure.module.js'
import { CatalogModule } from './modules/catalog/catalog.module.js'
import {
  createCatalogDatabase,
  createCatalogPool,
  migrateCatalogDatabase,
  seedCatalogReferenceDataWithClient,
} from './modules/catalog/infrastructure/persistence/catalog.persistence.js'
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module.js'
import { PostgresMatchmakingRepository } from './modules/matchmaking/infrastructure/persistence/repositories/postgres-matchmaking.repository.js'
import { createMatchmakingDatabase } from './modules/matchmaking/infrastructure/persistence/matchmaking.persistence.js'
import { SessionsModule } from './modules/sessions/sessions.module.js'
import { PostgresSessionRepository } from './modules/sessions/infrastructure/persistence/repositories/postgres-session.repository.js'
import { createSessionsDatabase } from './modules/sessions/infrastructure/persistence/session.persistence.js'
import { createIsolatedPostgresDatabase } from './testing/isolated-postgres-database.js'
import { createIsolatedRedisNamespace } from './testing/isolated-redis.js'

const baseConnectionString = process.env.POSTGRES_URL
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

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

describe('session http integration', () => {
  it('creates and fetches a session from a trusted matched proposal', async () => {
    const testApp = await createSessionTestApplication()
    cleanups.push(testApp.cleanup)

    await seedMatchedProposal(testApp.matchmakingRepository, 'match-1')

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({ matchId: 'match-1' }),
    })

    expect(createResponse.status).toBe(200)
    const created = (await createResponse.json()) as { sessionId: string; status: string; participants: Array<{ playerId: string }> }
    expect(created.status).toBe('ready')
    expect(created.participants.map((participant) => participant.playerId)).toEqual(['player-1', 'player-2'])

    const getResponse = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}`, {
      headers: jsonHeaders('player-2'),
    })

    expect(getResponse.status).toBe(200)
    expect((await getResponse.json()) as { sessionId: string }).toMatchObject({ sessionId: created.sessionId })
  }, 15_000)

  it('keeps create idempotent under concurrent retries for the same match', async () => {
    const testApp = await createSessionTestApplication()
    cleanups.push(testApp.cleanup)

    await seedMatchedProposal(testApp.matchmakingRepository, 'match-2')

    const [left, right] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
        body: JSON.stringify({ matchId: 'match-2' }),
      }),
      fetch(`${testApp.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
        body: JSON.stringify({ matchId: 'match-2' }),
      }),
    ])

    expect(left.status).toBe(200)
    expect(right.status).toBe(200)

    const leftBody = (await left.json()) as { sessionId: string }
    const rightBody = (await right.json()) as { sessionId: string }

    expect(leftBody.sessionId).toBe(rightBody.sessionId)

    const stored = await testApp.sessionRepository.getByMatchId('match-2')
    expect(stored).not.toBeNull()
    expect(stored?.sessionId).toBe(leftBody.sessionId)
    expect(stored?.status).toBe('ready')
  }, 15_000)

  it('rejects reads from non-participants', async () => {
    const testApp = await createSessionTestApplication()
    cleanups.push(testApp.cleanup)

    await seedMatchedProposal(testApp.matchmakingRepository, 'match-3')

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({ matchId: 'match-3' }),
    })
    const created = (await createResponse.json()) as { sessionId: string }

    const getResponse = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}`, {
      headers: jsonHeaders('player-9'),
    })

    expect(getResponse.status).toBe(404)
    expect(await getResponse.json()).toEqual({ code: 'SESSION_NOT_FOUND' })
  }, 15_000)

  it('serves session-scoped allocation reads and idempotent release', async () => {
    const testApp = await createSessionTestApplication()
    cleanups.push(testApp.cleanup)

    await seedMatchedProposal(testApp.matchmakingRepository, 'match-4')

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({ matchId: 'match-4' }),
    })
    const created = (await createResponse.json()) as { sessionId: string }

    const getAllocation = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation`, {
      headers: jsonHeaders('player-2'),
    })
    expect(getAllocation.status).toBe(200)

    const allocation = (await getAllocation.json()) as { status: string; connection: { host: string } | null }
    expect(allocation.status).toBe('ready')
    expect(allocation.connection?.host).toBe('test.game.local')

    const release = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation/release`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
    })
    expect(release.status).toBe(200)
    expect((await release.json()) as { status: string }).toMatchObject({ status: 'released' })

    const repeatedRelease = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation/release`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
    })
    expect(repeatedRelease.status).toBe(200)
    expect((await repeatedRelease.json()) as { status: string }).toMatchObject({ status: 'released' })
  }, 15_000)
})

async function createSessionTestApplication() {
  const database = await createIsolatedPostgresDatabase(baseConnectionString as string, 'session_http_test')
  const redis = await createIsolatedRedisNamespace(redisUrl)
  const pool = createCatalogPool(database.connectionString)

  await migrateCatalogDatabase(database.connectionString)
  await seedCatalogReferenceDataWithClient(createCatalogDatabase(pool))

  const app = await createTestApplication(database.connectionString, redis.namespace)
  const baseUrl = await listenOnRandomPort(app)

  const matchmakingRepository = new PostgresMatchmakingRepository(createMatchmakingDatabase(pool))
  const sessionRepository = new PostgresSessionRepository(createSessionsDatabase(pool))

  return {
    baseUrl,
    matchmakingRepository,
    sessionRepository,
    cleanup: async () => {
      await app.close()
      await pool.end()
      await redis.cleanup()
      await database.cleanup()
    },
  }
}

async function createTestApplication(connectionString: string, runtimeNamespace: string) {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_URL: process.env.POSTGRES_URL,
    REDIS_URL: process.env.REDIS_URL,
    NATS_URL: process.env.NATS_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    PORT: process.env.PORT,
    MATCHMAKING_QUEUE_NAMESPACE: process.env.MATCHMAKING_QUEUE_NAMESPACE,
    ALLOCATION_PROVIDER: process.env.ALLOCATION_PROVIDER,
  }

  process.env.NODE_ENV = 'test'
  process.env.POSTGRES_URL = connectionString
  process.env.REDIS_URL = redisUrl
  delete process.env.NATS_URL
  process.env.CORS_ORIGIN = 'http://127.0.0.1:0'
  process.env.PORT = '3002'
  process.env.MATCHMAKING_QUEUE_NAMESPACE = runtimeNamespace
  process.env.ALLOCATION_PROVIDER = 'test'

  cleanups.push(async () => {
    restoreEnvironment(previousEnvironment)
  })

  class SessionApiTestModule {}

  Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validate: validateEnv,
      }),
      InfrastructureModule,
      CatalogModule,
      MatchmakingModule,
      SessionsModule,
    ],
  })(SessionApiTestModule)

  const app = await NestFactory.create(SessionApiTestModule, {
    logger: false,
  })

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  })

  return app
}

async function seedMatchedProposal(repository: PostgresMatchmakingRepository, matchId: string) {
  const queueKey = ['signal-grid', '0.1.0-prototype', 'v1', 'quick-play', 'web', 'global'].join('::')
  const requestedAt = '2026-09-30T11:00:00.000Z'
  const matchedAt = '2026-09-30T11:01:00.000Z'

  await repository.withTransaction(async (transaction) => {
    await transaction.createRequest({
      requestId: `${matchId}-request-1`,
      requesterType: 'player',
      requesterId: 'player-1',
      gameId: 'signal-grid',
      queueKey,
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      status: 'matched',
      requestedAt,
      cancelledAt: null,
      matchedAt,
      expiresAt: null,
      terminalOutcome: 'matched',
      sourceLobbyId: 'lobby-1',
      activeProposalId: null,
    })
    await transaction.createRequest({
      requestId: `${matchId}-request-2`,
      requesterType: 'player',
      requesterId: 'player-2',
      gameId: 'signal-grid',
      queueKey,
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      status: 'matched',
      requestedAt,
      cancelledAt: null,
      matchedAt,
      expiresAt: null,
      terminalOutcome: 'matched',
      sourceLobbyId: null,
      activeProposalId: null,
    })

    await transaction.createProposal({
      proposalId: `${matchId}-proposal`,
      matchId,
      queueKey,
      gameId: 'signal-grid',
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      status: 'matched',
      createdAt: requestedAt,
      expiresAt: '2026-09-30T11:05:00.000Z',
      matchedAt,
      resolvedAt: matchedAt,
      members: [
        {
          proposalId: `${matchId}-proposal`,
          requestId: `${matchId}-request-1`,
          playerId: 'player-1',
          acceptanceStatus: 'accepted',
          respondedAt: matchedAt,
        },
        {
          proposalId: `${matchId}-proposal`,
          requestId: `${matchId}-request-2`,
          playerId: 'player-2',
          acceptanceStatus: 'accepted',
          respondedAt: matchedAt,
        },
      ],
    })
  })
}

async function listenOnRandomPort(app: INestApplication) {
  await app.listen(0, '127.0.0.1')
  return await app.getUrl()
}

function jsonHeaders(playerId: string) {
  return {
    'content-type': 'application/json',
    'x-player-id': playerId,
    'x-request-id': randomUUID(),
  }
}

function restoreEnvironment(previousEnvironment: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}