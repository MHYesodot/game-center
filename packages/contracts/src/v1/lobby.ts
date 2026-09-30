export type LobbyVisibility = 'public' | 'private'

export type LobbyStatus = 'open' | 'starting' | 'started' | 'closed' | 'expired'

export type LobbyMemberRole = 'owner' | 'member'

export type LobbyConnectionState = 'connected' | 'disconnected' | 'reconnecting'

export type LobbyConfigurationValue = string | number | boolean

export type LobbyConfiguration = {
  schemaVersion: string
  settings: Record<string, LobbyConfigurationValue>
}

export type LobbyMemberSummary = {
  playerId: string
  role: LobbyMemberRole
  joinedAt: string
  leftAt: string | null
}

export type LobbyMemberRuntimeState = {
  playerId: string
  connectionState: LobbyConnectionState
  ready: boolean
  lastSeenAt: string | null
  reconnectDeadlineAt: string | null
}

export type LobbyRuntimeState = {
  available: boolean
  connectedMemberCount: number
  allMembersReady: boolean
  readyMemberIds: string[]
  members: LobbyMemberRuntimeState[]
}

export type LobbySummary = {
  lobbyId: string
  gameId: string
  ownerPlayerId: string
  status: LobbyStatus
  visibility: LobbyVisibility
  capacity: number
  minimumPlayers: number
  activeMemberCount: number
  availableSeats: number
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

export type LobbyDetails = {
  lobbyId: string
  gameId: string
  ownerPlayerId: string
  status: LobbyStatus
  visibility: LobbyVisibility
  capacity: number
  minimumPlayers: number
  configuration: LobbyConfiguration
  members: LobbyMemberSummary[]
  runtime: LobbyRuntimeState
  createdAt: string
  updatedAt: string
  closedAt: string | null
  expiresAt: string | null
}

export type CreateLobbyRequest = {
  gameId: string
  visibility: LobbyVisibility
  capacity: number
  minimumPlayers: number
  configuration: LobbyConfiguration
  joinCode?: string
}

export type JoinLobbyRequest = {
  joinCode?: string
}

export type SetLobbyReadyRequest = {
  ready: boolean
}

export type LobbyErrorCode =
  | 'LOBBY_NOT_FOUND'
  | 'LOBBY_FULL'
  | 'LOBBY_CLOSED'
  | 'NOT_LOBBY_MEMBER'
  | 'NOT_LOBBY_OWNER'
  | 'INVALID_LOBBY_STATE'
  | 'PLAYER_NOT_READY'
  | 'LOBBY_NOT_READY'
  | 'LOBBY_UNAVAILABLE'
  | 'GAME_NOT_FOUND'
  | 'INVALID_GAME_CONFIGURATION'
  | 'INVALID_JOIN_CODE'
  | 'PRIVATE_LOBBY_ACCESS_DENIED'
  | 'INVALID_PLAYER_ID'

export type LobbyErrorResponse = {
  code: LobbyErrorCode
}