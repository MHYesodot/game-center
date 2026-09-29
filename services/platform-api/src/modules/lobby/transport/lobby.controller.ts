import { Controller, Get } from '@nestjs/common'

import { LobbyService } from '../application/lobby.service.js'

@Controller()
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Get('lobbies')
  listLobbies() {
    return { lobbies: this.lobbyService.listLobbies() }
  }
}