import 'reflect-metadata'

import { Module, RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { afterEach, describe, expect, it } from 'vitest'

import { InfrastructureModule } from '../../../infrastructure/infrastructure.module.js'
import { validateEnv } from '../../../infrastructure/config/env.schema.js'
import { CatalogModule } from '../catalog.module.js'
import {
  createCatalogDatabase,
  createCatalogPool,
  migrateCatalogDatabase,
  seedCatalogReferenceDataWithClient,
} from '../infrastructure/persistence/catalog.persistence.js'
import { createIsolatedCatalogDatabase } from '../infrastructure/persistence/catalog.persistence.test-helpers.js'

const baseConnectionString = process.env.POSTGRES_URL

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for catalog API integration tests.')
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    InfrastructureModule,
    CatalogModule,
  ],
})
class CatalogApiTestModule {}

describe('catalog http integration', () => {
  it('serves list, detail, and semantic not-found responses from the catalog API', async () => {
    const database = await createIsolatedCatalogDatabase(baseConnectionString)
    cleanups.push(database.cleanup)

    await migrateCatalogDatabase(database.connectionString)

    const pool = createCatalogPool(database.connectionString)

    try {
      const db = createCatalogDatabase(pool)
      await seedCatalogReferenceDataWithClient(db)

      const app = await createTestApplication(database.connectionString)
      cleanups.push(() => app.close())

      const baseUrl = await listenOnRandomPort(app)

      const listResponse = await fetch(`${baseUrl}/api/games`)
      const detailResponse = await fetch(`${baseUrl}/api/games/rush-lane`)
      const missingResponse = await fetch(`${baseUrl}/api/games/not-a-real-game`)

      expect(listResponse.status).toBe(200)
      expect(detailResponse.status).toBe(200)
      expect(missingResponse.status).toBe(404)

      const listPayload = (await listResponse.json()) as { games: Array<{ slug: string }> }
      const detailPayload = (await detailResponse.json()) as {
        slug: string
        manifest: { version: { protocolVersion: string } }
      }
      const missingPayload = (await missingResponse.json()) as { code: string }

      expect(listPayload.games.map((game) => game.slug)).toEqual(['aether-flight', 'rush-lane', 'signal-grid'])
      expect(detailPayload.slug).toBe('rush-lane')
      expect(detailPayload.manifest.version.protocolVersion).toBe('v1')
      expect(missingPayload).toEqual({ code: 'CATALOG_GAME_NOT_FOUND' })
    } finally {
      await pool.end()
    }
  }, 15_000)
})

async function createTestApplication(connectionString: string) {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_URL: process.env.POSTGRES_URL,
    REDIS_URL: process.env.REDIS_URL,
    NATS_URL: process.env.NATS_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    PORT: process.env.PORT,
  }

  process.env.NODE_ENV = 'test'
  process.env.POSTGRES_URL = connectionString
  delete process.env.REDIS_URL
  delete process.env.NATS_URL
  process.env.CORS_ORIGIN = 'http://127.0.0.1:0'
  process.env.PORT = '0'

  cleanups.push(async () => {
    restoreEnvironment(previousEnvironment)
  })

  const app = await NestFactory.create(CatalogApiTestModule, {
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

function restoreEnvironment(previousEnvironment: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}