import { randomUUID } from 'node:crypto'

import { Module } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import { CLOCK } from '../../boundaries/clock.js'
import { ID_GENERATOR } from '../../boundaries/id-generator.js'
import { DATABASE_POOL } from '../../infrastructure/infrastructure.tokens.js'
import { CatalogQueryModule } from '../../module-bindings/catalog-query.module.js'
import { LobbyService } from './application/lobby.service.js'
import { LOBBY_REPOSITORY, LOBBY_RUNTIME_STORE } from './application/lobby.ports.js'
import { PostgresLobbyRepository } from './infrastructure/persistence/repositories/postgres-lobby.repository.js'
import { LobbyController } from './transport/lobby.controller.js'
import { RedisLobbyRuntimeStore } from './infrastructure/runtime/redis-lobby-runtime.store.js'
import { LOBBY_DRIZZLE_DB } from './infrastructure/persistence/lobby.persistence.js'
import * as lobbySchema from './infrastructure/persistence/schema/lobby.schema.js'

@Module({
  imports: [CatalogQueryModule],
  controllers: [LobbyController],
  providers: [
    LobbyService,
    PostgresLobbyRepository,
    RedisLobbyRuntimeStore,
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
      provide: LOBBY_DRIZZLE_DB,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema: lobbySchema }),
    },
    {
      provide: LOBBY_REPOSITORY,
      useExisting: PostgresLobbyRepository,
    },
    {
      provide: LOBBY_RUNTIME_STORE,
      useExisting: RedisLobbyRuntimeStore,
    },
  ],
  exports: [LobbyService],
})
export class LobbyModule {}