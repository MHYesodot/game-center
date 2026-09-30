import type { MatchReadyPayload } from '@game-center/contracts'

export interface MatchReadyQuery {
  getMatchReady(matchId: string): Promise<MatchReadyPayload | null>
}

export const MATCH_READY_QUERY = Symbol('MATCH_READY_QUERY')