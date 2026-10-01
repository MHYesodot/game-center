import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common'
import type {
  AuthorizeRealtimeSubscriptionRequest,
  AuthorizeRealtimeSubscriptionResponse,
  ResolveRealtimeIdentityRequest,
  ResolveRealtimeIdentityResponse,
} from '@game-center/contracts'

import { AuthService } from '../../auth/application/auth.service.js'
import { RealtimeGatewayGuard } from '../../auth/transport/realtime-gateway.guard.js'
import { RealtimeSubscriptionAuthorizerService } from '../application/realtime-subscription-authorizer.service.js'
import { authorizeRealtimeSubscriptionSchema, resolveRealtimeIdentitySchema } from './realtime-internal.schemas.js'

@Controller('internal/realtime')
@UseGuards(RealtimeGatewayGuard)
export class RealtimeInternalController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RealtimeSubscriptionAuthorizerService)
    private readonly authorizer: RealtimeSubscriptionAuthorizerService,
  ) {}

  @Post('identity/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveIdentity(@Body() body: unknown): Promise<ResolveRealtimeIdentityResponse> {
    const request = resolveRealtimeIdentitySchema.parse(body) as ResolveRealtimeIdentityRequest
    return { playerId: await this.authService.resolveRealtimeIdentity(request.ticket) }
  }

  @Post('subscriptions/authorize')
  @HttpCode(HttpStatus.OK)
  authorize(@Body() body: unknown): Promise<AuthorizeRealtimeSubscriptionResponse> {
    return this.authorizer.authorize(authorizeRealtimeSubscriptionSchema.parse(body) as AuthorizeRealtimeSubscriptionRequest)
  }
}