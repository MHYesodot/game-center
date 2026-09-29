import { Module } from '@nestjs/common'

import { AuthService } from './application/auth.service.js'
import { AuthController } from './transport/auth.controller.js'
import { AuthRepository } from './infrastructure/auth.repository.js'

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}