import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js'
import { JsonLogger } from './common/logging/json-logger.service.js'
import { InfrastructureModule } from './infrastructure/infrastructure.module.js'
import { validateEnv } from './infrastructure/config/env.schema.js'
import { HealthModule } from './modules/health/health.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { PlayersModule } from './modules/players/players.module.js'
import { CatalogModule } from './modules/catalog/catalog.module.js'
import { SocialModule } from './modules/social/social.module.js'
import { LobbyModule } from './modules/lobby/lobby.module.js'
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module.js'
import { SessionsModule } from './modules/sessions/sessions.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    InfrastructureModule,
    HealthModule,
    AuthModule,
    PlayersModule,
    CatalogModule,
    SocialModule,
    LobbyModule,
    MatchmakingModule,
    SessionsModule,
  ],
  providers: [JsonLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*')
  }
}