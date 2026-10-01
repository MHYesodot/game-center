import type { GameServerAllocation, MatchmakingPlatform, MatchmakingQueueType } from '@game-center/contracts'

export type SessionAllocationCommand = {
  sessionId: string
  matchId: string
  proposalId: string
  gameId: string
  queueType: MatchmakingQueueType
  platform: MatchmakingPlatform
  region: string | null
  gameVersion: string
  protocolVersion: string
  playerIds: string[]
  participantCapacity: number
  requestedAt: string
  expiresAt: string | null
}

export interface SessionAllocationOrchestrator {
  requestAllocation(input: SessionAllocationCommand): Promise<GameServerAllocation>
  getAllocation(sessionId: string): Promise<GameServerAllocation | null>
  releaseAllocation(sessionId: string): Promise<GameServerAllocation | null>
}

export class SessionAllocationError extends Error {
  constructor(readonly code: 'ALLOCATION_NOT_FOUND' | 'ALLOCATION_INVALID_STATE' | 'ALLOCATION_UNAVAILABLE' | 'ALLOCATION_FAILED' | 'ALLOCATION_ALREADY_RELEASED') {
    super(code)
  }
}

export const SESSION_ALLOCATION_ORCHESTRATOR = Symbol('SESSION_ALLOCATION_ORCHESTRATOR')