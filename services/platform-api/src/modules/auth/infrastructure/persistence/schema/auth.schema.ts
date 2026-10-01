import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const authAccounts = pgTable(
  'auth_accounts',
  {
    playerId: text('player_id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex('auth_accounts_email_unique_idx').on(table.email),
  }),
)

export const authSessions = pgTable(
  'auth_sessions',
  {
    sessionId: text('session_id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => authAccounts.playerId, { onDelete: 'cascade' }),
    secretHash: text('secret_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    playerIdx: index('auth_sessions_player_idx').on(table.playerId),
    expiryIdx: index('auth_sessions_expiry_idx').on(table.expiresAt),
  }),
)

export const authRealtimeTickets = pgTable(
  'auth_realtime_tickets',
  {
    ticketId: text('ticket_id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => authSessions.sessionId, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => authAccounts.playerId, { onDelete: 'cascade' }),
    secretHash: text('secret_hash').notNull(),
    clientType: text('client_type').notNull(),
    clientVersion: text('client_version').notNull(),
    platform: text('platform').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    sessionIdx: index('auth_realtime_tickets_session_idx').on(table.sessionId),
    playerIdx: index('auth_realtime_tickets_player_idx').on(table.playerId),
    expiryIdx: index('auth_realtime_tickets_expiry_idx').on(table.expiresAt),
  }),
)