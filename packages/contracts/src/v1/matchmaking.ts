export type MatchmakingTicketState =
  | 'queued'
  | 'searching'
  | 'proposed'
  | 'matched'
  | 'cancelled'
  | 'expired'

export type MatchState = 'created' | 'allocating-session' | 'session-ready' | 'cancelled'

export type MatchmakingQueue = {
  queueId: string
  gameId: string
  playlist: string
  minPlayers: number
  maxPlayers: number
  teamSize: number
  proposalTimeoutSeconds: number
  ephemeralStore: 'redis'
}

export type MatchmakingTicket = {
  ticketId: string
  gameId: string
  queueId: string
  playerIds: string[]
  requestedAt: string
  state: MatchmakingTicketState
  lobbyId?: string
  attributes: Record<string, string | number | boolean>
}

export type MatchCandidate = {
  candidateId: string
  queueId: string
  ticketIds: string[]
  fitScore: number
  createdAt: string
}

export type MatchProposal = {
  proposalId: string
  queueId: string
  ticketIds: string[]
  acceptedTicketIds: string[]
  expiresAt: string
  createdAt: string
}

export type Match = {
  matchId: string
  gameId: string
  queueId: string
  ticketIds: string[]
  lobbyIds: string[]
  state: MatchState
  createdAt: string
  sessionId?: string
}

export type MatchmakingOverview = {
  queues: MatchmakingQueue[]
  tickets: MatchmakingTicket[]
  candidates: MatchCandidate[]
  proposals: MatchProposal[]
  matches: Match[]
}

export type MatchmakingRequest = {
  requestId: string
  gameId: string
  playerId: string
  playlist: string
  requestedAt: string
}

export type MatchCreated = {
  matchId: string
  gameId: string
  sessionId: string
  createdAt: string
}