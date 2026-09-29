import { describe, expect, it } from 'vitest'
import { buildMatchmakingOverview } from '@game-center/testing'

import { getActiveQueueTickets, getMatchesAwaitingSession, getPendingMatchProposals } from './queue-ticket.js'

describe('matchmaking domain helpers', () => {
  it('filters out cancelled and expired tickets', () => {
    const snapshot = buildMatchmakingOverview({
      tickets: [
        ...buildMatchmakingOverview().tickets,
        {
          ticketId: 'ticket-cancelled',
          gameId: 'signal-grid',
          queueId: 'queue-signal-grid-ranked',
          playerIds: ['player-9'],
          requestedAt: new Date('2026-09-29T10:06:00Z').toISOString(),
          state: 'cancelled',
          attributes: {},
        },
      ],
    })

    expect(getActiveQueueTickets(snapshot)).toHaveLength(1)
  })

  it('returns proposals that still need acceptances', () => {
    const snapshot = buildMatchmakingOverview()

    expect(getPendingMatchProposals(snapshot)).toHaveLength(1)
  })

  it('returns matches still waiting on session allocation', () => {
    const snapshot = buildMatchmakingOverview()

    expect(getMatchesAwaitingSession(snapshot)).toHaveLength(1)
  })
})