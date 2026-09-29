import { Injectable } from '@nestjs/common'

import type { SessionSnapshot } from '../domain/game-session.js'

@Injectable()
export class SessionsRepository {
	overview(): SessionSnapshot {
		return {
			sessions: [
				{
					sessionId: 'session-signal-grid-1',
					gameId: 'signal-grid',
					lobbyId: 'lobby-signal-grid-1',
					matchId: 'match-signal-grid-1',
					allocationId: 'alloc-signal-grid-1',
					state: 'ready',
					version: {
						gameVersion: '0.1.0-prototype',
						protocolVersion: 'v1',
						buildVersion: 'prototype',
					},
					participants: [
						{
							playerId: 'player-1',
							role: 'host',
							joinedAt: new Date('2026-09-29T10:02:15Z').toISOString(),
						},
						{
							playerId: 'player-2',
							role: 'player',
							joinedAt: new Date('2026-09-29T10:02:16Z').toISOString(),
						},
					],
					endpoint: {
						transport: 'ws',
						endpoint: 'ws://signal-grid.dev/session-signal-grid-1',
						region: 'dev-local',
					},
					createdAt: new Date('2026-09-29T10:02:12Z').toISOString(),
					updatedAt: new Date('2026-09-29T10:02:20Z').toISOString(),
				},
			],
			allocations: [
				{
					allocationId: 'alloc-signal-grid-1',
					sessionId: 'session-signal-grid-1',
					state: 'ready',
					endpoint: 'ws://signal-grid.dev/session-signal-grid-1',
					transport: 'ws',
					occurredAt: new Date('2026-09-29T10:02:18Z').toISOString(),
					serverInstanceId: 'dev-server-signal-grid-1',
					region: 'dev-local',
				},
			],
		}
	}
}