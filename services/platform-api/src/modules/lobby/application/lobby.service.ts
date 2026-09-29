import { Injectable } from '@nestjs/common'

import { InMemoryLobbyRepository } from '../infrastructure/lobby.repository.js'

@Injectable()
export class LobbyService {
  constructor(private readonly lobbyRepository: InMemoryLobbyRepository) {}

  listLobbies() {
    return this.lobbyRepository.list()
  }
}