import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common'
import type { CreateSessionRequest, GameServerAllocation, GameSession } from '@game-center/contracts'
import type { Request } from 'express'

import { SessionsService } from '../application/sessions.service.js'
import { requireSessionIdentity } from './session.identity.js'
import { createSessionRequestSchema } from './session.schemas.js'

@Controller('sessions')
export class SessionsController {
  constructor(@Inject(SessionsService) private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  createSession(@Req() request: Request, @Body() body: unknown): Promise<GameSession> {
    return this.sessionsService.createSession(requireSessionIdentity(request), createSessionRequestSchema.parse(body) as CreateSessionRequest)
  }

  @Get(':sessionId')
  getSession(@Param('sessionId') sessionId: string, @Req() request: Request): Promise<GameSession> {
    return this.sessionsService.getSession(sessionId, requireSessionIdentity(request))
  }

  @Post(':sessionId/allocation')
  @HttpCode(HttpStatus.OK)
  requestAllocation(@Param('sessionId') sessionId: string, @Req() request: Request): Promise<GameServerAllocation> {
    return this.sessionsService.requestAllocation(sessionId, requireSessionIdentity(request))
  }

  @Get(':sessionId/allocation')
  getAllocation(@Param('sessionId') sessionId: string, @Req() request: Request): Promise<GameServerAllocation> {
    return this.sessionsService.getAllocation(sessionId, requireSessionIdentity(request))
  }

  @Post(':sessionId/allocation/release')
  @HttpCode(HttpStatus.OK)
  releaseAllocation(@Param('sessionId') sessionId: string, @Req() request: Request): Promise<GameServerAllocation> {
    return this.sessionsService.releaseAllocation(sessionId, requireSessionIdentity(request))
  }

  @Post(':sessionId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelSession(@Param('sessionId') sessionId: string, @Req() request: Request): Promise<GameSession> {
    return this.sessionsService.cancelSession(sessionId, requireSessionIdentity(request))
  }
}