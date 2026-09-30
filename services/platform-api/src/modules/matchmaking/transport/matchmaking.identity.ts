import { HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'

import type { MatchmakingRequestIdentity } from '../application/matchmaking.identity.js'

export function requireMatchmakingIdentity(request: Request): MatchmakingRequestIdentity {
  const playerId = request.header('x-player-id')?.trim()
  const requestId = request.header('x-request-id')?.trim() ?? null

  if (!playerId) {
    throw new HttpException({ code: 'INVALID_PLAYER_ID' }, HttpStatus.BAD_REQUEST)
  }

  return {
    playerId,
    requestId,
  }
}