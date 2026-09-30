import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const catalogGames = pgTable(
  'catalog_games',
  {
    gameId: text('game_id').primaryKey(),
    slug: text('slug').notNull(),
    status: text('status').notNull(),
    category: text('category').notNull(),
    categoryKey: text('category_key').notNull(),
    displayNameKey: text('display_name_key').notNull(),
    descriptionKey: text('description_key').notNull(),
    taglineKey: text('tagline_key').notNull(),
    tags: text('tags').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex('catalog_games_slug_idx').on(table.slug),
  }),
)

export const catalogGameVersions = pgTable(
  'catalog_game_versions',
  {
    id: serial('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => catalogGames.gameId, { onDelete: 'cascade' }),
    gameVersion: text('game_version').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    buildVersion: text('build_version').notNull(),
    clientRuntime: text('client_runtime').notNull(),
    engine: text('engine').notNull(),
    serverType: text('server_type').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => ({
    versionTupleUnique: uniqueIndex('catalog_game_versions_tuple_idx').on(
      table.gameId,
      table.gameVersion,
      table.protocolVersion,
      table.buildVersion,
    ),
    activeVersionPerGameUnique: uniqueIndex('catalog_game_versions_active_idx')
      .on(table.gameId)
      .where(sql`${table.isActive} = true`),
  }),
)

export const catalogGameCapabilities = pgTable('catalog_game_capabilities', {
  versionId: integer('version_id')
    .primaryKey()
    .references(() => catalogGameVersions.id, { onDelete: 'cascade' }),
  multiplayer: boolean('multiplayer').notNull(),
  ranked: boolean('ranked').notNull(),
  spectators: boolean('spectators').notNull(),
  replays: boolean('replays').notNull(),
  privateRooms: boolean('private_rooms').notNull(),
})

export const catalogGamePlatformAvailability = pgTable('catalog_game_platform_availability', {
  versionId: integer('version_id')
    .primaryKey()
    .references(() => catalogGameVersions.id, { onDelete: 'cascade' }),
  web: boolean('web').notNull(),
  windows: boolean('windows').notNull(),
  macos: boolean('macos').notNull(),
  android: boolean('android').notNull(),
  ios: boolean('ios').notNull(),
  ipados: boolean('ipados').notNull(),
})

export const catalogGameDistributionMetadata = pgTable('catalog_game_distribution_metadata', {
  versionId: integer('version_id')
    .primaryKey()
    .references(() => catalogGameVersions.id, { onDelete: 'cascade' }),
  minimumVersion: text('minimum_version'),
  downloadStrategy: text('download_strategy'),
  launchStrategy: text('launch_strategy'),
  architecture: text('architecture'),
})