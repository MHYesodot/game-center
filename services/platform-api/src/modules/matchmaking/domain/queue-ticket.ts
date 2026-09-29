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

export function getActiveQueueTickets(snapshot: MatchmakingSnapshot) {
  return snapshot.tickets.filter((ticket) => ticket.state !== 'cancelled' && ticket.state !== 'expired')
}

export function getPendingMatchProposals(snapshot: MatchmakingSnapshot) {
  return snapshot.proposals.filter((proposal) => proposal.acceptedTicketIds.length < proposal.ticketIds.length)
}

export function getMatchesAwaitingSession(snapshot: MatchmakingSnapshot) {
  return snapshot.matches.filter((match) => match.state === 'allocating-session')
}