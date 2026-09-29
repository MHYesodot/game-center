import type { GameServerAllocation, GameSession } from '@game-center/contracts'

export type PlatformGameSession = GameSession

export type SessionAllocation = GameServerAllocation

export type SessionSnapshot = {
  sessions: PlatformGameSession[]
  allocations: SessionAllocation[]
}