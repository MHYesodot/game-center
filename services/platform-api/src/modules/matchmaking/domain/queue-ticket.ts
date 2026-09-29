import type {
  Match,
  MatchCandidate,
  MatchProposal,
  MatchmakingOverview,
  MatchmakingQueue,
  MatchmakingTicket,
} from '@game-center/contracts'

export type QueueTicket = MatchmakingTicket

export type QueueDefinition = MatchmakingQueue

export type QueueCandidate = MatchCandidate

export type QueueProposal = MatchProposal

export type ProposedMatch = Match

export type MatchmakingSnapshot = MatchmakingOverview