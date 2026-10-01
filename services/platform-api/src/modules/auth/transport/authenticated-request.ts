import { HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'

import type { AuthenticatedPlayerContext } from '../application/auth.types.js'

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedPlayerContext
}

export function requireAuthenticatedPlayer(request: Request): AuthenticatedPlayerContext {
  const authenticated = (request as AuthenticatedRequest).auth

  if (!authenticated) {
    const transitionalPlayerId = process.env.NODE_ENV === 'test' ? request.header('x-player-id')?.trim() : null
    if (transitionalPlayerId) {
      return {
        playerId: transitionalPlayerId,
        email: `${transitionalPlayerId}@test.local`,
        expiresAt: '9999-12-31T23:59:59.999Z',
        sessionId: 'test-session',
        requestId: request.header('x-request-id')?.trim() ?? null,
      }
    }

    throw new HttpException({ code: 'AUTHENTICATION_REQUIRED' }, HttpStatus.UNAUTHORIZED)
  }

  return authenticated
}