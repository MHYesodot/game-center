import { randomUUID } from 'node:crypto'

import { Module } from '@nestjs/common'
import type { Pool } from 'pg'

import { SESSION_MATCH_READY_HANDLER } from '../../boundaries/session-match-ready-handler.js'
import { CLOCK } from '../../boundaries/clock.js'
import { ID_GENERATOR } from '../../boundaries/id-generator.js'
import { DATABASE_POOL } from '../../infrastructure/infrastructure.tokens.js'
import { MatchReadyQueryModule } from '../../module-bindings/match-ready-query.module.js'
import { SessionAllocationOrchestratorModule } from '../../module-bindings/session-allocation-orchestrator.module.js'
import { SessionsService } from './application/sessions.service.js'
import { SESSION_ALLOCATION_PORT, SESSION_REPOSITORY } from './application/sessions.ports.js'
import { SessionsController } from './transport/sessions.controller.js'
import { createSessionsDatabase, SESSIONS_DRIZZLE_DB } from './infrastructure/persistence/session.persistence.js'
import { PostgresSessionRepository } from './infrastructure/persistence/repositories/postgres-session.repository.js'
import { SessionAllocationPortAdapter } from './infrastructure/session-allocation.port.adapter.js'

@Module({
  imports: [MatchReadyQueryModule, SessionAllocationOrchestratorModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    PostgresSessionRepository,
    SessionAllocationPortAdapter,
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
      provide: SESSIONS_DRIZZLE_DB,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => createSessionsDatabase(pool),
    },
    {
      provide: SESSION_REPOSITORY,
      useExisting: PostgresSessionRepository,
    },
    {
      provide: SESSION_ALLOCATION_PORT,
      useExisting: SessionAllocationPortAdapter,
    },
    {
      provide: SESSION_MATCH_READY_HANDLER,
      useExisting: SessionsService,
    },
  ],
  exports: [SessionsService],
})
export class SessionsModule {}