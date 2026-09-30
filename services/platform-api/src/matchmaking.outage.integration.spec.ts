import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { afterEach, describe, expect, it } from 'vitest'

import { CATALOG_QUERY_SERVICE, type CatalogQueryService } from './boundaries/catalog-query.js'
import { CLOCK } from './boundaries/clock.js'
import { ID_GENERATOR } from './boundaries/id-generator.js'
import { POSTGRES, REDIS, NATS } from './infrastructure/infrastructure.tokens.js'
import { ReadinessService } from './infrastructure/readiness.service.js'
import { HealthController } from './modules/health/health.controller.js'
import { MatchmakingService } from './modules/matchmaking/application/matchmaking.service.js'
import {
  MATCHMAKING_QUEUE_STORE,
  MATCHMAKING_REPOSITORY,
  MATCH_READY_SINK,
  type MatchmakingQueueStore,
  type MatchmakingRepository,
  type MatchmakingRepositoryTransaction,
} from './modules/matchmaking/application/matchmaking.ports.js'
import { FifoMatchmakingStrategy, MATCHMAKING_STRATEGY } from './modules/matchmaking/domain/matchmaking-strategy.js'
import type { DurableMatchProposalAggregate, DurableMatchProposalMember, DurableMatchmakingRequest } from './modules/matchmaking/domain/queue-ticket.js'
import { MatchmakingController } from './modules/matchmaking/transport/matchmaking.controller.js'

const postgresDownError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    if (cleanup) {
      await cleanup()
    }
  }
})

describe('matchmaking outage integration', () => {
  it('keeps the process live and returns controlled 503 responses for durable matchmaking operations when Postgres is unavailable', async () => {
    const app = await createOutageApp({ postgresDown: true, redisDown: false })
    cleanups.push(() => app.close())

    const baseUrl = await listenOnRandomPort(app)

    const liveResponse = await fetch(`${baseUrl}/health/live`)
    const readyResponse = await fetch(`${baseUrl}/health/ready`)
    const enqueueResponse = await fetch(`${baseUrl}/api/matchmaking/requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-player-id': 'player-1',
      },
      body: JSON.stringify({ gameId: 'signal-grid', queueType: 'quick-play', platform: 'web' }),
    })

    expect(liveResponse.status).toBe(200)
    expect(readyResponse.status).toBe(503)
    expect(enqueueResponse.status).toBe(503)
    expect(await enqueueResponse.json()).toEqual({ code: 'MATCHMAKING_UNAVAILABLE' })
  })

  it('keeps the process live, marks readiness down, and still serves durable request reads when Redis is unavailable', async () => {
    const app = await createOutageApp({ postgresDown: false, redisDown: true })
    cleanups.push(() => app.close())

    const baseUrl = await listenOnRandomPort(app)

    const liveResponse = await fetch(`${baseUrl}/health/live`)
    const readyResponse = await fetch(`${baseUrl}/health/ready`)
    const getResponse = await fetch(`${baseUrl}/api/matchmaking/requests/request-1`, {
      headers: {
        'x-player-id': 'player-1',
      },
    })

    expect(liveResponse.status).toBe(200)
    expect(readyResponse.status).toBe(503)
    expect(getResponse.status).toBe(200)

    const payload = (await getResponse.json()) as { runtime: { available: boolean } }
    expect(payload.runtime.available).toBe(false)
  })
})

async function createOutageApp(options: { postgresDown: boolean; redisDown: boolean }) {
  const repository: MatchmakingRepository = options.postgresDown
    ? {
        async getRequestById() {
          throw postgresDownError
        },
        async getProposalById() {
          throw postgresDownError
        },
        async getActiveRequestByRequester() {
          throw postgresDownError
        },
        async withTransaction() {
          throw postgresDownError
        },
      }
    : new StaticMatchmakingRepository()

  const queueStore: MatchmakingQueueStore = options.redisDown ? new FailingMatchmakingQueueStore() : new HealthyMatchmakingQueueStore()

  const postgresProvider = options.postgresDown
    ? {
        async query() {
          throw postgresDownError
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
        gameVersion: '0.1.0-prototype',
        protocolVersion: 'v1',
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
    controllers: [HealthController, MatchmakingController],
    providers: [
      ReadinessService,
      MatchmakingService,
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
        provide: MATCHMAKING_REPOSITORY,
        useValue: repository,
      },
      {
        provide: MATCHMAKING_QUEUE_STORE,
        useValue: queueStore,
      },
      {
        provide: MATCH_READY_SINK,
        useValue: {
          async onMatchReady() {},
        },
      },
      {
        provide: MATCHMAKING_STRATEGY,
        useClass: FifoMatchmakingStrategy,
      },
      {
        provide: CATALOG_QUERY_SERVICE,
        useValue: catalogQuery,
      },
      {
        provide: CLOCK,
        useValue: {
          now: () => new Date('2026-09-30T10:00:00.000Z'),
        },
      },
      {
        provide: ID_GENERATOR,
        useValue: {
          nextId: () => 'request-created-1',
        },
      },
    ],
  })
  class MatchmakingOutageTestModule {}

  const app = await NestFactory.create(MatchmakingOutageTestModule, {
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
  const address = app.getHttpServer().address()
  return `http://127.0.0.1:${address.port}`
}

class StaticMatchmakingRepository implements MatchmakingRepository {
  private readonly request: DurableMatchmakingRequest = {
    requestId: 'request-1',
    requesterType: 'player',
    requesterId: 'player-1',
    gameId: 'signal-grid',
    queueKey: 'signal-grid::0.1.0-prototype::v1::quick-play::web::global',
    queueType: 'quick-play',
    platform: 'web',
    region: null,
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    status: 'queued',
    requestedAt: '2026-09-30T10:00:00.000Z',
    cancelledAt: null,
    matchedAt: null,
    expiresAt: '2026-09-30T10:10:00.000Z',
    terminalOutcome: null,
    sourceLobbyId: null,
    activeProposalId: null,
  }

  async getRequestById() {
    return this.request
  }

  async getProposalById(): Promise<DurableMatchProposalAggregate | null> {
    return null
  }

  async getActiveRequestByRequester() {
    return this.request
  }

  async withTransaction<T>(callback: (transaction: MatchmakingRepositoryTransaction) => Promise<T>): Promise<T> {
    const transaction: MatchmakingRepositoryTransaction = {
      getRequestById: async () => this.request,
      getRequestByIdForUpdate: async () => this.request,
      getRequestsByIdsForUpdate: async () => [this.request],
      getActiveRequestByRequester: async () => this.request,
      getActiveRequestByRequesterForUpdate: async () => this.request,
      createRequest: async () => {},
      updateRequest: async () => {},
      getProposalById: async () => null,
      getProposalByIdForUpdate: async () => null,
      createProposal: async () => {},
      updateProposal: async () => {},
      updateProposalMember: async (_member: DurableMatchProposalMember) => {},
    }

    return callback(transaction)
  }
}

class HealthyMatchmakingQueueStore implements MatchmakingQueueStore {
  async enqueue() {}
  async remove() {}
  async removeMany() {}
  async getCandidateRequestIds() {
    return []
  }
  async getRuntimeState() {
    return {
      available: true,
      queuePosition: 1,
      estimatedWaitSeconds: null,
      candidateCount: 1,
      lastHeartbeatAt: null,
      searchExpansionVersion: null,
    }
  }
  async acquireQueueLock() {
    return true
  }
  async releaseQueueLock() {}
  async touchProposalLease() {}
  async clearProposalLease() {}
}

class FailingMatchmakingQueueStore implements MatchmakingQueueStore {
  private readonly error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6379'), { code: 'ECONNREFUSED' })

  async enqueue() {
    throw this.error
  }
  async remove() {
    throw this.error
  }
  async removeMany() {
    throw this.error
  }
  async getCandidateRequestIds() {
    throw this.error
  }
  async getRuntimeState() {
    throw this.error
  }
  async acquireQueueLock() {
    throw this.error
  }
  async releaseQueueLock() {
    throw this.error
  }
  async touchProposalLease() {
    throw this.error
  }
  async clearProposalLease() {
    throw this.error
  }
}