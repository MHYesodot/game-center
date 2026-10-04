import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { afterEach, describe, expect, it } from 'vitest'

import { CATALOG_QUERY_SERVICE, type CatalogQueryService } from './boundaries/catalog-query.js'
import { CLOCK } from './boundaries/clock.js'
import { ID_GENERATOR } from './boundaries/id-generator.js'
import { REALTIME_EVENT_PUBLISHER } from './boundaries/realtime-event-publisher.js'
import { POSTGRES, REDIS, NATS } from './infrastructure/infrastructure.tokens.js'
import { ReadinessService } from './infrastructure/readiness.service.js'
import { AuthService } from './modules/auth/application/auth.service.js'
import { LobbyService } from './modules/lobby/application/lobby.service.js'
import { LOBBY_REPOSITORY, LOBBY_RUNTIME_STORE, type LobbyRepository, type LobbyRepositoryTransaction, type LobbyRuntimeStore } from './modules/lobby/application/lobby.ports.js'
import type { AuthenticatedPlayerContext } from './modules/auth/application/auth.types.js'
import { AuthenticatedPlayerGuard } from './modules/auth/transport/authenticated-player.guard.js'
import { LobbyController } from './modules/lobby/transport/lobby.controller.js'
import { HealthController } from './modules/health/health.controller.js'
import type { DurableLobbyAggregate } from './modules/lobby/domain/lobby-record.js'

const dependencyDownError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
  code: 'ECONNREFUSED',
})

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    if (cleanup) {
      await cleanup()
    }
  }
})

describe('lobby outage integration', () => {
  it('keeps the process live and returns controlled 503 responses for durable lobby operations when Postgres is unavailable', async () => {
    const app = await createOutageApp({ postgresDown: true, redisDown: false })
    cleanups.push(() => app.close())

    const baseUrl = await listenOnRandomPort(app)

    const liveResponse = await fetch(`${baseUrl}/health/live`)
    const readyResponse = await fetch(`${baseUrl}/health/ready`)
    const createResponse = await fetch(`${baseUrl}/api/lobbies`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'gc_session=test-session',
      },
      body: JSON.stringify({
        gameId: 'signal-grid',
        visibility: 'public',
        capacity: 4,
        minimumPlayers: 2,
        configuration: {
          schemaVersion: 'v1',
          settings: {},
        },
      }),
    })

    expect(liveResponse.status).toBe(200)
    expect(readyResponse.status).toBe(503)
    expect(createResponse.status).toBe(503)
    expect(await createResponse.json()).toEqual({ code: 'LOBBY_UNAVAILABLE' })
  })

  it('keeps the process live, marks readiness down, and rejects runtime-dependent ready operations when Redis is unavailable', async () => {
    const app = await createOutageApp({ postgresDown: false, redisDown: true })
    cleanups.push(() => app.close())

    const baseUrl = await listenOnRandomPort(app)

    const liveResponse = await fetch(`${baseUrl}/health/live`)
    const readyResponse = await fetch(`${baseUrl}/health/ready`)
    const getResponse = await fetch(`${baseUrl}/api/lobbies/lobby-1`)
    const readyUpdate = await fetch(`${baseUrl}/api/lobbies/lobby-1/ready`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: 'gc_session=test-session',
      },
      body: JSON.stringify({ ready: true }),
    })

    expect(liveResponse.status).toBe(200)
    expect(readyResponse.status).toBe(503)
    expect(getResponse.status).toBe(200)
    expect(readyUpdate.status).toBe(503)
    expect(await readyUpdate.json()).toEqual({ code: 'LOBBY_UNAVAILABLE' })
  })
})

async function createOutageApp(options: { postgresDown: boolean; redisDown: boolean }) {
  const repository: LobbyRepository = options.postgresDown
    ? {
        async getById() {
          throw dependencyDownError
        },
        async withTransaction() {
          throw dependencyDownError
        },
      }
    : new StaticLobbyRepository()

  const runtimeStore: LobbyRuntimeStore = options.redisDown
    ? new FailingRuntimeStore()
    : new HealthyRuntimeStore()

  const postgresProvider = options.postgresDown
    ? {
        async query() {
          throw dependencyDownError
        },
        async end() {},
      }
    : {
        async query() {
          return { rows: [] }
        },
        async end() {},
      }

  const redisProvider = options.redisDown
    ? {
        async ping() {
          throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6379'), { code: 'ECONNREFUSED' })
        },
        async quit() {},
      }
    : {
        async ping() {
          return 'PONG'
        },
        async quit() {},
      }

  const natsProvider = {
    async flush() {},
    async drain() {},
  }

  const catalogQuery: CatalogQueryService = {
    async getGameById(gameId: string) {
      return {
        gameId,
        status: 'active',
        multiplayer: true,
        privateRooms: true,
        platforms: {
          web: true,
          windows: true,
          macos: true,
          android: false,
          ios: false,
          ipados: false,
        },
      }
    },
  }

  @Module({
    controllers: [HealthController, LobbyController],
    providers: [
      ReadinessService,
      LobbyService,
      {
        provide: POSTGRES,
        useValue: postgresProvider,
      },
      {
        provide: REDIS,
        useValue: redisProvider,
      },
      {
        provide: NATS,
        useValue: natsProvider,
      },
      {
        provide: LOBBY_REPOSITORY,
        useValue: repository,
      },
      {
        provide: LOBBY_RUNTIME_STORE,
        useValue: runtimeStore,
      },
      {
        provide: CATALOG_QUERY_SERVICE,
        useValue: catalogQuery,
      },
      {
        provide: CLOCK,
        useValue: {
          now: () => new Date('2026-09-29T10:00:00.000Z'),
        },
      },
      {
        provide: ID_GENERATOR,
        useValue: {
          nextId: () => 'lobby-created-1',
        },
      },
      {
        provide: REALTIME_EVENT_PUBLISHER,
        useValue: {
          async publish() {},
        },
      },
      {
        provide: AuthService,
        useValue: {
          async requireAuthenticatedSession(_sessionToken: string | null, requestId: string | null) {
            return createTestAuthContext('player-1', requestId)
          },
        },
      },
      AuthenticatedPlayerGuard,
    ],
  })
  class LobbyOutageTestModule {}

  const app = await NestFactory.create(LobbyOutageTestModule, {
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

class StaticLobbyRepository implements LobbyRepository {
  constructor(private readonly lobby: DurableLobbyAggregate = {
    lobbyId: 'lobby-1',
    gameId: 'signal-grid',
    ownerPlayerId: 'player-1',
    status: 'open',
    visibility: 'public',
    capacity: 2,
    minimumPlayers: 2,
    configuration: {
      schemaVersion: 'v1',
      settings: {},
    },
    joinCodeHash: null,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    closedAt: null,
    expiresAt: '2026-09-29T14:00:00.000Z',
    members: [
      {
        lobbyId: 'lobby-1',
        playerId: 'player-1',
        role: 'owner',
        joinedAt: '2026-09-29T10:00:00.000Z',
        leftAt: null,
      },
    ],
  }) {}

  async getById() {
    return structuredClone(this.lobby)
  }

  async withTransaction<T>(callback: (transaction: LobbyRepositoryTransaction) => Promise<T>): Promise<T> {
    return callback({
      getById: async () => structuredClone(this.lobby),
      getByIdForUpdate: async () => structuredClone(this.lobby),
      createLobby: async () => undefined,
      addMember: async () => undefined,
      markMemberLeft: async () => undefined,
      updateMemberRole: async () => undefined,
      updateLobby: async () => undefined,
    })
  }
}

class HealthyRuntimeStore implements LobbyRuntimeStore {
  async getRuntimeState(_lobbyId: string, activePlayerIds: string[]) {
    return {
      available: true,
      connectedMemberCount: activePlayerIds.length,
      allMembersReady: false,
      readyMemberIds: [],
      members: activePlayerIds.map((playerId) => ({
        playerId,
        connectionState: 'connected' as const,
        ready: false,
        lastSeenAt: null,
        reconnectDeadlineAt: null,
      })),
    }
  }

  async markConnected() {}
  async markDisconnected() {}
  async setReadyState() {}
  async removeMember() {}
  async clearReadyState() {}
  async clearLobbyRuntime() {}
}

class FailingRuntimeStore implements LobbyRuntimeStore {
  private readonly error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6379'), {
    code: 'ECONNREFUSED',
  })

  async getRuntimeState() {
    throw this.error
  }

  async markConnected() {
    throw this.error
  }

  async markDisconnected() {
    throw this.error
  }

  async setReadyState() {
    throw this.error
  }

  async removeMember() {
    throw this.error
  }

  async clearReadyState() {
    throw this.error
  }

  async clearLobbyRuntime() {
    throw this.error
  }
}

function createTestAuthContext(playerId: string, requestId: string | null): AuthenticatedPlayerContext {
  return {
    playerId,
    email: `${playerId}@test.local`,
    expiresAt: '9999-12-31T23:59:59.999Z',
    sessionId: 'test-session',
    requestId,
  }
}