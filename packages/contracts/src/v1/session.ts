export type SessionTransport = 'ws' | 'tcp' | 'udp' | 'custom'

export type SessionState =
  | 'allocating'
  | 'ready'
  | 'active'
  | 'ending'
  | 'completed'
  | 'terminated'
  | 'failed'

export type SessionParticipantRole = 'host' | 'player' | 'spectator'

export type SessionVersion = {
  gameVersion: string
  protocolVersion: string
  buildVersion: string
}

export type SessionEndpoint = {
  transport: SessionTransport
  endpoint: string
  token?: string
  region?: string
  expiresAt?: string
}

export type SessionParticipant = {
  playerId: string
  role: SessionParticipantRole
  joinedAt: string
  connectedAt?: string
  leftAt?: string
}

export type SessionResult = {
  outcome: 'completed' | 'aborted' | 'failed'
  winnerPlayerIds: string[]
  completedAt: string
  attributes: Record<string, string | number | boolean>
}

export type GameSession = {
  sessionId: string
  gameId: string
  state: SessionState
  version: SessionVersion
  participants: SessionParticipant[]
  createdAt: string
  updatedAt: string
  lobbyId?: string
  matchId?: string
  allocationId?: string
  endpoint?: SessionEndpoint
  result?: SessionResult
}

export type SessionEnvelope = {
  sessionId: string
  gameId: string
  gameVersion: string
  protocolVersion: string
  buildVersion: string
  connectionInfo?: SessionEndpoint
}

export type ResultEnvelope = {
  sessionId: string
  gameId: string
  winnerPlayerIds: string[]
  completedAt: string
  attributes: Record<string, string | number | boolean>
}