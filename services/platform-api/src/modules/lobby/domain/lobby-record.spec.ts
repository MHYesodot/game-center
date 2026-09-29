import { describe, expect, it } from 'vitest'
import { buildLobby } from '@game-center/testing'

import { countActiveLobbyMembers, countReadyLobbyMembers, isLobbyReadyForAllocation } from './lobby-record.js'

describe('lobby domain helpers', () => {
  it('counts only non-spectator members as active', () => {
    const lobby = buildLobby({
      members: [
        ...buildLobby().members,
        {
          playerId: 'player-3',
          displayName: 'Observer Ivo',
          role: 'spectator',
          readyState: 'pending',
          joinedAt: new Date('2026-09-29T10:03:00Z').toISOString(),
        },
      ],
    })

    expect(countActiveLobbyMembers(lobby)).toBe(2)
  })

  it('counts only ready non-spectator members', () => {
    const lobby = buildLobby({
      members: [
        buildLobby().members[0],
        {
          ...buildLobby().members[1],
          readyState: 'pending',
        },
      ],
    })

    expect(countReadyLobbyMembers(lobby)).toBe(1)
  })

  it('requires player count and readiness to be satisfied before allocation', () => {
    expect(isLobbyReadyForAllocation(buildLobby())).toBe(true)

    expect(
      isLobbyReadyForAllocation(
        buildLobby({
          members: [buildLobby().members[0]],
        }),
      ),
    ).toBe(false)
  })
})