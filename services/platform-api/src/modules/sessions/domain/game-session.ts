import type { MatchmakingPlatform, MatchmakingQueueType, SessionFailureCode, SessionStatus } from '@game-center/contracts'

export const SESSION_EXPIRY_WINDOW_MS = 15 * 60 * 1000

export type DurableSessionParticipant = {
  sessionId: string
  playerId: string
  sourceRequestId: string
  sourceLobbyId: string | null
  joinedAt: string
}

export type DurableGameSession = {
  sessionId: string
  sourceKind: 'matchmaking'
  matchId: string
  proposalId: string
  gameId: string
  queueType: MatchmakingQueueType
  platform: MatchmakingPlatform
  region: string | null
  gameVersion: string
  protocolVersion: string
  status: SessionStatus
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  expiresAt: string | null
  failureCode: SessionFailureCode | null
}

export type DurableGameSessionAggregate = DurableGameSession & {
  participants: DurableSessionParticipant[]
}

const sessionTransitions: Record<SessionStatus, SessionStatus[]> = {
  created: ['allocating', 'cancelled', 'expired', 'failed'],
  allocating: ['ready', 'cancelled', 'expired', 'failed'],
  ready: ['connecting', 'cancelled', 'expired', 'failed'],
  connecting: ['active', 'cancelled', 'expired', 'failed'],
  active: ['completing', 'failed'],
  completing: ['completed', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
}

export function canTransitionSession(from: SessionStatus, to: SessionStatus) {
  return sessionTransitions[from].includes(to)
}

export function isSessionTerminal(status: SessionStatus) {
  return status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'expired'
}

export function canCancelSession(status: SessionStatus) {
  return status === 'created' || status === 'allocating' || status === 'ready' || status === 'connecting'
}

export function isSessionExpired(session: DurableGameSession, now: string) {
  if (session.expiresAt === null) {
    return false
  }

  if (isSessionTerminal(session.status) || session.status === 'active' || session.status === 'completing') {
    return false
  }

  return new Date(session.expiresAt).getTime() <= new Date(now).getTime()
}

export function materializeSessionStatus(session: DurableGameSession, now: string): SessionStatus {
  if (isSessionExpired(session, now)) {
    return 'expired'
  }

  return session.status
}

export function isSessionParticipant(session: DurableGameSessionAggregate, playerId: string) {
  return session.participants.some((participant) => participant.playerId === playerId)
}