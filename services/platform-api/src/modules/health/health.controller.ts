import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'

import { ReadinessService } from '../../infrastructure/readiness.service.js'

@Controller('health')
export class HealthController {
  private readonly readinessService: ReadinessService

  constructor(readinessService: ReadinessService) {
    this.readinessService = readinessService
    this.live = this.live.bind(this)
    this.ready = this.ready.bind(this)
  }

  @Get('live')
  live() {
    return { ok: true, service: 'platform-api', status: 'live' }
  }

  @Get('ready')
  async ready() {
    try {
      const dependencies = await this.readinessService.readiness()
      return { ok: true, service: 'platform-api', status: 'ready', dependencies }
    } catch (error) {
      throw new HttpException(
        {
          ok: false,
          service: 'platform-api',
          status: 'not-ready',
          message: error instanceof Error ? error.message : 'Unknown readiness failure',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }
  }
}