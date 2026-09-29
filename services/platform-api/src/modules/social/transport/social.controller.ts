import { Controller, Get } from '@nestjs/common'

import { SocialService } from '../application/social.service.js'

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('status')
  status() {
    return this.socialService.status()
  }
}