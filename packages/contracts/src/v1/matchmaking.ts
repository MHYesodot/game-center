export type MatchmakingRequesterType = 'player' | 'party'

export type MatchmakingQueueType = 'quick-play'

export type MatchmakingPlatform = 'web' | 'windows' | 'macos' | 'android' | 'ios' | 'ipados'

export type MatchmakingRequestStatus = 'queued' | 'proposed' | 'matched' | 'cancelled' | 'expired' | 'failed'

export type MatchProposalStatus = 'pending' | 'matched' | 'rejected' | 'expired' | 'cancelled' | 'failed'

export type MatchProposalAcceptanceStatus = 'pending' | 'accepted' | 'rejected' | 'timed_out'

export type MatchmakingTerminalOutcome = 'matched' | 'cancelled' | 'expired' | 'failed'

export type MatchmakingRequester = {
  type: MatchmakingRequesterType
  id: string
}

export type MatchmakingQueueIdentity = {
  gameId: string
  queueType: MatchmakingQueueType
  platform: MatchmakingPlatform
  region: string | null
  gameVersion: string
  protocolVersion: string
}

export type MatchmakingRequestRuntimeState = {
  available: boolean
  queuePosition: number | null
  estimatedWaitSeconds: number | null
  candidateCount: number
  lastHeartbeatAt: string | null
  searchExpansionVersion: number | null
}

export type MatchmakingRequestDetails = {
  requestId: string
  requester: MatchmakingRequester
  status: MatchmakingRequestStatus
  queue: MatchmakingQueueIdentity
  requestedAt: string
  cancelledAt: string | null
  matchedAt: string | null
  expiresAt: string | null
  terminalOutcome: MatchmakingTerminalOutcome | null
  sourceLobbyId: string | null
  activeProposalId: string | null
  runtime: MatchmakingRequestRuntimeState
}

export type MatchProposalMember = {
  requestId: string
  playerId: string
  acceptanceStatus: MatchProposalAcceptanceStatus
  respondedAt: string | null
}

export type MatchProposalDetails = {
  proposalId: string
  status: MatchProposalStatus
  queue: MatchmakingQueueIdentity
  createdAt: string
  expiresAt: string
  matchedAt: string | null
  resolvedAt: string | null
  members: MatchProposalMember[]
}

export type MatchReadyPayload = {
  matchId: string
  proposalId: string
  gameId: string
  gameVersion: string
  protocolVersion: string
  platform: MatchmakingPlatform
  requestIds: string[]
  playerIds: string[]
  sourceLobbyIds: string[]
}

export type CreateMatchmakingRequest = {
  gameId: string
  queueType: MatchmakingQueueType
  platform: MatchmakingPlatform
  region?: string
  protocolVersion?: string
  sourceLobbyId?: string
}

export type MatchmakingErrorCode =
  | 'MATCHMAKING_REQUEST_NOT_FOUND'
  | 'ALREADY_QUEUED'
  | 'MATCHMAKING_REQUEST_NOT_ACTIVE'
  | 'MATCHMAKING_UNAVAILABLE'
  | 'MATCH_PROPOSAL_NOT_FOUND'
  | 'MATCH_PROPOSAL_EXPIRED'
  | 'MATCH_PROPOSAL_ALREADY_RESOLVED'
  | 'MATCH_PROPOSAL_NOT_PARTICIPANT'
  | 'INCOMPATIBLE_GAME'
  | 'INVALID_QUEUE_REQUEST'
  | 'INVALID_PLAYER_ID'

export type MatchmakingErrorResponse = {
  code: MatchmakingErrorCode
}