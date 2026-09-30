import type { MatchReadyPayload } from '@game-center/contracts'

export interface SessionMatchReadyHandler {
  onMatchReady(match: MatchReadyPayload): Promise<void>
}

export const SESSION_MATCH_READY_HANDLER = Symbol('SESSION_MATCH_READY_HANDLER')