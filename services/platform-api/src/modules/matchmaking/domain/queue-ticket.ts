import type {
  MatchProposalAcceptanceStatus,
  MatchProposalStatus,
  MatchmakingQueueIdentity,
  MatchmakingQueueType,
  MatchmakingRequestStatus,
  MatchmakingRequesterType,
  MatchmakingTerminalOutcome,
} from '@game-center/contracts'

export const MATCH_REQUEST_EXPIRY_WINDOW_MS = 10 * 60 * 1000
export const MATCH_PROPOSAL_TIMEOUT_MS = 30 * 1000
export const MATCH_QUEUE_LOCK_TTL_SECONDS = 5

export type DurableMatchmakingRequest = {
  requestId: string
  requesterType: MatchmakingRequesterType
  requesterId: string
  gameId: string
  queueKey: string
  queueType: MatchmakingQueueType
  platform: MatchmakingQueueIdentity['platform']
  region: string | null
  gameVersion: string
  protocolVersion: string
  status: MatchmakingRequestStatus
  requestedAt: string
  cancelledAt: string | null
  matchedAt: string | null
  expiresAt: string | null
  terminalOutcome: MatchmakingTerminalOutcome | null
  sourceLobbyId: string | null
  activeProposalId: string | null
}

export type DurableMatchProposal = {
  proposalId: string
  matchId: string | null
  queueKey: string
  gameId: string
  queueType: MatchmakingQueueType
  platform: MatchmakingQueueIdentity['platform']
  region: string | null
  gameVersion: string
  protocolVersion: string
  status: MatchProposalStatus
  createdAt: string
  expiresAt: string
  matchedAt: string | null
  resolvedAt: string | null
}

export type DurableMatchProposalMember = {
  proposalId: string
  requestId: string
  playerId: string
  acceptanceStatus: MatchProposalAcceptanceStatus
  respondedAt: string | null
}

export type DurableMatchProposalAggregate = DurableMatchProposal & {
  members: DurableMatchProposalMember[]
}

export type MatchQueuePolicy = {
  matchSize: number
  proposalTimeoutMs: number
}

export function getQueuePolicy(queueType: MatchmakingQueueType): MatchQueuePolicy {
  switch (queueType) {
    case 'quick-play':
      return {
        matchSize: 2,
        proposalTimeoutMs: MATCH_PROPOSAL_TIMEOUT_MS,
      }
  }
}

export function buildQueueKey(queue: MatchmakingQueueIdentity): string {
  return [
    queue.gameId,
    queue.gameVersion,
    queue.protocolVersion,
    queue.queueType,
    queue.platform,
    queue.region ?? 'global',
  ].join('::')
}

export function toQueueIdentity(request: DurableMatchmakingRequest): MatchmakingQueueIdentity {
  return {
    gameId: request.gameId,
    queueType: request.queueType,
    platform: request.platform,
    region: request.region,
    gameVersion: request.gameVersion,
    protocolVersion: request.protocolVersion,
  }
}

export function hasSameQueueIdentity(left: DurableMatchmakingRequest, right: MatchmakingQueueIdentity): boolean {
  return left.queueKey === buildQueueKey(right)
}

export function isActiveRequestStatus(status: MatchmakingRequestStatus) {
  return status === 'queued' || status === 'proposed'
}

export function isProposalTerminal(status: MatchProposalStatus) {
  return status === 'matched' || status === 'rejected' || status === 'expired' || status === 'cancelled' || status === 'failed'
}

export function isRequestExpired(request: DurableMatchmakingRequest, now: string) {
  return request.expiresAt !== null && new Date(request.expiresAt).getTime() <= new Date(now).getTime()
}

export function isProposalExpired(proposal: DurableMatchProposal, now: string) {
  return new Date(proposal.expiresAt).getTime() <= new Date(now).getTime()
}

export function isQueuedRequest(request: DurableMatchmakingRequest) {
  return request.status === 'queued'
}

export function allProposalMembersAccepted(proposal: DurableMatchProposalAggregate) {
  return proposal.members.length > 0 && proposal.members.every((member) => member.acceptanceStatus === 'accepted')
}

export function getPendingProposalMembers(proposal: DurableMatchProposalAggregate) {
  return proposal.members.filter((member) => member.acceptanceStatus === 'pending')
}

export function materializeRequestStatus(request: DurableMatchmakingRequest, now: string): MatchmakingRequestStatus {
  if ((request.status === 'queued' || request.status === 'proposed') && isRequestExpired(request, now)) {
    return 'expired'
  }

  return request.status
}

const requestTransitions: Record<MatchmakingRequestStatus, MatchmakingRequestStatus[]> = {
  queued: ['proposed', 'cancelled', 'expired'],
  proposed: ['matched', 'queued', 'cancelled', 'expired', 'failed'],
  matched: [],
  cancelled: [],
  expired: [],
  failed: [],
}

const proposalTransitions: Record<MatchProposalStatus, MatchProposalStatus[]> = {
  pending: ['matched', 'rejected', 'expired', 'cancelled', 'failed'],
  matched: [],
  rejected: [],
  expired: [],
  cancelled: [],
  failed: [],
}

export function canTransitionRequest(from: MatchmakingRequestStatus, to: MatchmakingRequestStatus) {
  return requestTransitions[from].includes(to)
}

export function canTransitionProposal(from: MatchProposalStatus, to: MatchProposalStatus) {
  return proposalTransitions[from].includes(to)
}