import { randomUUID } from 'node:crypto'

import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Pool } from 'pg'

import { CLOCK } from '../../boundaries/clock.js'
import { ID_GENERATOR } from '../../boundaries/id-generator.js'
import { DATABASE_POOL } from '../../infrastructure/infrastructure.tokens.js'
import { AuthService } from './application/auth.service.js'
import {
  AUTH_HASHER,
  AUTH_REPOSITORY,
  AUTH_SECRET_GENERATOR,
  AUTH_SETTINGS,
} from './application/auth.ports.js'
import { NodeCryptoAuthHasher, NodeCryptoSecretGenerator } from './infrastructure/crypto/node-crypto-auth-hasher.js'
import { createAuthDatabase, AUTH_DRIZZLE_DB } from './infrastructure/persistence/auth.persistence.js'
import { PostgresAuthRepository } from './infrastructure/persistence/repositories/postgres-auth.repository.js'
import { AuthController } from './transport/auth.controller.js'
import { AuthenticatedPlayerGuard } from './transport/authenticated-player.guard.js'
import { RealtimeGatewayGuard } from './transport/realtime-gateway.guard.js'

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PostgresAuthRepository,
    NodeCryptoAuthHasher,
    NodeCryptoSecretGenerator,
    AuthenticatedPlayerGuard,
    RealtimeGatewayGuard,
    {
      provide: CLOCK,
      useValue: {
        now: () => new Date(),
      },
    },
    {
      provide: ID_GENERATOR,
      useValue: {
        nextId: () => randomUUID(),
      },
    },
    {
      provide: AUTH_DRIZZLE_DB,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => createAuthDatabase(pool),
    },
    {
      provide: AUTH_REPOSITORY,
      useExisting: PostgresAuthRepository,
    },
    {
      provide: AUTH_HASHER,
      useExisting: NodeCryptoAuthHasher,
    },
    {
      provide: AUTH_SECRET_GENERATOR,
      useExisting: NodeCryptoSecretGenerator,
    },
    {
      provide: AUTH_SETTINGS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        sessionTtlMs: Number(configService.get('AUTH_SESSION_TTL_MS') ?? 30 * 24 * 60 * 60 * 1000),
        realtimeTicketTtlMs: Number(configService.get('AUTH_REALTIME_TICKET_TTL_MS') ?? 60_000),
      }),
    },
  ],
  exports: [AuthService, AuthenticatedPlayerGuard, RealtimeGatewayGuard],
})
export class AuthModule {}