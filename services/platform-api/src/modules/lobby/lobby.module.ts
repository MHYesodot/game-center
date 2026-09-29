import { Module } from '@nestjs/common'

import { LobbyService } from './application/lobby.service.js'
import { LobbyController } from './transport/lobby.controller.js'
import { InMemoryLobbyRepository } from './infrastructure/lobby.repository.js'

@Module({
  controllers: [LobbyController],
  providers: [LobbyService, InMemoryLobbyRepository],
})
export class LobbyModule {}