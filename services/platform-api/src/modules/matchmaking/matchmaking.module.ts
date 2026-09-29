import { Module } from '@nestjs/common'

import { MatchmakingService } from './application/matchmaking.service.js'
import { MatchmakingController } from './transport/matchmaking.controller.js'
import { MatchmakingRepository } from './infrastructure/matchmaking.repository.js'

@Module({
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingRepository],
})
export class MatchmakingModule {}