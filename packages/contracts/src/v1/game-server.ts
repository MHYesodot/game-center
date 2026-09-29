export type GameServerAllocationState = 'requested' | 'allocating' | 'ready' | 'failed' | 'released'

export type GameServerAllocationRequest = {
  gameId: string
  sessionId: string
  gameVersion: string
  protocolVersion: string
  buildVersion: string
  serverType: 'shared' | 'dedicated'
  region?: string
  requestedAt: string
}

export type GameServerAllocation = {
  allocationId: string
  sessionId: string
  state: GameServerAllocationState
  endpoint: string
  transport: 'ws' | 'tcp' | 'udp' | 'custom'
  occurredAt: string
  serverInstanceId?: string
  region?: string
}

export type AllocatorDescriptor = {
  allocator: 'noop-dev' | 'docker-dev' | 'agones'
  delivery: 'synchronous' | 'asynchronous'
  targetRuntime: 'process' | 'container' | 'kubernetes-pod'
}

export type AllocateServer = GameServerAllocationRequest

export type ServerReady = GameServerAllocation

export type CreateGameSession = SessionSeed
export type JoinGameSession = SessionPlayerAction
export type Heartbeat = SessionHeartbeat
export type ReportResult = SessionResultReport
export type TerminateSession = {
  sessionId: string
  reason: string
  requestedAt: string
}

export type SessionSeed = {
  sessionId: string
  gameId: string
  gameVersion: string
  protocolVersion: string
  buildVersion: string
}

export type SessionPlayerAction = {
  sessionId: string
  playerId: string
  requestedAt: string
}

export type SessionHeartbeat = {
  sessionId: string
  serverInstanceId: string
  observedAt: string
}

export type SessionResultReport = {
  sessionId: string
  gameId: string
  reportedAt: string
  winnerPlayerIds: string[]
  attributes: Record<string, string | number | boolean>
}