import { Injectable } from '@nestjs/common'

import type { MatchmakingSnapshot } from '../domain/queue-ticket.js'

@Injectable()
export class MatchmakingRepository {
	overview(): MatchmakingSnapshot {
		return {
			queues: [
				{
					queueId: 'queue-signal-grid-ranked',
					gameId: 'signal-grid',
					playlist: 'ranked-duel',
					minPlayers: 2,
					maxPlayers: 2,
					teamSize: 1,
					proposalTimeoutSeconds: 20,
					ephemeralStore: 'redis',
				},
				{
					queueId: 'queue-rush-lane-quickplay',
					gameId: 'rush-lane',
					playlist: 'quick-play',
					minPlayers: 1,
					maxPlayers: 8,
					teamSize: 1,
					proposalTimeoutSeconds: 15,
					ephemeralStore: 'redis',
				},
			],
			tickets: [
				{
					ticketId: 'ticket-signal-grid-ranked-1',
					gameId: 'signal-grid',
					queueId: 'queue-signal-grid-ranked',
					playerIds: ['player-1', 'player-2'],
					requestedAt: new Date('2026-09-29T10:02:00Z').toISOString(),
					state: 'proposed',
					lobbyId: 'lobby-signal-grid-1',
					attributes: {
						region: 'dev-local',
						ranked: true,
					},
				},
			],
			candidates: [
				{
					candidateId: 'candidate-signal-grid-1',
					queueId: 'queue-signal-grid-ranked',
					ticketIds: ['ticket-signal-grid-ranked-1'],
					fitScore: 0.98,
					createdAt: new Date('2026-09-29T10:02:05Z').toISOString(),
				},
			],
			proposals: [
				{
					proposalId: 'proposal-signal-grid-1',
					queueId: 'queue-signal-grid-ranked',
					ticketIds: ['ticket-signal-grid-ranked-1'],
					acceptedTicketIds: ['ticket-signal-grid-ranked-1'],
					expiresAt: new Date('2026-09-29T10:02:25Z').toISOString(),
					createdAt: new Date('2026-09-29T10:02:05Z').toISOString(),
				},
			],
			matches: [
				{
					matchId: 'match-signal-grid-1',
					gameId: 'signal-grid',
					queueId: 'queue-signal-grid-ranked',
					ticketIds: ['ticket-signal-grid-ranked-1'],
					lobbyIds: ['lobby-signal-grid-1'],
					state: 'allocating-session',
					createdAt: new Date('2026-09-29T10:02:10Z').toISOString(),
					sessionId: 'session-signal-grid-1',
				},
			],
		}
	}
}