import { describe, expect, it } from 'vitest'
import { buildLobby } from '@game-center/testing'

import {
  getActiveLobbyMembers,
  getAvailableSeats,
  getDeterministicOwnerSuccessor,
  isLobbyExpired,
  materializeLobbyStatus,
} from './lobby-record.js'

describe('lobby domain helpers', () => {
  it('counts only members without leftAt as active', () => {
    const lobby = buildLobby({
      members: [
        ...buildLobby().members,
        {
          playerId: 'player-3',
          role: 'member',
          joinedAt: new Date('2026-09-29T10:03:00Z').toISOString(),
          leftAt: new Date('2026-09-29T10:04:00Z').toISOString(),
        },
      ],
    })

    expect(getActiveLobbyMembers(lobby)).toHaveLength(2)
  })

  it('calculates available seats from active durable members', () => {
    expect(getAvailableSeats(buildLobby())).toBe(2)
  })

  it('selects the oldest active durable member as the owner successor', () => {
    const lobby = buildLobby({
      members: [
        {
          playerId: 'player-1',
          role: 'owner',
          joinedAt: new Date('2026-09-29T10:00:00Z').toISOString(),
          leftAt: null,
        },
        {
          playerId: 'player-2',
          role: 'member',
          joinedAt: new Date('2026-09-29T10:01:00Z').toISOString(),
          leftAt: null,
        },
        {
          playerId: 'player-3',
          role: 'member',
          joinedAt: new Date('2026-09-29T10:02:00Z').toISOString(),
          leftAt: null,
        },
      ],
    })

    expect(getDeterministicOwnerSuccessor(lobby, 'player-1')?.playerId).toBe('player-2')
  })

  it('materializes expired open lobbies without boolean flag soup', () => {
    const lobby = buildLobby({
      expiresAt: new Date('2026-09-29T10:30:00Z').toISOString(),
      status: 'open',
    })

    expect(isLobbyExpired(lobby, new Date('2026-09-29T10:31:00Z').toISOString())).toBe(true)
    expect(materializeLobbyStatus(lobby, new Date('2026-09-29T10:31:00Z').toISOString())).toBe('expired')
  })
})