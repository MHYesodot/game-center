import { Module } from '@nestjs/common'

import { PlayersService } from './application/players.service.js'
import { PlayersController } from './transport/players.controller.js'
import { PlayersRepository } from './infrastructure/players.repository.js'

@Module({
  controllers: [PlayersController],
  providers: [PlayersService, PlayersRepository],
})
export class PlayersModule {}