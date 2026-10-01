import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common'
import type {
  AuthorizeRealtimeSubscriptionRequest,
  AuthorizeRealtimeSubscriptionResponse,
  ResolveRealtimeIdentityRequest,
  ResolveRealtimeIdentityResponse,
} from '@game-center/contracts'

import { RealtimeSubscriptionAuthorizerService } from '../application/realtime-subscription-authorizer.service.js'
import { authorizeRealtimeSubscriptionSchema, resolveRealtimeIdentitySchema } from './realtime-internal.schemas.js'

@Controller('internal/realtime')
export class RealtimeInternalController {
  constructor(
    @Inject(RealtimeSubscriptionAuthorizerService)
    private readonly authorizer: RealtimeSubscriptionAuthorizerService,
  ) {}

  @Post('identity/resolve')
  @HttpCode(HttpStatus.OK)
  resolveIdentity(@Body() body: unknown): Promise<ResolveRealtimeIdentityResponse> {
    return this.authorizer.resolveIdentity(resolveRealtimeIdentitySchema.parse(body) as ResolveRealtimeIdentityRequest)
  }

  @Post('subscriptions/authorize')
  @HttpCode(HttpStatus.OK)
  authorize(@Body() body: unknown): Promise<AuthorizeRealtimeSubscriptionResponse> {
    return this.authorizer.authorize(authorizeRealtimeSubscriptionSchema.parse(body) as AuthorizeRealtimeSubscriptionRequest)
  }
}