import { translate } from '@game-center/i18n'
import { afterEach, describe, expect, it } from 'vitest'

import { catalogReferenceGames } from './catalog.reference-data.js'
import {
  createCatalogDatabase,
  createCatalogPool,
  migrateCatalogDatabase,
  seedCatalogReferenceDataWithClient,
} from './catalog.persistence.js'
import { createIsolatedCatalogDatabase } from './catalog.persistence.test-helpers.js'
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
    const database = await createIsolatedCatalogDatabase(baseConnectionString)
    cleanups.push(database.cleanup)

    await migrateCatalogDatabase(database.connectionString)

    const pool = createCatalogPool(database.connectionString)

    try {
      const db = createCatalogDatabase(pool)
      await seedCatalogReferenceDataWithClient(db)

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

  it('returns a domain projection from getGameBySlug instead of a raw persistence row', async () => {
    const database = await createIsolatedCatalogDatabase(baseConnectionString)
    cleanups.push(database.cleanup)

    await migrateCatalogDatabase(database.connectionString)

    const pool = createCatalogPool(database.connectionString)

    try {
      const db = createCatalogDatabase(pool)
      await seedCatalogReferenceDataWithClient(db)

      const repository = new PostgresCatalogRepository(db)
      const game = await repository.getGameBySlug('rush-lane')

      expect(game).not.toBeNull()
      expect(game?.definition.slug).toBe('rush-lane')
      expect(game?.activeVersion.platforms.android).toBe(true)
      expect(game?.activeVersion.capabilities.privateRooms).toBe(true)
      expect(game && 'game' in (game as unknown as Record<string, unknown>)).toBe(false)
      expect(game && 'version' in (game as unknown as Record<string, unknown>)).toBe(false)
    } finally {
      await pool.end()
    }
  })

  it('seeds catalog data idempotently', async () => {
    const database = await createIsolatedCatalogDatabase(baseConnectionString)
    cleanups.push(database.cleanup)

    await migrateCatalogDatabase(database.connectionString)

    const pool = createCatalogPool(database.connectionString)

    try {
      const db = createCatalogDatabase(pool)
      await seedCatalogReferenceDataWithClient(db)
      await seedCatalogReferenceDataWithClient(db)

      const gamesCount = await pool.query<{ count: string }>('select count(*)::int as count from catalog_games')
      const versionsCount = await pool.query<{ count: string }>('select count(*)::int as count from catalog_game_versions')
      const activeVersionsCount = await pool.query<{ count: string }>(
        'select count(*)::int as count from catalog_game_versions where is_active = true',
      )

      expect(Number(gamesCount.rows[0]?.count ?? 0)).toBe(catalogReferenceGames.length)
      expect(Number(versionsCount.rows[0]?.count ?? 0)).toBe(catalogReferenceGames.length)
      expect(Number(activeVersionsCount.rows[0]?.count ?? 0)).toBe(catalogReferenceGames.length)
    } finally {
      await pool.end()
    }
  })

  it('validates seeded translation keys in english and hebrew', () => {
    for (const game of catalogReferenceGames) {
      for (const locale of ['en', 'he'] as const) {
        expect(translate(locale, game.definition.categoryKey)).toBeTruthy()
        expect(translate(locale, game.definition.displayNameKey)).toBeTruthy()
        expect(translate(locale, game.definition.descriptionKey)).toBeTruthy()
        expect(translate(locale, game.definition.taglineKey)).toBeTruthy()
      }
    }
  })
})
