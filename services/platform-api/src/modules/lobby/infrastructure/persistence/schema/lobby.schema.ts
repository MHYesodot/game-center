import type { LobbyConfiguration } from '@game-center/contracts'
import { sql } from 'drizzle-orm'
import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const lobbies = pgTable(
  'lobbies',
  {
    lobbyId: text('lobby_id').primaryKey(),
    gameId: text('game_id').notNull(),
    ownerPlayerId: text('owner_player_id').notNull(),
    status: text('status').notNull(),
    visibility: text('visibility').notNull(),
    capacity: integer('capacity').notNull(),
    minimumPlayers: integer('minimum_players').notNull(),
    configuration: jsonb('configuration').$type<LobbyConfiguration>().notNull(),
    joinCodeHash: text('join_code_hash'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    gameStatusIdx: index('lobbies_game_status_idx').on(table.gameId, table.status),
    ownerIdx: index('lobbies_owner_idx').on(table.ownerPlayerId),
    statusIdx: index('lobbies_status_idx').on(table.status),
    expiryIdx: index('lobbies_expiry_idx').on(table.expiresAt),
  }),
)

export const lobbyMembers = pgTable(
  'lobby_members',
  {
    id: serial('id').primaryKey(),
    lobbyId: text('lobby_id')
      .notNull()
      .references(() => lobbies.lobbyId, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    role: text('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).notNull(),
    leftAt: timestamp('left_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    activeMembershipUnique: uniqueIndex('lobby_members_active_unique_idx')
      .on(table.lobbyId, table.playerId)
      .where(sql`${table.leftAt} is null`),
    activeOwnerUnique: uniqueIndex('lobby_members_active_owner_unique_idx')
      .on(table.lobbyId)
      .where(sql`${table.leftAt} is null and ${table.role} = 'owner'`),
    lobbyMembershipIdx: index('lobby_members_lobby_joined_idx').on(table.lobbyId, table.joinedAt),
    playerMembershipIdx: index('lobby_members_player_idx').on(table.playerId),
  }),
)