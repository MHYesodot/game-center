import type {
  AllocationFailureCode,
  AllocationProvider,
  AllocationStatus,
  ConnectionTransport,
  GameServerArtifactRuntimeType,
  GameServerType,
} from '@game-center/contracts'

export type DurableConnectionDescriptor = {
  transport: ConnectionTransport
  host: string
  port: number
  secure: boolean
  protocolVersion: string
  tokenReference: string | null
  expiresAt: string | null
}

export type DurableGameServerAllocation = {
  allocationId: string
  sessionId: string
  provider: AllocationProvider
  providerReference: string | null
  status: AllocationStatus
  gameId: string
  gameVersion: string
  protocolVersion: string
  buildVersion: string
  serverType: GameServerType
  runtimeType: GameServerArtifactRuntimeType
  runtimeProfile: string
  region: string | null
  participantCapacity: number
  requestedAt: string
  provisioningAt: string | null
  readyAt: string | null
  failedAt: string | null
  releasingAt: string | null
  releasedAt: string | null
  expiresAt: string | null
  failureCode: AllocationFailureCode | null
  connection: DurableConnectionDescriptor | null
}

const allocationTransitions: Record<AllocationStatus, AllocationStatus[]> = {
  requested: ['provisioning', 'ready', 'failed', 'expired'],
  provisioning: ['ready', 'failed', 'expired'],
  ready: ['releasing'],
  failed: ['releasing'],
  releasing: ['released'],
  released: [],
  expired: [],
}

export function canTransitionAllocation(from: AllocationStatus, to: AllocationStatus) {
  return allocationTransitions[from].includes(to)
}

export function isAllocationTerminal(status: AllocationStatus) {
  return status === 'failed' || status === 'released' || status === 'expired'
}

export function hasUsableConnection(allocation: DurableGameServerAllocation) {
  return allocation.status === 'ready' && allocation.connection !== null
}

export function isActiveAllocationStatus(status: AllocationStatus) {
  return status === 'requested' || status === 'provisioning' || status === 'ready' || status === 'releasing'
}

export function canReleaseAllocation(status: AllocationStatus) {
  return status === 'ready' || status === 'failed' || status === 'releasing' || status === 'released'
}

export function materializeAllocationStatus(allocation: DurableGameServerAllocation, now: string): AllocationStatus {
  if (!allocation.expiresAt) {
    return allocation.status
  }

  if (allocation.status !== 'requested' && allocation.status !== 'provisioning') {
    return allocation.status
  }

  return new Date(allocation.expiresAt).getTime() <= new Date(now).getTime() ? 'expired' : allocation.status
}