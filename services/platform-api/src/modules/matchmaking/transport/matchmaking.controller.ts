import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req, UseGuards } from '@nestjs/common'
import type { CreateMatchmakingRequest, MatchProposalDetails, MatchmakingRequestDetails } from '@game-center/contracts'
import type { Request } from 'express'

import { AuthenticatedPlayerGuard } from '../../auth/transport/authenticated-player.guard.js'
import { MatchmakingService } from '../application/matchmaking.service.js'
import { requireMatchmakingIdentity } from './matchmaking.identity.js'
import { createMatchmakingRequestSchema } from './matchmaking.schemas.js'

@Controller('matchmaking')
export class MatchmakingController {
  constructor(@Inject(MatchmakingService) private readonly matchmakingService: MatchmakingService) {}

  @Post('requests')
  @UseGuards(AuthenticatedPlayerGuard)
  @HttpCode(HttpStatus.OK)
  enqueue(@Req() request: Request, @Body() body: unknown): Promise<MatchmakingRequestDetails> {
    return this.matchmakingService.enqueue(
      requireMatchmakingIdentity(request),
      createMatchmakingRequestSchema.parse(body) as CreateMatchmakingRequest,
    )
  }

  @Get('requests/:requestId')
  @UseGuards(AuthenticatedPlayerGuard)
  getRequest(@Param('requestId') requestId: string, @Req() request: Request): Promise<MatchmakingRequestDetails> {
    return this.matchmakingService.getRequest(requestId, requireMatchmakingIdentity(request))
  }

  @Post('requests/:requestId/cancel')
  @UseGuards(AuthenticatedPlayerGuard)
  @HttpCode(HttpStatus.OK)
  cancelRequest(@Param('requestId') requestId: string, @Req() request: Request): Promise<MatchmakingRequestDetails> {
    return this.matchmakingService.cancelRequest(requestId, requireMatchmakingIdentity(request))
  }

  @Get('proposals/:proposalId')
  @UseGuards(AuthenticatedPlayerGuard)
  getProposal(@Param('proposalId') proposalId: string, @Req() request: Request): Promise<MatchProposalDetails> {
    return this.matchmakingService.getProposal(proposalId, requireMatchmakingIdentity(request))
  }

  @Post('proposals/:proposalId/accept')
  @UseGuards(AuthenticatedPlayerGuard)
  @HttpCode(HttpStatus.OK)
  acceptProposal(@Param('proposalId') proposalId: string, @Req() request: Request): Promise<MatchProposalDetails> {
    return this.matchmakingService.acceptProposal(proposalId, requireMatchmakingIdentity(request))
  }

  @Post('proposals/:proposalId/reject')
  @UseGuards(AuthenticatedPlayerGuard)
  @HttpCode(HttpStatus.OK)
  rejectProposal(@Param('proposalId') proposalId: string, @Req() request: Request): Promise<MatchProposalDetails> {
    return this.matchmakingService.rejectProposal(proposalId, requireMatchmakingIdentity(request))
  }
}