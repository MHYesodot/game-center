import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

const gameSessionsReference = pgTable('game_sessions', {
  sessionId: text('session_id').notNull(),
})

export const gameServerAllocations = pgTable(
  'game_server_allocations',
  {
    allocationId: text('allocation_id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSessionsReference.sessionId, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerReference: text('provider_reference'),
    status: text('status').notNull(),
    gameId: text('game_id').notNull(),
    gameVersion: text('game_version').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    buildVersion: text('build_version').notNull(),
    serverType: text('server_type').notNull(),
    runtimeType: text('runtime_type').notNull(),
    runtimeProfile: text('runtime_profile').notNull(),
    region: text('region'),
    participantCapacity: integer('participant_capacity').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'string' }).notNull(),
    provisioningAt: timestamp('provisioning_at', { withTimezone: true, mode: 'string' }),
    readyAt: timestamp('ready_at', { withTimezone: true, mode: 'string' }),
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'string' }),
    releasingAt: timestamp('releasing_at', { withTimezone: true, mode: 'string' }),
    releasedAt: timestamp('released_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    failureCode: text('failure_code'),
    connectionTransport: text('connection_transport'),
    connectionHost: text('connection_host'),
    connectionPort: integer('connection_port'),
    connectionSecure: boolean('connection_secure'),
    connectionProtocolVersion: text('connection_protocol_version'),
    connectionTokenReference: text('connection_token_reference'),
    connectionExpiresAt: timestamp('connection_expires_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    sessionIdx: index('game_server_allocations_session_idx').on(table.sessionId),
    statusIdx: index('game_server_allocations_status_idx').on(table.status),
    expiryIdx: index('game_server_allocations_expiry_idx').on(table.expiresAt),
    activeSessionUnique: uniqueIndex('game_server_allocations_active_session_unique_idx')
      .on(table.sessionId)
      .where(sql`${table.status} in ('requested', 'provisioning', 'ready', 'releasing')`),
    providerReferenceUnique: uniqueIndex('game_server_allocations_provider_reference_unique_idx')
      .on(table.provider, table.providerReference)
      .where(sql`${table.providerReference} is not null`),
  }),
)