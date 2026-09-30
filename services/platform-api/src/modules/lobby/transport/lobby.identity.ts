import { HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'

import type { LobbyRequestIdentity } from '../application/lobby.identity.js'

export function requireLobbyIdentity(request: Request): LobbyRequestIdentity {
  const playerId = request.header('x-player-id')?.trim()
  const requestId = request.header('x-request-id')?.trim() ?? null

  if (!playerId) {
    throw new HttpException(
      {
        code: 'INVALID_PLAYER_ID',
      },
      HttpStatus.BAD_REQUEST,
    )
  }

  return {
    playerId,
    requestId,
  }
}