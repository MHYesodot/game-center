import { Controller, Get } from '@nestjs/common'

import { PlayersService } from '../application/players.service.js'

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get('status')
  status() {
    return this.playersService.status()
  }
}