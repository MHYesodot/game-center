import { Controller, Get } from '@nestjs/common'

import { MatchmakingService } from '../application/matchmaking.service.js'

@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Get('status')
  status() {
    return this.matchmakingService.status()
  }
}