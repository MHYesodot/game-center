import { randomUUID } from 'node:crypto'

import { Module } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import { CLOCK } from '../../boundaries/clock.js'
import { ID_GENERATOR } from '../../boundaries/id-generator.js'
import { DATABASE_POOL } from '../../infrastructure/infrastructure.tokens.js'
import { CatalogQueryModule } from '../../module-bindings/catalog-query.module.js'
import { MatchmakingService } from './application/matchmaking.service.js'
import {
  MATCHMAKING_QUEUE_STORE,
  MATCHMAKING_REPOSITORY,
  MATCH_READY_SINK,
} from './application/matchmaking.ports.js'
import { FifoMatchmakingStrategy, MATCHMAKING_STRATEGY } from './domain/matchmaking-strategy.js'
import { MatchmakingController } from './transport/matchmaking.controller.js'
import { MATCHMAKING_DRIZZLE_DB } from './infrastructure/persistence/matchmaking.persistence.js'
import { PostgresMatchmakingRepository } from './infrastructure/persistence/repositories/postgres-matchmaking.repository.js'
import * as matchmakingSchema from './infrastructure/persistence/schema/matchmaking.schema.js'
import { RedisMatchmakingQueueStore } from './infrastructure/runtime/redis-matchmaking-queue.store.js'

@Module({
  imports: [CatalogQueryModule],
  controllers: [MatchmakingController],
  providers: [
    MatchmakingService,
    PostgresMatchmakingRepository,
    RedisMatchmakingQueueStore,
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
      provide: MATCHMAKING_STRATEGY,
      useClass: FifoMatchmakingStrategy,
    },
    {
      provide: MATCH_READY_SINK,
      useValue: {
        async onMatchReady() {},
      },
    },
    {
      provide: MATCHMAKING_DRIZZLE_DB,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema: matchmakingSchema }),
    },
    {
      provide: MATCHMAKING_REPOSITORY,
      useExisting: PostgresMatchmakingRepository,
    },
    {
      provide: MATCHMAKING_QUEUE_STORE,
      useExisting: RedisMatchmakingQueueStore,
    },
  ],
})
export class MatchmakingModule {}