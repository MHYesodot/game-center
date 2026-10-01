import { HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'

import { requireAuthenticatedPlayer } from '../../auth/transport/authenticated-request.js'
import type { MatchmakingRequestIdentity } from '../application/matchmaking.identity.js'

export function requireMatchmakingIdentity(request: Request): MatchmakingRequestIdentity {
  const authenticated = requireAuthenticatedPlayer(request)

  if (!authenticated.playerId) {
    throw new HttpException({ code: 'INVALID_PLAYER_ID' }, HttpStatus.BAD_REQUEST)
  }

  return {
    playerId: authenticated.playerId,
    requestId: authenticated.requestId,
  }
}