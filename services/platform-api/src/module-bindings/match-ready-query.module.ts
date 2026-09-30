import { Module } from '@nestjs/common'

import { MatchmakingModule } from '../modules/matchmaking/matchmaking.module.js'

@Module({
  imports: [MatchmakingModule],
  exports: [MatchmakingModule],
})
export class MatchReadyQueryModule {}