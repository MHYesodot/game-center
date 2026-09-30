import { describe, expect, it } from 'vitest'

import {
  canCancelSession,
  canTransitionSession,
  isSessionExpired,
  isSessionParticipant,
  isSessionTerminal,
  materializeSessionStatus,
  type DurableGameSessionAggregate,
} from './game-session.js'

describe('session domain helpers', () => {
  const session: DurableGameSessionAggregate = {
    sessionId: 'session-1',
    sourceKind: 'matchmaking',
    matchId: 'match-1',
    proposalId: 'proposal-1',
    gameId: 'signal-grid',
    queueType: 'quick-play',
    platform: 'web',
    region: null,
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    status: 'created',
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    expiresAt: '2026-09-30T10:15:00.000Z',
    failureCode: null,
    participants: [
      {
        sessionId: 'session-1',
        playerId: 'player-1',
        sourceRequestId: 'request-1',
        sourceLobbyId: null,
        joinedAt: '2026-09-30T10:00:00.000Z',
      },
    ],
  }

  it('allows only legal forward transitions', () => {
    expect(canTransitionSession('created', 'allocating')).toBe(true)
    expect(canTransitionSession('allocating', 'ready')).toBe(true)
    expect(canTransitionSession('active', 'completed')).toBe(false)
  })

  it('materializes expiry only for pre-terminal pre-active states', () => {
    expect(isSessionExpired(session, '2026-09-30T10:16:00.000Z')).toBe(true)
    expect(materializeSessionStatus(session, '2026-09-30T10:16:00.000Z')).toBe('expired')
    expect(
      isSessionExpired(
        {
          ...session,
          status: 'active',
        },
        '2026-09-30T10:16:00.000Z',
      ),
    ).toBe(false)
  })

  it('recognizes cancellable and terminal states explicitly', () => {
    expect(canCancelSession('created')).toBe(true)
    expect(canCancelSession('active')).toBe(false)
    expect(isSessionTerminal('failed')).toBe(true)
    expect(isSessionTerminal('allocating')).toBe(false)
  })

  it('checks participant membership from durable snapshot', () => {
    expect(isSessionParticipant(session, 'player-1')).toBe(true)
    expect(isSessionParticipant(session, 'player-2')).toBe(false)
  })
})