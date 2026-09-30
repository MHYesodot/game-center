import { describe, expect, it } from 'vitest'

import { FifoMatchmakingStrategy } from './matchmaking-strategy.js'
import { buildQueueKey, type DurableMatchmakingRequest } from './queue-ticket.js'

const queue = {
  gameId: 'signal-grid',
  queueType: 'quick-play' as const,
  platform: 'web' as const,
  region: null,
  gameVersion: '0.1.0',
  protocolVersion: 'v1',
}

function buildRequest(requestId: string, requestedAt: string): DurableMatchmakingRequest {
  return {
    requestId,
    requesterType: 'player',
    requesterId: requestId,
    gameId: queue.gameId,
    queueKey: buildQueueKey(queue),
    queueType: queue.queueType,
    platform: queue.platform,
    region: queue.region,
    gameVersion: queue.gameVersion,
    protocolVersion: queue.protocolVersion,
    status: 'queued',
    requestedAt,
    cancelledAt: null,
    matchedAt: null,
    expiresAt: '2026-09-30T10:20:00.000Z',
    terminalOutcome: null,
    sourceLobbyId: null,
    activeProposalId: null,
  }
}

describe('FifoMatchmakingStrategy', () => {
  it('returns null for insufficient candidates', () => {
    const strategy = new FifoMatchmakingStrategy()
    expect(strategy.selectMatch([buildRequest('request-1', '2026-09-30T10:00:01.000Z')], { matchSize: 2, proposalTimeoutMs: 30_000 })).toBeNull()
  })

  it('selects the earliest candidates in stable order', () => {
    const strategy = new FifoMatchmakingStrategy()
    const selection = strategy.selectMatch(
      [
        buildRequest('request-2', '2026-09-30T10:00:02.000Z'),
        buildRequest('request-1', '2026-09-30T10:00:01.000Z'),
        buildRequest('request-3', '2026-09-30T10:00:03.000Z'),
      ],
      { matchSize: 2, proposalTimeoutMs: 30_000 },
    )

    expect(selection?.requestIds).toEqual(['request-1', 'request-2'])
  })
})