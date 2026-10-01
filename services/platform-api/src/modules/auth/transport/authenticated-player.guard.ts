import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'

import { AuthService } from '../application/auth.service.js'
import { readSessionCookie } from './auth.cookies.js'
import type { AuthenticatedRequest } from './authenticated-request.js'

@Injectable()
export class AuthenticatedPlayerGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    request.auth = await this.authService.requireAuthenticatedSession(readSessionCookie(request), request.header('x-request-id')?.trim() ?? null)
    return true
  }
}