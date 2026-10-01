import type { GameServerAllocation, SessionFailureCode } from '@game-center/contracts'

import type { SessionAllocationCommand } from '../../../boundaries/session-allocation-orchestrator.js'

import type { DurableGameSession, DurableGameSessionAggregate, DurableSessionParticipant } from '../domain/game-session.js'

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY')
export const SESSION_ALLOCATION_PORT = Symbol('SESSION_ALLOCATION_PORT')

export type CreateSessionRecordInput = DurableGameSession & {
  participants: DurableSessionParticipant[]
}

export type SessionAllocationRequest = SessionAllocationCommand

export interface SessionRepositoryTransaction {
  getById(sessionId: string): Promise<DurableGameSessionAggregate | null>
  getByIdForUpdate(sessionId: string): Promise<DurableGameSessionAggregate | null>
  getByMatchId(matchId: string): Promise<DurableGameSessionAggregate | null>
  getByMatchIdForUpdate(matchId: string): Promise<DurableGameSessionAggregate | null>
  createSession(input: CreateSessionRecordInput): Promise<void>
  updateSession(session: DurableGameSession): Promise<void>
}

export interface SessionRepository {
  getById(sessionId: string): Promise<DurableGameSessionAggregate | null>
  getByMatchId(matchId: string): Promise<DurableGameSessionAggregate | null>
  withTransaction<T>(callback: (transaction: SessionRepositoryTransaction) => Promise<T>): Promise<T>
}

export interface SessionAllocationPort {
  requestAllocation(input: SessionAllocationRequest): Promise<GameServerAllocation>
  getAllocation(sessionId: string): Promise<GameServerAllocation | null>
  releaseAllocation(sessionId: string): Promise<GameServerAllocation | null>
}

export type SessionFailureTransition = {
  failureCode: SessionFailureCode
  failedAt: string
}