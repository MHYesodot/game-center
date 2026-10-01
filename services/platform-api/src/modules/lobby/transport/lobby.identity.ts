import { HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'

import { requireAuthenticatedPlayer } from '../../auth/transport/authenticated-request.js'
import type { LobbyRequestIdentity } from '../application/lobby.identity.js'

export function requireLobbyIdentity(request: Request): LobbyRequestIdentity {
  const authenticated = requireAuthenticatedPlayer(request)

  if (!authenticated.playerId) {
    throw new HttpException(
      {
        code: 'INVALID_PLAYER_ID',
      },
      HttpStatus.BAD_REQUEST,
    )
  }

  return {
    playerId: authenticated.playerId,
    requestId: authenticated.requestId,
  }
}