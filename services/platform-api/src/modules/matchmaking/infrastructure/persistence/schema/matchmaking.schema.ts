import { sql } from 'drizzle-orm'
import { index, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const matchmakingRequests = pgTable(
  'matchmaking_requests',
  {
    requestId: text('request_id').primaryKey(),
    requesterType: text('requester_type').notNull(),
    requesterId: text('requester_id').notNull(),
    gameId: text('game_id').notNull(),
    queueKey: text('queue_key').notNull(),
    queueType: text('queue_type').notNull(),
    platform: text('platform').notNull(),
    region: text('region'),
    gameVersion: text('game_version').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    status: text('status').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'string' }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    matchedAt: timestamp('matched_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    terminalOutcome: text('terminal_outcome'),
    sourceLobbyId: text('source_lobby_id'),
    activeProposalId: text('active_proposal_id'),
  },
  (table) => ({
    activeRequesterUnique: uniqueIndex('matchmaking_requests_active_requester_unique_idx')
      .on(table.requesterType, table.requesterId)
      .where(sql`${table.status} in ('queued', 'proposed')`),
    queueStatusRequestedIdx: index('matchmaking_requests_queue_status_requested_idx').on(
      table.queueKey,
      table.status,
      table.requestedAt,
    ),
    expiryIdx: index('matchmaking_requests_expiry_idx').on(table.expiresAt),
    activeProposalIdx: index('matchmaking_requests_active_proposal_idx').on(table.activeProposalId),
    gameStatusIdx: index('matchmaking_requests_game_status_idx').on(table.gameId, table.status),
  }),
)

export const matchProposals = pgTable(
  'match_proposals',
  {
    proposalId: text('proposal_id').primaryKey(),
    matchId: text('match_id'),
    queueKey: text('queue_key').notNull(),
    gameId: text('game_id').notNull(),
    queueType: text('queue_type').notNull(),
    platform: text('platform').notNull(),
    region: text('region'),
    gameVersion: text('game_version').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    matchedAt: timestamp('matched_at', { withTimezone: true, mode: 'string' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    matchIdUnique: uniqueIndex('match_proposals_match_id_unique_idx').on(table.matchId).where(sql`${table.matchId} is not null`),
    queueStatusIdx: index('match_proposals_queue_status_idx').on(table.queueKey, table.status),
    expiryIdx: index('match_proposals_expiry_idx').on(table.expiresAt),
  }),
)

export const matchProposalMembers = pgTable(
  'match_proposal_members',
  {
    id: serial('id').primaryKey(),
    proposalId: text('proposal_id')
      .notNull()
      .references(() => matchProposals.proposalId, { onDelete: 'cascade' }),
    requestId: text('request_id')
      .notNull()
      .references(() => matchmakingRequests.requestId, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    acceptanceStatus: text('acceptance_status').notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    proposalRequestUnique: uniqueIndex('match_proposal_members_proposal_request_unique_idx').on(table.proposalId, table.requestId),
    requestIdx: index('match_proposal_members_request_idx').on(table.requestId),
    playerIdx: index('match_proposal_members_player_idx').on(table.playerId),
  }),
)