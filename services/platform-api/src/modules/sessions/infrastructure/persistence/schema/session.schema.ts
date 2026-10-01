import { index, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const gameSessions = pgTable(
  'game_sessions',
  {
    sessionId: text('session_id').primaryKey(),
    sourceKind: text('source_kind').notNull(),
    matchId: text('match_id').notNull(),
    proposalId: text('proposal_id').notNull(),
    gameId: text('game_id').notNull(),
    queueType: text('queue_type').notNull(),
    platform: text('platform').notNull(),
    region: text('region'),
    gameVersion: text('game_version').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'string' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    failureCode: text('failure_code'),
  },
  (table) => ({
    matchUnique: uniqueIndex('game_sessions_match_id_unique_idx').on(table.matchId),
    proposalUnique: uniqueIndex('game_sessions_proposal_id_unique_idx').on(table.proposalId),
    statusIdx: index('game_sessions_status_idx').on(table.status),
    expiryIdx: index('game_sessions_expiry_idx').on(table.expiresAt),
    gameStatusIdx: index('game_sessions_game_status_idx').on(table.gameId, table.status),
  }),
)

export const gameSessionParticipants = pgTable(
  'game_session_participants',
  {
    id: serial('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSessions.sessionId, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    sourceRequestId: text('source_request_id').notNull(),
    sourceLobbyId: text('source_lobby_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => ({
    sessionPlayerUnique: uniqueIndex('game_session_participants_session_player_unique_idx').on(table.sessionId, table.playerId),
    sessionRequestUnique: uniqueIndex('game_session_participants_session_request_unique_idx').on(table.sessionId, table.sourceRequestId),
    sessionIdx: index('game_session_participants_session_idx').on(table.sessionId),
    playerIdx: index('game_session_participants_player_idx').on(table.playerId),
    sourceLobbyIdx: index('game_session_participants_source_lobby_idx').on(table.sourceLobbyId),
  }),
)