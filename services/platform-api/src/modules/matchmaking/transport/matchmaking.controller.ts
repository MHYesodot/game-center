import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common'
import type { CreateMatchmakingRequest, MatchProposalDetails, MatchmakingRequestDetails } from '@game-center/contracts'
import type { Request } from 'express'

import { MatchmakingService } from '../application/matchmaking.service.js'
import { requireMatchmakingIdentity } from './matchmaking.identity.js'
import { createMatchmakingRequestSchema } from './matchmaking.schemas.js'

@Controller('matchmaking')
export class MatchmakingController {
  constructor(@Inject(MatchmakingService) private readonly matchmakingService: MatchmakingService) {}

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  enqueue(@Req() request: Request, @Body() body: unknown): Promise<MatchmakingRequestDetails> {
    return this.matchmakingService.enqueue(
      requireMatchmakingIdentity(request),
      createMatchmakingRequestSchema.parse(body) as CreateMatchmakingRequest,
    )
  }

  @Get('requests/:requestId')
  getRequest(@Param('requestId') requestId: string, @Req() request: Request): Promise<MatchmakingRequestDetails> {
    return this.matchmakingService.getRequest(requestId, requireMatchmakingIdentity(request))
  }

  @Post('requests/:requestId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelRequest(@Param('requestId') requestId: string, @Req() request: Request): Promise<MatchmakingRequestDetails> {
    return this.matchmakingService.cancelRequest(requestId, requireMatchmakingIdentity(request))
  }

  @Get('proposals/:proposalId')
  getProposal(@Param('proposalId') proposalId: string, @Req() request: Request): Promise<MatchProposalDetails> {
    return this.matchmakingService.getProposal(proposalId, requireMatchmakingIdentity(request))
  }

  @Post('proposals/:proposalId/accept')
  @HttpCode(HttpStatus.OK)
  acceptProposal(@Param('proposalId') proposalId: string, @Req() request: Request): Promise<MatchProposalDetails> {
    return this.matchmakingService.acceptProposal(proposalId, requireMatchmakingIdentity(request))
  }

  @Post('proposals/:proposalId/reject')
  @HttpCode(HttpStatus.OK)
  rejectProposal(@Param('proposalId') proposalId: string, @Req() request: Request): Promise<MatchProposalDetails> {
    return this.matchmakingService.rejectProposal(proposalId, requireMatchmakingIdentity(request))
  }
}