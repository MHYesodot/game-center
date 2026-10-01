import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'

import type {
  AuthRepository,
  AuthRepositoryTransaction,
  RealtimeTicketRecord,
  SessionAccountRecord,
} from '../../../application/auth.ports.js'
import type { DurableAuthSession, DurablePlayerAccount, DurableRealtimeTicket } from '../../../domain/auth-records.js'
import { AUTH_DRIZZLE_DB, type AuthDrizzleDatabase } from '../auth.persistence.js'
import { authAccounts, authRealtimeTickets, authSessions } from '../schema/auth.schema.js'

type AuthQueryExecutor = any
type AccountRow = typeof authAccounts.$inferSelect
type SessionRow = typeof authSessions.$inferSelect
type TicketRow = typeof authRealtimeTickets.$inferSelect

@Injectable()
export class PostgresAuthRepository implements AuthRepository {
  constructor(@Inject(AUTH_DRIZZLE_DB) private readonly db: AuthDrizzleDatabase) {}

  async getAccountByEmail(email: string): Promise<DurablePlayerAccount | null> {
    const rows = await this.db.select().from(authAccounts).where(eq(authAccounts.email, email)).limit(1)
    return rows[0] ? mapAccount(rows[0]) : null
  }

  async getSessionAccountById(sessionId: string): Promise<SessionAccountRecord | null> {
    const rows = await this.db
      .select({ session: authSessions, account: authAccounts })
      .from(authSessions)
      .innerJoin(authAccounts, eq(authSessions.playerId, authAccounts.playerId))
      .where(eq(authSessions.sessionId, sessionId))
      .limit(1)

    const row = rows[0]
    if (!row) {
      return null
    }

    return mapSessionAccount(row.session, row.account)
  }

  async getRealtimeTicketById(ticketId: string): Promise<RealtimeTicketRecord | null> {
    const rows = await this.db
      .select({ ticket: authRealtimeTickets, session: authSessions })
      .from(authRealtimeTickets)
      .innerJoin(authSessions, eq(authRealtimeTickets.sessionId, authSessions.sessionId))
      .where(eq(authRealtimeTickets.ticketId, ticketId))
      .limit(1)

    const row = rows[0]
    if (!row) {
      return null
    }

    return mapRealtimeTicket(row.ticket, row.session)
  }

  async withTransaction<T>(callback: (transaction: AuthRepositoryTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => callback(new PostgresAuthRepositoryTransaction(transaction)))
  }
}

class PostgresAuthRepositoryTransaction implements AuthRepositoryTransaction {
  constructor(private readonly transaction: AuthQueryExecutor) {}

  async createAccount(account: DurablePlayerAccount): Promise<void> {
    await this.transaction.insert(authAccounts).values(account)
  }

  async createSession(session: DurableAuthSession): Promise<void> {
    await this.transaction.insert(authSessions).values(session)
  }

  async createRealtimeTicket(ticket: DurableRealtimeTicket): Promise<void> {
    await this.transaction.insert(authRealtimeTickets).values(ticket)
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<void> {
    await this.transaction.update(authSessions).set({ revokedAt }).where(eq(authSessions.sessionId, sessionId))
  }

  async touchSession(sessionId: string, lastSeenAt: string): Promise<void> {
    await this.transaction.update(authSessions).set({ lastSeenAt }).where(eq(authSessions.sessionId, sessionId))
  }

  async markRealtimeTicketUsed(ticketId: string, usedAt: string): Promise<boolean> {
    const result = await this.transaction
      .update(authRealtimeTickets)
      .set({ usedAt })
      .where(and(eq(authRealtimeTickets.ticketId, ticketId), isNull(authRealtimeTickets.usedAt)))
      .returning({ ticketId: authRealtimeTickets.ticketId })

    return result.length > 0
  }
}

function mapAccount(row: AccountRow): DurablePlayerAccount {
  return {
    playerId: row.playerId,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapSessionAccount(session: SessionRow, account: AccountRow): SessionAccountRecord {
  return {
    sessionId: session.sessionId,
    playerId: session.playerId,
    secretHash: session.secretHash,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    email: account.email,
  }
}

function mapRealtimeTicket(ticket: TicketRow, session: SessionRow): RealtimeTicketRecord {
  return {
    ticketId: ticket.ticketId,
    sessionId: ticket.sessionId,
    playerId: ticket.playerId,
    secretHash: ticket.secretHash,
    clientType: ticket.clientType,
    clientVersion: ticket.clientVersion,
    platform: ticket.platform,
    createdAt: ticket.createdAt,
    expiresAt: ticket.expiresAt,
    usedAt: ticket.usedAt,
    sessionExpiresAt: session.expiresAt,
    sessionRevokedAt: session.revokedAt,
  }
}