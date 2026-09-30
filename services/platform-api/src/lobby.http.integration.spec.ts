import 'reflect-metadata'

import { randomUUID } from 'node:crypto'

import { Module, RequestMethod } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { afterEach, describe, expect, it } from 'vitest'

import { validateEnv } from './infrastructure/config/env.schema.js'
import { InfrastructureModule } from './infrastructure/infrastructure.module.js'
import { LobbyModule } from './modules/lobby/lobby.module.js'
import { CatalogModule } from './modules/catalog/catalog.module.js'
import { migrateCatalogDatabase, seedCatalogReferenceDataWithClient, createCatalogDatabase, createCatalogPool } from './modules/catalog/infrastructure/persistence/catalog.persistence.js'
import { createIsolatedPostgresDatabase } from './testing/isolated-postgres-database.js'
import { createIsolatedRedisNamespace } from './testing/isolated-redis.js'

const baseConnectionString = process.env.POSTGRES_URL
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for lobby integration tests.')
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

describe('lobby http integration', () => {
  it('creates, gets, joins, readies, and leaves a lobby', async () => {
    const testApp = await createLobbyTestApplication()
    cleanups.push(testApp.cleanup)

    const { baseUrl } = testApp

    const createResponse = await fetch(`${baseUrl}/api/lobbies`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({
        gameId: 'signal-grid',
        visibility: 'public',
        capacity: 4,
        minimumPlayers: 2,
        configuration: {
          schemaVersion: 'v1',
          settings: {
            boardSize: 'standard',
          },
        },
      }),
    })

    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()) as { lobbyId: string; runtime: { available: boolean } }
    expect(created.runtime.available).toBe(true)

    const getResponse = await fetch(`${baseUrl}/api/lobbies/${created.lobbyId}`)
    expect(getResponse.status).toBe(200)

    const joinResponse = await fetch(`${baseUrl}/api/lobbies/${created.lobbyId}/join`, {
      method: 'POST',
      headers: jsonHeaders('player-2'),
      body: JSON.stringify({}),
    })
    expect(joinResponse.status).toBe(200)

    const readyOwnerResponse = await fetch(`${baseUrl}/api/lobbies/${created.lobbyId}/ready`, {
      method: 'PUT',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({ ready: true }),
    })
    expect(readyOwnerResponse.status).toBe(200)

    const readyMemberResponse = await fetch(`${baseUrl}/api/lobbies/${created.lobbyId}/ready`, {
      method: 'PUT',
      headers: jsonHeaders('player-2'),
      body: JSON.stringify({ ready: true }),
    })
    expect(readyMemberResponse.status).toBe(200)

    const leaveResponse = await fetch(`${baseUrl}/api/lobbies/${created.lobbyId}/leave`, {
      method: 'POST',
      headers: jsonHeaders('player-2'),
    })
    expect(leaveResponse.status).toBe(200)

    const lobbyAfterLeave = (await leaveResponse.json()) as { members: Array<{ playerId: string; leftAt: string | null }> }
    expect(lobbyAfterLeave.members.find((member) => member.playerId === 'player-2')?.leftAt).not.toBeNull()
  }, 15_000)

  it('rejects invalid games with semantic not-found behavior', async () => {
    const testApp = await createLobbyTestApplication()
    cleanups.push(testApp.cleanup)

    const createResponse = await fetch(`${testApp.baseUrl}/api/lobbies`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({
        gameId: 'missing-game',
        visibility: 'public',
        capacity: 4,
        minimumPlayers: 2,
        configuration: {
          schemaVersion: 'v1',
          settings: {},
        },
      }),
    })

    expect(createResponse.status).toBe(404)
    expect(await createResponse.json()).toEqual({ code: 'GAME_NOT_FOUND' })
  }, 15_000)

  it('enforces the capacity invariant under concurrent joins on the last seat', async () => {
    const testApp = await createLobbyTestApplication()
    cleanups.push(testApp.cleanup)

    const createResponse = await fetch(`${testApp.baseUrl}/api/lobbies`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({
        gameId: 'signal-grid',
        visibility: 'public',
        capacity: 2,
        minimumPlayers: 2,
        configuration: {
          schemaVersion: 'v1',
          settings: {},
        },
      }),
    })
    const created = (await createResponse.json()) as { lobbyId: string }

    const [left, right] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/join`, {
        method: 'POST',
        headers: jsonHeaders('player-2'),
        body: JSON.stringify({}),
      }),
      fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/join`, {
        method: 'POST',
        headers: jsonHeaders('player-3'),
        body: JSON.stringify({}),
      }),
    ])

    const statuses = [left.status, right.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 409])

    const payloads = await Promise.all([left.json(), right.json()])
    expect(payloads.some((payload) => payload.code === 'LOBBY_FULL')).toBe(true)

    const finalLobbyResponse = await fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}`)
    const finalLobby = (await finalLobbyResponse.json()) as { members: Array<{ leftAt: string | null }> }
    expect(finalLobby.members.filter((member) => member.leftAt === null)).toHaveLength(2)
  }, 15_000)

  it('keeps join idempotent and start idempotent across retries', async () => {
    const testApp = await createLobbyTestApplication()
    cleanups.push(testApp.cleanup)

    const createResponse = await fetch(`${testApp.baseUrl}/api/lobbies`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({
        gameId: 'signal-grid',
        visibility: 'public',
        capacity: 2,
        minimumPlayers: 2,
        configuration: {
          schemaVersion: 'v1',
          settings: {},
        },
      }),
    })
    const created = (await createResponse.json()) as { lobbyId: string }

    const [joinFirst, joinSecond] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/join`, {
        method: 'POST',
        headers: jsonHeaders('player-2'),
        body: JSON.stringify({}),
      }),
      fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/join`, {
        method: 'POST',
        headers: jsonHeaders('player-2'),
        body: JSON.stringify({}),
      }),
    ])
    expect(joinFirst.status).toBe(200)
    expect(joinSecond.status).toBe(200)

    await fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/ready`, {
      method: 'PUT',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({ ready: true }),
    })
    await fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/ready`, {
      method: 'PUT',
      headers: jsonHeaders('player-2'),
      body: JSON.stringify({ ready: true }),
    })

    const [startFirst, startSecond] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/start`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
      }),
      fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/start`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
      }),
    ])

    expect(startFirst.status).toBe(200)
    expect(startSecond.status).toBe(200)

    const startedLobby = (await startSecond.json()) as { status: string; members: Array<{ leftAt: string | null }> }
    expect(startedLobby.status).toBe('starting')
    expect(startedLobby.members.filter((member) => member.leftAt === null)).toHaveLength(2)
  }, 15_000)

  it('survives redis runtime flush without losing durable lobby state', async () => {
    const testApp = await createLobbyTestApplication()
    cleanups.push(testApp.cleanup)

    const createResponse = await fetch(`${testApp.baseUrl}/api/lobbies`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({
        gameId: 'signal-grid',
        visibility: 'public',
        capacity: 2,
        minimumPlayers: 2,
        configuration: {
          schemaVersion: 'v1',
          settings: {},
        },
      }),
    })
    const created = (await createResponse.json()) as { lobbyId: string }

    await fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/join`, {
      method: 'POST',
      headers: jsonHeaders('player-2'),
      body: JSON.stringify({}),
    })
    await fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}/ready`, {
      method: 'PUT',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({ ready: true }),
    })

    await testApp.redis.clear()

    const afterFlushResponse = await fetch(`${testApp.baseUrl}/api/lobbies/${created.lobbyId}`)
    const afterFlush = (await afterFlushResponse.json()) as { status: string; runtime: { allMembersReady: boolean }; members: Array<{ leftAt: string | null }> }

    expect(afterFlushResponse.status).toBe(200)
    expect(afterFlush.status).toBe('open')
    expect(afterFlush.members.filter((member) => member.leftAt === null)).toHaveLength(2)
    expect(afterFlush.runtime.allMembersReady).toBe(false)
  }, 15_000)
})

async function createLobbyTestApplication() {
  const database = await createIsolatedPostgresDatabase(baseConnectionString, 'lobby_test')
  const redis = await createIsolatedRedisNamespace(redisUrl)

  const pool = createCatalogPool(database.connectionString)
  await migrateCatalogDatabase(database.connectionString)

  const db = createCatalogDatabase(pool)
  await seedCatalogReferenceDataWithClient(db)

  const app = await createTestApplication(database.connectionString, redis.namespace)
  const baseUrl = await listenOnRandomPort(app)

  return {
    baseUrl,
    redis,
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
    LOBBY_RUNTIME_NAMESPACE: process.env.LOBBY_RUNTIME_NAMESPACE,
  }

  process.env.NODE_ENV = 'test'
  process.env.POSTGRES_URL = connectionString
  process.env.REDIS_URL = redisUrl
  delete process.env.NATS_URL
  process.env.CORS_ORIGIN = 'http://127.0.0.1:0'
  process.env.PORT = '3001'
  process.env.LOBBY_RUNTIME_NAMESPACE = runtimeNamespace

  cleanups.push(async () => {
    restoreEnvironment(previousEnvironment)
  })

  class LobbyApiTestModule {}

  Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validate: validateEnv,
      }),
      InfrastructureModule,
      CatalogModule,
      LobbyModule,
    ],
  })(LobbyApiTestModule)

  const app = await NestFactory.create(LobbyApiTestModule, {
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