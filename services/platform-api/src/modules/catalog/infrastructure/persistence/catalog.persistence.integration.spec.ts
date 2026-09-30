import { randomUUID } from 'node:crypto'

import { translate } from '@game-center/i18n'
import { Client } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'

import { catalogSeedGames } from './catalog.seed-data.js'
import {
  createCatalogDatabase,
  createCatalogPool,
  migrateCatalogDatabase,
  seedCatalogDatabaseWithClient,
} from './catalog.persistence.js'
import { PostgresCatalogRepository } from './repositories/postgres-catalog.repository.js'

const baseConnectionString = process.env.POSTGRES_URL

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for catalog integration tests.')
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

describe('catalog persistence integration', () => {
  it('migrates from an empty database and returns the seeded catalog', async () => {
    const database = await createIsolatedDatabase(baseConnectionString)
    cleanups.push(database.cleanup)

    await migrateCatalogDatabase(database.connectionString)

    const pool = createCatalogPool(database.connectionString)

    try {
      const db = createCatalogDatabase(pool)
      await seedCatalogDatabaseWithClient(db)

      const repository = new PostgresCatalogRepository(db)
      const games = await repository.listGames()
      const signalGrid = await repository.getGameBySlug('signal-grid')

      expect(games.map((game) => game.definition.slug)).toEqual(['aether-flight', 'rush-lane', 'signal-grid'])
      expect(signalGrid?.activeVersion.runtime.engine).toBe('prototype-dom')
      expect(signalGrid?.activeVersion.distribution.downloadStrategy).toBe('browser')
    } finally {
      await pool.end()
    }
  })

  it('seeds catalog data idempotently', async () => {
    const database = await createIsolatedDatabase(baseConnectionString)
    cleanups.push(database.cleanup)

    await migrateCatalogDatabase(database.connectionString)

    const pool = createCatalogPool(database.connectionString)

    try {
      const db = createCatalogDatabase(pool)
      await seedCatalogDatabaseWithClient(db)
      await seedCatalogDatabaseWithClient(db)

      const gamesCount = await pool.query<{ count: string }>('select count(*)::int as count from catalog_games')
      const versionsCount = await pool.query<{ count: string }>('select count(*)::int as count from catalog_game_versions')
      const activeVersionsCount = await pool.query<{ count: string }>(
        'select count(*)::int as count from catalog_game_versions where is_active = true',
      )

      expect(Number(gamesCount.rows[0]?.count ?? 0)).toBe(catalogSeedGames.length)
      expect(Number(versionsCount.rows[0]?.count ?? 0)).toBe(catalogSeedGames.length)
      expect(Number(activeVersionsCount.rows[0]?.count ?? 0)).toBe(catalogSeedGames.length)
    } finally {
      await pool.end()
    }
  })

  it('validates seeded translation keys in english and hebrew', () => {
    for (const game of catalogSeedGames) {
      for (const locale of ['en', 'he'] as const) {
        expect(translate(locale, game.definition.categoryKey)).toBeTruthy()
        expect(translate(locale, game.definition.displayNameKey)).toBeTruthy()
        expect(translate(locale, game.definition.descriptionKey)).toBeTruthy()
        expect(translate(locale, game.definition.taglineKey)).toBeTruthy()
      }
    }
  })
})

async function createIsolatedDatabase(connectionString: string) {
  const databaseName = `catalog_test_${randomUUID().replace(/-/g, '')}`
  const adminConnectionString = withDatabaseName(connectionString, 'postgres')
  const databaseConnectionString = withDatabaseName(connectionString, databaseName)

  const adminClient = new Client({ connectionString: adminConnectionString })
  await adminClient.connect()

  try {
    await adminClient.query(`create database "${databaseName}"`)
  } finally {
    await adminClient.end()
  }

  return {
    connectionString: databaseConnectionString,
    cleanup: async () => {
      const cleanupClient = new Client({ connectionString: adminConnectionString })
      await cleanupClient.connect()

      try {
        await cleanupClient.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
          [databaseName],
        )
        await cleanupClient.query(`drop database if exists "${databaseName}"`)
      } finally {
        await cleanupClient.end()
      }
    },
  }
}

function withDatabaseName(connectionString: string, databaseName: string) {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}