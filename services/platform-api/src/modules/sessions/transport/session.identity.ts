import { HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'

import { requireAuthenticatedPlayer } from '../../auth/transport/authenticated-request.js'
import type { SessionRequestIdentity } from '../application/sessions.identity.js'

export function requireSessionIdentity(request: Request): SessionRequestIdentity {
  const authenticated = requireAuthenticatedPlayer(request)

  if (!authenticated.playerId) {
    throw new HttpException({ code: 'INVALID_PLAYER_ID' }, HttpStatus.BAD_REQUEST)
  }

  return {
    playerId: authenticated.playerId,
    requestId: authenticated.requestId,
  }
}