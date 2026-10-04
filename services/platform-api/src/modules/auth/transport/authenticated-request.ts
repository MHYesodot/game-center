import { HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'

import type { AuthenticatedPlayerContext } from '../application/auth.types.js'

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedPlayerContext
}

export function requireAuthenticatedPlayer(request: Request): AuthenticatedPlayerContext {
  const authenticated = (request as AuthenticatedRequest).auth

  if (!authenticated) {
    throw new HttpException({ code: 'AUTHENTICATION_REQUIRED' }, HttpStatus.UNAUTHORIZED)
  }

  return authenticated
}