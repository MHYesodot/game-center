import type {
  MatchReadyPayload,
  MatchmakingRequestRuntimeState,
  MatchmakingRequester,
} from '@game-center/contracts'

import type {
  DurableMatchProposal,
  DurableMatchProposalAggregate,
  DurableMatchProposalMember,
  DurableMatchmakingRequest,
} from '../domain/queue-ticket.js'

export const MATCHMAKING_REPOSITORY = Symbol('MATCHMAKING_REPOSITORY')
export const MATCHMAKING_QUEUE_STORE = Symbol('MATCHMAKING_QUEUE_STORE')
export const MATCH_READY_SINK = Symbol('MATCH_READY_SINK')

export type CreateMatchProposalInput = DurableMatchProposal & {
  members: DurableMatchProposalMember[]
}

export interface MatchmakingRepositoryTransaction {
  getRequestById(requestId: string): Promise<DurableMatchmakingRequest | null>
  getRequestByIdForUpdate(requestId: string): Promise<DurableMatchmakingRequest | null>
  getRequestsByIdsForUpdate(requestIds: string[]): Promise<DurableMatchmakingRequest[]>
  getActiveRequestByRequester(requester: MatchmakingRequester): Promise<DurableMatchmakingRequest | null>
  getActiveRequestByRequesterForUpdate(requester: MatchmakingRequester): Promise<DurableMatchmakingRequest | null>
  createRequest(request: DurableMatchmakingRequest): Promise<void>
  updateRequest(request: DurableMatchmakingRequest): Promise<void>
  getProposalById(proposalId: string): Promise<DurableMatchProposalAggregate | null>
  getProposalByIdForUpdate(proposalId: string): Promise<DurableMatchProposalAggregate | null>
  createProposal(proposal: CreateMatchProposalInput): Promise<void>
  updateProposal(proposal: DurableMatchProposal): Promise<void>
  updateProposalMember(member: DurableMatchProposalMember): Promise<void>
}

export interface MatchmakingRepository {
  getRequestById(requestId: string): Promise<DurableMatchmakingRequest | null>
  getProposalById(proposalId: string): Promise<DurableMatchProposalAggregate | null>
  getProposalByMatchId(matchId: string): Promise<DurableMatchProposalAggregate | null>
  getActiveRequestByRequester(requester: MatchmakingRequester): Promise<DurableMatchmakingRequest | null>
  withTransaction<T>(callback: (transaction: MatchmakingRepositoryTransaction) => Promise<T>): Promise<T>
}

export interface MatchmakingQueueStore {
  enqueue(request: DurableMatchmakingRequest): Promise<void>
  remove(queueKey: string, requestId: string): Promise<void>
  removeMany(queueKey: string, requestIds: string[]): Promise<void>
  getCandidateRequestIds(queueKey: string, limit: number): Promise<string[]>
  getRuntimeState(queueKey: string, requestId: string): Promise<MatchmakingRequestRuntimeState>
  acquireQueueLock(queueKey: string, ownerToken: string, ttlSeconds: number): Promise<boolean>
  releaseQueueLock(queueKey: string, ownerToken: string): Promise<void>
  touchProposalLease(proposalId: string, expiresAt: string): Promise<void>
  clearProposalLease(proposalId: string): Promise<void>
}

export interface MatchReadySink {
  onMatchReady(match: MatchReadyPayload): Promise<void>
}

export function buildUnavailableRuntimeState(): MatchmakingRequestRuntimeState {
  return {
    available: false,
    queuePosition: null,
    estimatedWaitSeconds: null,
    candidateCount: 0,
    lastHeartbeatAt: null,
    searchExpansionVersion: null,
  }
}