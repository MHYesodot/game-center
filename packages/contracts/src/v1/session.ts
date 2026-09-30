import type { MatchmakingPlatform, MatchmakingQueueType } from './matchmaking.js'

export type SessionStatus =
  | 'created'
  | 'allocating'
  | 'ready'
  | 'connecting'
  | 'active'
  | 'completing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'

export type SessionFailureCode = 'ALLOCATION_REQUEST_FAILED'

export type SessionSource = {
  kind: 'matchmaking'
  matchId: string
  proposalId: string
}

export type SessionParticipant = {
  playerId: string
  sourceRequestId: string
  sourceLobbyId: string | null
  joinedAt: string
}

export type GameSession = {
  sessionId: string
  source: SessionSource
  gameId: string
  queueType: MatchmakingQueueType
  platform: MatchmakingPlatform
  region: string | null
  gameVersion: string
  protocolVersion: string
  status: SessionStatus
  participants: SessionParticipant[]
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  expiresAt: string | null
  failureCode: SessionFailureCode | null
}

export type CreateSessionRequest = {
  matchId: string
}

export type SessionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'MATCH_NOT_READY'
  | 'SESSION_INVALID_STATE'
  | 'SESSION_EXPIRED'
  | 'SESSION_CREATION_FAILED'
  | 'SESSION_UNAVAILABLE'
  | 'INVALID_PLAYER_ID'

export type SessionErrorResponse = {
  code: SessionErrorCode
}