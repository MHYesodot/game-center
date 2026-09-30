import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common'

import { ReadinessService } from '../../infrastructure/readiness.service.js'

@Controller('health')
export class HealthController {
  private readonly readinessService: ReadinessService

  constructor(@Inject(ReadinessService) readinessService: ReadinessService) {
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
    const dependencies = await this.readinessService.readiness()

    if (Object.values(dependencies).every((state) => state === 'up')) {
      return { ok: true, service: 'platform-api', status: 'ready', dependencies }
    }

    throw new HttpException(
      {
        ok: false,
        service: 'platform-api',
        status: 'not_ready',
        dependencies,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    )
  }
}