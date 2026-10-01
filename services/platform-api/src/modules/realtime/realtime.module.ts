import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module.js'
import { RealtimeInternalController } from './transport/realtime-internal.controller.js'
import { RealtimeSubscriptionAuthorizerService } from './application/realtime-subscription-authorizer.service.js'
import { LobbyModule } from '../lobby/lobby.module.js'
import { MatchmakingModule } from '../matchmaking/matchmaking.module.js'
import { SessionsModule } from '../sessions/sessions.module.js'

@Module({
  imports: [AuthModule, LobbyModule, MatchmakingModule, SessionsModule],
  controllers: [RealtimeInternalController],
  providers: [RealtimeSubscriptionAuthorizerService],
})
export class RealtimeModule {}