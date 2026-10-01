import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

import { REALTIME_GATEWAY_SECRET_HEADER } from '../domain/auth-records.js'

@Injectable()
export class RealtimeGatewayGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredSecret = this.configService.get<string>('AUTH_GATEWAY_SHARED_SECRET')?.trim() ?? ''

    if (configuredSecret === '' && this.configService.get<string>('NODE_ENV') === 'test') {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const value = request.header(REALTIME_GATEWAY_SECRET_HEADER)

    if (typeof value !== 'string' || value.trim() !== configuredSecret) {
      throw new HttpException({ code: 'AUTHENTICATION_REQUIRED' }, HttpStatus.UNAUTHORIZED)
    }

    return true
  }
}