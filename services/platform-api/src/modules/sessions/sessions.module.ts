import { Module } from '@nestjs/common'

import { SessionsService } from './application/sessions.service.js'
import { SessionsController } from './transport/sessions.controller.js'
import { SessionsRepository } from './infrastructure/sessions.repository.js'
import { NoopGameServerAllocator } from './infrastructure/noop-game-server-allocator.js'

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, SessionsRepository, NoopGameServerAllocator],
})
export class SessionsModule {}