import { Controller, Get } from '@nestjs/common'

import { SessionsService } from '../application/sessions.service.js'

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('status')
  status() {
    return this.sessionsService.status()
  }
}