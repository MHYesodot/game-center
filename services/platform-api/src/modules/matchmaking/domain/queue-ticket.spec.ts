import { describe, expect, it } from 'vitest'

import {
  allProposalMembersAccepted,
  buildQueueKey,
  canTransitionProposal,
  canTransitionRequest,
  getPendingProposalMembers,
  getQueuePolicy,
  isProposalExpired,
  materializeRequestStatus,
  type DurableMatchProposalAggregate,
  type DurableMatchmakingRequest,
} from './queue-ticket.js'

describe('matchmaking request state machine', () => {
  it('allows queued transitions and rejects invalid queued transitions', () => {
    expect(canTransitionRequest('queued', 'proposed')).toBe(true)
    expect(canTransitionRequest('queued', 'cancelled')).toBe(true)
    expect(canTransitionRequest('queued', 'expired')).toBe(true)
    expect(canTransitionRequest('queued', 'matched')).toBe(false)
  })

  it('allows proposed transitions and rejects terminal rewinds', () => {
    expect(canTransitionRequest('proposed', 'matched')).toBe(true)
    expect(canTransitionRequest('proposed', 'queued')).toBe(true)
    expect(canTransitionRequest('proposed', 'cancelled')).toBe(true)
    expect(canTransitionRequest('proposed', 'expired')).toBe(true)
    expect(canTransitionRequest('proposed', 'failed')).toBe(true)
    expect(canTransitionRequest('matched', 'queued')).toBe(false)
  })

  it('materializes request expiry from durable timestamps', () => {
    const request: DurableMatchmakingRequest = {
      requestId: 'request-1',
      requesterType: 'player',
      requesterId: 'player-1',
      gameId: 'signal-grid',
      queueKey: buildQueueKey({
        gameId: 'signal-grid',
        queueType: 'quick-play',
        platform: 'web',
        region: null,
        gameVersion: '0.1.0',
        protocolVersion: 'v1',
      }),
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0',
      protocolVersion: 'v1',
      status: 'queued',
      requestedAt: '2026-09-30T10:00:00.000Z',
      cancelledAt: null,
      matchedAt: null,
      expiresAt: '2026-09-30T10:10:00.000Z',
      terminalOutcome: null,
      sourceLobbyId: null,
      activeProposalId: null,
    }

    expect(materializeRequestStatus(request, '2026-09-30T10:11:00.000Z')).toBe('expired')
  })
})

describe('match proposal state machine', () => {
  it('allows pending proposal transitions and rejects terminal transitions', () => {
    expect(canTransitionProposal('pending', 'matched')).toBe(true)
    expect(canTransitionProposal('pending', 'rejected')).toBe(true)
    expect(canTransitionProposal('pending', 'expired')).toBe(true)
    expect(canTransitionProposal('pending', 'cancelled')).toBe(true)
    expect(canTransitionProposal('pending', 'failed')).toBe(true)
    expect(canTransitionProposal('matched', 'pending')).toBe(false)
  })

  it('tracks pending participants and proposal expiry', () => {
    const proposal: DurableMatchProposalAggregate = {
      proposalId: 'proposal-1',
      matchId: null,
      queueKey: 'signal-grid::0.1.0::v1::quick-play::web::global',
      gameId: 'signal-grid',
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0',
      protocolVersion: 'v1',
      status: 'pending',
      createdAt: '2026-09-30T10:00:00.000Z',
      expiresAt: '2026-09-30T10:00:30.000Z',
      matchedAt: null,
      resolvedAt: null,
      members: [
        {
          proposalId: 'proposal-1',
          requestId: 'request-1',
          playerId: 'player-1',
          acceptanceStatus: 'accepted',
          respondedAt: '2026-09-30T10:00:05.000Z',
        },
        {
          proposalId: 'proposal-1',
          requestId: 'request-2',
          playerId: 'player-2',
          acceptanceStatus: 'pending',
          respondedAt: null,
        },
      ],
    }

    expect(allProposalMembersAccepted(proposal)).toBe(false)
    expect(getPendingProposalMembers(proposal)).toHaveLength(1)
    expect(isProposalExpired(proposal, '2026-09-30T10:01:00.000Z')).toBe(true)
  })
})

describe('queue policy', () => {
  it('uses the default quick-play pairing policy', () => {
    expect(getQueuePolicy('quick-play')).toEqual({
      matchSize: 2,
      proposalTimeoutMs: 30_000,
    })
  })
})