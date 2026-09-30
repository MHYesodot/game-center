import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { afterEach, describe, expect, it } from 'vitest'

import { POSTGRES, REDIS, NATS } from './infrastructure/infrastructure.tokens.js'
import { ReadinessService } from './infrastructure/readiness.service.js'
import { CatalogService } from './modules/catalog/application/catalog.service.js'
import { CATALOG_REPOSITORY, type CatalogRepository } from './modules/catalog/domain/catalog-game.js'
import { CatalogController } from './modules/catalog/transport/catalog.controller.js'
import { HealthController } from './modules/health/health.controller.js'

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

const failingCatalogRepository: CatalogRepository = {
  async listGames() {
    throw dependencyDownError
  },
  async getGameBySlug() {
    throw dependencyDownError
  },
}

@Module({
  controllers: [HealthController, CatalogController],
  providers: [
    ReadinessService,
    CatalogService,
    {
      provide: POSTGRES,
      useValue: {
        async query() {
          throw dependencyDownError
        },
        async end() {},
      },
    },
    {
      provide: REDIS,
      useValue: {
        async ping() {
          return 'PONG'
        },
        async quit() {},
      },
    },
    {
      provide: NATS,
      useValue: {
        async flush() {},
        async drain() {},
      },
    },
    {
      provide: CATALOG_REPOSITORY,
      useValue: failingCatalogRepository,
    },
  ],
})
class CatalogOutageTestModule {}

describe('catalog outage integration', () => {
  it('keeps the process live and returns controlled readiness and catalog failures when Postgres is unavailable', async () => {
    const app = await createTestApplication()
    cleanups.push(() => app.close())

    const baseUrl = await listenOnRandomPort(app)

    const initialLiveResponse = await fetch(`${baseUrl}/health/live`)
    const readyResponse = await fetch(`${baseUrl}/health/ready`)
    const listResponse = await fetch(`${baseUrl}/api/games`)
    const detailResponse = await fetch(`${baseUrl}/api/games/rush-lane`)
    const finalLiveResponse = await fetch(`${baseUrl}/health/live`)

    expect(initialLiveResponse.status).toBe(200)
    expect(finalLiveResponse.status).toBe(200)
    expect(readyResponse.status).toBe(503)
    expect(listResponse.status).toBe(503)
    expect(detailResponse.status).toBe(503)

    const readyPayload = (await readyResponse.json()) as {
      ok: boolean
      service: string
      status: string
      dependencies: Record<string, string>
    }
    const listPayload = (await listResponse.json()) as { code: string }
    const detailPayload = (await detailResponse.json()) as { code: string }

    expect(readyPayload).toEqual({
      ok: false,
      service: 'platform-api',
      status: 'not_ready',
      dependencies: {
        postgres: 'down',
        redis: 'up',
        nats: 'up',
      },
    })
    expect(listPayload).toEqual({ code: 'CATALOG_UNAVAILABLE' })
    expect(detailPayload).toEqual({ code: 'CATALOG_UNAVAILABLE' })
  }, 15_000)
})

async function createTestApplication() {
  const app = await NestFactory.create(CatalogOutageTestModule, {
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