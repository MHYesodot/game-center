import { Inject, Injectable } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'

import type { CreateSessionRecordInput, SessionRepository, SessionRepositoryTransaction } from '../../../application/sessions.ports.js'
import type { DurableGameSession, DurableGameSessionAggregate, DurableSessionParticipant } from '../../../domain/game-session.js'
import { SESSIONS_DRIZZLE_DB, type SessionsDrizzleDatabase } from '../session.persistence.js'
import { gameSessionParticipants, gameSessions } from '../schema/session.schema.js'

type SessionRow = typeof gameSessions.$inferSelect
type SessionParticipantRow = typeof gameSessionParticipants.$inferSelect
type SessionsQueryExecutor = any

@Injectable()
export class PostgresSessionRepository implements SessionRepository {
  constructor(@Inject(SESSIONS_DRIZZLE_DB) private readonly db: SessionsDrizzleDatabase) {}

  async getById(sessionId: string): Promise<DurableGameSessionAggregate | null> {
    return findSessionBy(this.db, eq(gameSessions.sessionId, sessionId))
  }

  async getByMatchId(matchId: string): Promise<DurableGameSessionAggregate | null> {
    return findSessionBy(this.db, eq(gameSessions.matchId, matchId))
  }

  async withTransaction<T>(callback: (transaction: SessionRepositoryTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => callback(new PostgresSessionRepositoryTransaction(transaction)))
  }
}

class PostgresSessionRepositoryTransaction implements SessionRepositoryTransaction {
  constructor(private readonly transaction: SessionsQueryExecutor) {}

  async getById(sessionId: string): Promise<DurableGameSessionAggregate | null> {
    return findSessionBy(this.transaction, eq(gameSessions.sessionId, sessionId))
  }

  async getByIdForUpdate(sessionId: string): Promise<DurableGameSessionAggregate | null> {
    const rows = await this.transaction
      .select({ sessionId: gameSessions.sessionId })
      .from(gameSessions)
      .where(eq(gameSessions.sessionId, sessionId))
      .for('update')
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    return this.getById(sessionId)
  }

  async getByMatchId(matchId: string): Promise<DurableGameSessionAggregate | null> {
    return findSessionBy(this.transaction, eq(gameSessions.matchId, matchId))
  }

  async getByMatchIdForUpdate(matchId: string): Promise<DurableGameSessionAggregate | null> {
    const rows = await this.transaction
      .select({ matchId: gameSessions.matchId })
      .from(gameSessions)
      .where(eq(gameSessions.matchId, matchId))
      .for('update')
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    return this.getByMatchId(matchId)
  }

  async createSession(input: CreateSessionRecordInput): Promise<void> {
    await this.transaction.insert(gameSessions).values(mapSessionInsert(input))
    await this.transaction.insert(gameSessionParticipants).values(input.participants.map(mapParticipantInsert))
  }

  async updateSession(session: DurableGameSession): Promise<void> {
    await this.transaction.update(gameSessions).set(mapSessionInsert(session)).where(eq(gameSessions.sessionId, session.sessionId))
  }
}

async function findSessionBy(executor: SessionsQueryExecutor, whereClause: ReturnType<typeof eq>): Promise<DurableGameSessionAggregate | null> {
  const rows = await executor
    .select({
      session: gameSessions,
      participant: gameSessionParticipants,
    })
    .from(gameSessions)
    .leftJoin(gameSessionParticipants, eq(gameSessions.sessionId, gameSessionParticipants.sessionId))
    .where(whereClause)
    .orderBy(asc(gameSessionParticipants.id))

  if (rows.length === 0) {
    return null
  }

  return mapSessionRows(
    rows.map((row: { session: SessionRow; participant: SessionParticipantRow | null }) => ({
      session: row.session,
      participant: row.participant,
    })),
  )
}

function mapSessionRows(rows: Array<{ session: SessionRow; participant: SessionParticipantRow | null }>): DurableGameSessionAggregate {
  const [first] = rows
  return {
    sessionId: first.session.sessionId,
    sourceKind: first.session.sourceKind as DurableGameSession['sourceKind'],
    matchId: first.session.matchId,
    proposalId: first.session.proposalId,
    gameId: first.session.gameId,
    queueType: first.session.queueType as DurableGameSession['queueType'],
    platform: first.session.platform as DurableGameSession['platform'],
    region: first.session.region,
    gameVersion: first.session.gameVersion,
    protocolVersion: first.session.protocolVersion,
    status: first.session.status as DurableGameSession['status'],
    createdAt: first.session.createdAt,
    updatedAt: first.session.updatedAt,
    startedAt: first.session.startedAt,
    completedAt: first.session.completedAt,
    failedAt: first.session.failedAt,
    cancelledAt: first.session.cancelledAt,
    expiresAt: first.session.expiresAt,
    failureCode: first.session.failureCode as DurableGameSession['failureCode'],
    participants: rows
      .map((row) => row.participant)
      .filter((participant): participant is SessionParticipantRow => participant !== null)
      .map((participant) => ({
        sessionId: participant.sessionId,
        playerId: participant.playerId,
        sourceRequestId: participant.sourceRequestId,
        sourceLobbyId: participant.sourceLobbyId,
        joinedAt: participant.joinedAt,
      })),
  }
}

function mapSessionInsert(session: DurableGameSession) {
  return {
    sessionId: session.sessionId,
    sourceKind: session.sourceKind,
    matchId: session.matchId,
    proposalId: session.proposalId,
    gameId: session.gameId,
    queueType: session.queueType,
    platform: session.platform,
    region: session.region,
    gameVersion: session.gameVersion,
    protocolVersion: session.protocolVersion,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    failedAt: session.failedAt,
    cancelledAt: session.cancelledAt,
    expiresAt: session.expiresAt,
    failureCode: session.failureCode,
  }
}

function mapParticipantInsert(participant: DurableSessionParticipant) {
  return {
    sessionId: participant.sessionId,
    playerId: participant.playerId,
    sourceRequestId: participant.sourceRequestId,
    sourceLobbyId: participant.sourceLobbyId,
    joinedAt: participant.joinedAt,
  }
}