import { Injectable } from '@nestjs/common'

import type { PlatformLobby } from '../domain/lobby-record.js'

const lobbies: PlatformLobby[] = [
  {
    lobbyId: 'lobby-signal-grid-1',
    gameId: 'signal-grid',
    ownerPlayerId: 'player-1',
    state: 'ready-check',
    settings: {
      visibility: 'public',
      minPlayers: 2,
      maxPlayers: 2,
      allowSpectators: true,
      isRanked: true,
      region: 'dev-local',
      customSettings: {
        boardSize: 'standard',
      },
    },
    createdAt: new Date('2026-09-29T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-29T10:03:00Z').toISOString(),
    members: [
      {
        playerId: 'player-1',
        displayName: 'Commander Vega',
        role: 'host',
        readyState: 'ready',
        joinedAt: new Date('2026-09-29T10:00:00Z').toISOString(),
        seatIndex: 0,
      },
      {
        playerId: 'player-2',
        displayName: 'Analyst Noor',
        role: 'member',
        readyState: 'ready',
        joinedAt: new Date('2026-09-29T10:01:00Z').toISOString(),
        seatIndex: 1,
      },
    ],
    matchmakingTicketId: 'ticket-signal-grid-ranked-1',
  },
  {
    lobbyId: 'lobby-rush-lane-1',
    gameId: 'rush-lane',
    ownerPlayerId: 'player-3',
    state: 'open',
    settings: {
      visibility: 'friends-only',
      minPlayers: 1,
      maxPlayers: 8,
      allowSpectators: false,
      isRanked: false,
      region: 'dev-local',
      customSettings: {
        lapPreset: 'short',
      },
    },
    createdAt: new Date('2026-09-29T10:10:00Z').toISOString(),
    updatedAt: new Date('2026-09-29T10:12:00Z').toISOString(),
    members: [
      {
        playerId: 'player-3',
        displayName: 'Nova',
        role: 'host',
        readyState: 'pending',
        joinedAt: new Date('2026-09-29T10:10:00Z').toISOString(),
        seatIndex: 0,
      },
    ],
  },
]

@Injectable()
export class InMemoryLobbyRepository {
  list() {
    return lobbies
  }
}