import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Put, Req } from '@nestjs/common'
import type { CreateLobbyRequest, JoinLobbyRequest, LobbyDetails, SetLobbyReadyRequest } from '@game-center/contracts'
import type { Request } from 'express'

import { LobbyService } from '../application/lobby.service.js'
import { requireLobbyIdentity } from './lobby.identity.js'
import {
  createLobbyRequestSchema,
  joinLobbyRequestSchema,
  setLobbyReadyRequestSchema,
} from './lobby.schemas.js'

@Controller('lobbies')
export class LobbyController {
  constructor(@Inject(LobbyService) private readonly lobbyService: LobbyService) {}

  @Post()
  createLobby(@Req() request: Request, @Body() body: unknown): Promise<LobbyDetails> {
    return this.lobbyService.createLobby(requireLobbyIdentity(request), createLobbyRequestSchema.parse(body) as CreateLobbyRequest)
  }

  @Get(':lobbyId')
  getLobby(@Param('lobbyId') lobbyId: string): Promise<LobbyDetails> {
    return this.lobbyService.getLobby(lobbyId)
  }

  @Post(':lobbyId/join')
  @HttpCode(HttpStatus.OK)
  joinLobby(@Param('lobbyId') lobbyId: string, @Req() request: Request, @Body() body: unknown): Promise<LobbyDetails> {
    return this.lobbyService.joinLobby(
      lobbyId,
      requireLobbyIdentity(request),
      joinLobbyRequestSchema.parse(body ?? {}) as JoinLobbyRequest,
    )
  }

  @Post(':lobbyId/leave')
  @HttpCode(HttpStatus.OK)
  leaveLobby(@Param('lobbyId') lobbyId: string, @Req() request: Request): Promise<LobbyDetails> {
    return this.lobbyService.leaveLobby(lobbyId, requireLobbyIdentity(request))
  }

  @Put(':lobbyId/ready')
  setReady(@Param('lobbyId') lobbyId: string, @Req() request: Request, @Body() body: unknown): Promise<LobbyDetails> {
    return this.lobbyService.setReady(
      lobbyId,
      requireLobbyIdentity(request),
      setLobbyReadyRequestSchema.parse(body) as SetLobbyReadyRequest,
    )
  }

  @Post(':lobbyId/start')
  @HttpCode(HttpStatus.OK)
  startLobby(@Param('lobbyId') lobbyId: string, @Req() request: Request): Promise<LobbyDetails> {
    return this.lobbyService.startLobby(lobbyId, requireLobbyIdentity(request))
  }

  @Post(':lobbyId/close')
  @HttpCode(HttpStatus.OK)
  closeLobby(@Param('lobbyId') lobbyId: string, @Req() request: Request): Promise<LobbyDetails> {
    return this.lobbyService.closeLobby(lobbyId, requireLobbyIdentity(request))
  }
}