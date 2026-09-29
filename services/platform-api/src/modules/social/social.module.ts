import { Module } from '@nestjs/common'

import { SocialService } from './application/social.service.js'
import { SocialController } from './transport/social.controller.js'
import { SocialRepository } from './infrastructure/social.repository.js'

@Module({
  controllers: [SocialController],
  providers: [SocialService, SocialRepository],
})
export class SocialModule {}