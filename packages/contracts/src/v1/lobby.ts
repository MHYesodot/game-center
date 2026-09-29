export type LobbyVisibility = 'public' | 'private' | 'friends-only' | 'invite-only'

export type LobbyRole = 'host' | 'member' | 'spectator'

export type ReadyState = 'pending' | 'ready' | 'not-ready'

export type LobbyState =
  | 'forming'
  | 'open'
  | 'ready-check'
  | 'allocated'
  | 'in-session'
  | 'closing'
  | 'closed'

export type LobbySettings = {
  visibility: LobbyVisibility
  minPlayers: number
  maxPlayers: number
  allowSpectators: boolean
  isRanked: boolean
  region?: string
  customSettings: Record<string, string | number | boolean>
}

export type LobbyMember = {
  playerId: string
  displayName: string
  role: LobbyRole
  readyState: ReadyState
  joinedAt: string
  seatIndex?: number
}

export type Lobby = {
  lobbyId: string
  gameId: string
  ownerPlayerId: string
  state: LobbyState
  settings: LobbySettings
  members: LobbyMember[]
  createdAt: string
  updatedAt: string
  matchmakingTicketId?: string
  sessionId?: string
}

export type LobbySummary = {
  lobbyId: string
  gameId: string
  state: LobbyState
  visibility: LobbyVisibility
  memberCount: number
  maxPlayers: number
  createdAt: string
}

export type LobbyPlayer = {
  playerId: string
  displayName: string
  ready: boolean
}

export type LobbyRecord = {
  lobbyId: string
  gameId: string
  state: 'open' | 'full' | 'ready' | 'matching' | 'closed'
  players: LobbyPlayer[]
  maxPlayers: number
  createdAt: string
}