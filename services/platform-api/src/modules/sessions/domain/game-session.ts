import type { GameServerAllocation, GameSession } from '@game-center/contracts'

export type PlatformGameSession = GameSession

export type SessionAllocation = GameServerAllocation

export type SessionSnapshot = {
  sessions: PlatformGameSession[]
  allocations: SessionAllocation[]
}

export function getAllocatingSessions(snapshot: SessionSnapshot) {
  return snapshot.sessions.filter((session) => session.state === 'allocating')
}

export function getReadySessions(snapshot: SessionSnapshot) {
  return snapshot.sessions.filter((session) => session.state === 'ready' || session.state === 'active')
}

export function getReadyAllocations(snapshot: SessionSnapshot) {
  return snapshot.allocations.filter((allocation) => allocation.state === 'ready')
}