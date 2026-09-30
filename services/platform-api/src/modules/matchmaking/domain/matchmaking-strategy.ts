import type { MatchmakingQueueIdentity } from '@game-center/contracts'

import type { DurableMatchmakingRequest, MatchQueuePolicy } from './queue-ticket.js'

export const MATCHMAKING_STRATEGY = Symbol('MATCHMAKING_STRATEGY')

export type MatchSelection = {
  queue: MatchmakingQueueIdentity
  requestIds: string[]
}

export interface MatchmakingStrategy {
  selectMatch(candidates: DurableMatchmakingRequest[], policy: MatchQueuePolicy): MatchSelection | null
}

export class FifoMatchmakingStrategy implements MatchmakingStrategy {
  selectMatch(candidates: DurableMatchmakingRequest[], policy: MatchQueuePolicy): MatchSelection | null {
    if (candidates.length < policy.matchSize) {
      return null
    }

    const sorted = [...candidates].sort((left, right) => {
      if (new Date(left.requestedAt).getTime() === new Date(right.requestedAt).getTime()) {
        return left.requestId.localeCompare(right.requestId)
      }

      return new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime()
    })
    const selected = sorted.slice(0, policy.matchSize)

    return {
      queue: {
        gameId: selected[0].gameId,
        queueType: selected[0].queueType,
        platform: selected[0].platform,
        region: selected[0].region,
        gameVersion: selected[0].gameVersion,
        protocolVersion: selected[0].protocolVersion,
      },
      requestIds: selected.map((request) => request.requestId),
    }
  }
}