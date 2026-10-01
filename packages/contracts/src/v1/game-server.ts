import type { GameServerType } from './catalog.js'

export type AllocationStatus = 'requested' | 'provisioning' | 'ready' | 'failed' | 'releasing' | 'released' | 'expired'

export type AllocationProvider = 'unavailable' | 'test'

export type ConnectionTransport = 'tcp' | 'udp' | 'websocket' | 'quic'

export type GameServerArtifactRuntimeType = 'process' | 'container' | 'kubernetes-pod' | 'external'

export type AllocationFailureCode =
  | 'ALLOCATION_PROVIDER_UNAVAILABLE'
  | 'ALLOCATION_PROVIDER_FAILED'
  | 'ALLOCATION_PERSISTENCE_FAILED'
  | 'ALLOCATION_TIMEOUT'

export type AllocationErrorCode =
  | 'ALLOCATION_NOT_FOUND'
  | 'ALLOCATION_INVALID_STATE'
  | 'ALLOCATION_UNAVAILABLE'
  | 'ALLOCATION_FAILED'
  | 'ALLOCATION_ALREADY_RELEASED'
  | 'SESSION_ALREADY_ALLOCATED'
  | 'INVALID_PLAYER_ID'

export type GameServerArtifact = {
  artifactId: string
  gameId: string
  gameVersion: string
  protocolVersion: string
  buildVersion: string
  serverType: GameServerType
  runtimeType: GameServerArtifactRuntimeType
}

export type AllocationRuntimeRequirements = {
  runtimeProfile: string
  region: string | null
  participantCapacity: number
}

export type ConnectionDescriptor = {
  transport: ConnectionTransport
  host: string
  port: number
  secure: boolean
  protocolVersion: string
  tokenReference: string | null
  expiresAt: string | null
}

export type AllocationRequest = {
  allocationId: string
  sessionId: string
  gameId: string
  gameVersion: string
  protocolVersion: string
  requestedAt: string
  artifact: GameServerArtifact
  runtimeRequirements: AllocationRuntimeRequirements
}

export type ProviderAllocationReference = {
  provider: AllocationProvider
  providerReference: string | null
}

export type ProviderAllocationResult = {
  providerReference: string | null
  status: 'provisioning' | 'ready'
  connection: ConnectionDescriptor | null
}

export type GameServerAllocation = {
  allocationId: string
  sessionId: string
  provider: AllocationProvider
  providerReference: string | null
  status: AllocationStatus
  artifact: GameServerArtifact
  runtimeRequirements: AllocationRuntimeRequirements
  connection: ConnectionDescriptor | null
  requestedAt: string
  provisioningAt: string | null
  readyAt: string | null
  failedAt: string | null
  releasingAt: string | null
  releasedAt: string | null
  expiresAt: string | null
  failureCode: AllocationFailureCode | null
}

export type GameServerAllocationErrorResponse = {
  code: AllocationErrorCode
}

export type GameServerAllocationRequest = AllocationRequest

export type GameServerAllocationState = AllocationStatus

export type AllocatorDescriptor = {
  allocator: AllocationProvider
  delivery: 'synchronous' | 'asynchronous'
  targetRuntime: GameServerArtifactRuntimeType
}

export type AllocateServer = AllocationRequest

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