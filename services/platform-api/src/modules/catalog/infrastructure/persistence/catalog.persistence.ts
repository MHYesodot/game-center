import { fileURLToPath } from 'node:url'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'

import type { CatalogGame } from '../../domain/catalog-game.js'

import { catalogSeedGames } from './catalog.seed-data.js'
import {
  catalogGameCapabilities,
  catalogGameDistributionMetadata,
  catalogGamePlatformAvailability,
  catalogGameVersions,
  catalogGames,
} from './schema/catalog.schema.js'

import * as catalogSchema from './schema/catalog.schema.js'

export const CATALOG_DRIZZLE_DB = Symbol('CATALOG_DRIZZLE_DB')

export type CatalogDrizzleDatabase = NodePgDatabase<typeof catalogSchema>

export const catalogMigrationsFolder = fileURLToPath(new URL('../../../../../drizzle', import.meta.url))

export function createCatalogPool(connectionString: string) {
  return new Pool({ connectionString })
}

export function createCatalogDatabase(pool: Pool): CatalogDrizzleDatabase {
  return drizzle(pool, { schema: catalogSchema })
}

export async function migrateCatalogDatabase(connectionString: string) {
  const pool = createCatalogPool(connectionString)

  try {
    await migrate(createCatalogDatabase(pool), {
      migrationsFolder: catalogMigrationsFolder,
    })
  } finally {
    await pool.end()
  }
}

export async function seedCatalogDatabase(connectionString: string) {
  const pool = createCatalogPool(connectionString)

  try {
    await seedCatalogDatabaseWithClient(createCatalogDatabase(pool))
  } finally {
    await pool.end()
  }
}

export async function seedCatalogDatabaseWithClient(db: CatalogDrizzleDatabase, games = catalogSeedGames) {
  for (const game of games) {
    await upsertCatalogGame(db, game)
  }
}

async function upsertCatalogGame(db: CatalogDrizzleDatabase, game: CatalogGame) {
  const { definition, activeVersion } = game

  await db
    .insert(catalogGames)
    .values({
      gameId: definition.gameId,
      slug: definition.slug,
      status: definition.status,
      category: definition.category,
      categoryKey: definition.categoryKey,
      displayNameKey: definition.displayNameKey,
      descriptionKey: definition.descriptionKey,
      taglineKey: definition.taglineKey,
      tags: definition.tags,
    })
    .onConflictDoUpdate({
      target: catalogGames.gameId,
      set: {
        slug: definition.slug,
        status: definition.status,
        category: definition.category,
        categoryKey: definition.categoryKey,
        displayNameKey: definition.displayNameKey,
        descriptionKey: definition.descriptionKey,
        taglineKey: definition.taglineKey,
        tags: definition.tags,
        updatedAt: new Date().toISOString(),
      },
    })

  const [version] = await db
    .insert(catalogGameVersions)
    .values({
      gameId: definition.gameId,
      gameVersion: activeVersion.gameVersion,
      protocolVersion: activeVersion.protocolVersion,
      buildVersion: activeVersion.buildVersion,
      clientRuntime: activeVersion.runtime.clientRuntime,
      engine: activeVersion.runtime.engine,
      serverType: activeVersion.runtime.serverType,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [
        catalogGameVersions.gameId,
        catalogGameVersions.gameVersion,
        catalogGameVersions.protocolVersion,
        catalogGameVersions.buildVersion,
      ],
      set: {
        clientRuntime: activeVersion.runtime.clientRuntime,
        engine: activeVersion.runtime.engine,
        serverType: activeVersion.runtime.serverType,
        isActive: true,
      },
    })
    .returning({ id: catalogGameVersions.id })

  await db
    .update(catalogGameVersions)
    .set({ isActive: false })
    .where(eq(catalogGameVersions.gameId, definition.gameId))

  await db
    .update(catalogGameVersions)
    .set({ isActive: true })
    .where(eq(catalogGameVersions.id, version.id))

  await db
    .insert(catalogGameCapabilities)
    .values({
      versionId: version.id,
      multiplayer: activeVersion.capabilities.multiplayer,
      ranked: activeVersion.capabilities.ranked,
      spectators: activeVersion.capabilities.spectators,
      replays: activeVersion.capabilities.replays,
      privateRooms: activeVersion.capabilities.privateRooms,
    })
    .onConflictDoUpdate({
      target: catalogGameCapabilities.versionId,
      set: {
        multiplayer: activeVersion.capabilities.multiplayer,
        ranked: activeVersion.capabilities.ranked,
        spectators: activeVersion.capabilities.spectators,
        replays: activeVersion.capabilities.replays,
        privateRooms: activeVersion.capabilities.privateRooms,
      },
    })

  await db
    .insert(catalogGamePlatformAvailability)
    .values({
      versionId: version.id,
      web: activeVersion.platforms.web,
      windows: activeVersion.platforms.windows,
      macos: activeVersion.platforms.macos,
      android: activeVersion.platforms.android,
      ios: activeVersion.platforms.ios,
      ipados: activeVersion.platforms.ipados,
    })
    .onConflictDoUpdate({
      target: catalogGamePlatformAvailability.versionId,
      set: {
        web: activeVersion.platforms.web,
        windows: activeVersion.platforms.windows,
        macos: activeVersion.platforms.macos,
        android: activeVersion.platforms.android,
        ios: activeVersion.platforms.ios,
        ipados: activeVersion.platforms.ipados,
      },
    })

  await db
    .insert(catalogGameDistributionMetadata)
    .values({
      versionId: version.id,
      minimumVersion: activeVersion.distribution.minimumVersion,
      downloadStrategy: activeVersion.distribution.downloadStrategy,
      launchStrategy: activeVersion.distribution.launchStrategy,
      architecture: activeVersion.distribution.architecture,
    })
    .onConflictDoUpdate({
      target: catalogGameDistributionMetadata.versionId,
      set: {
        minimumVersion: activeVersion.distribution.minimumVersion,
        downloadStrategy: activeVersion.distribution.downloadStrategy,
        launchStrategy: activeVersion.distribution.launchStrategy,
        architecture: activeVersion.distribution.architecture,
      },
    })
}