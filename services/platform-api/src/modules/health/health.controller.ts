import { Controller, Get, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common'

import { ALLOCATION_PROVIDER_READINESS, type AllocationProviderReadiness } from '../../boundaries/allocation-provider-readiness.js'
import { ReadinessService } from '../../infrastructure/readiness.service.js'

@Controller('health')
export class HealthController {
  private readonly readinessService: ReadinessService
  private readonly allocationProviderReadiness: AllocationProviderReadiness | null

  constructor(
    @Inject(ReadinessService) readinessService: ReadinessService,
    @Optional() @Inject(ALLOCATION_PROVIDER_READINESS) allocationProviderReadiness?: AllocationProviderReadiness,
  ) {
    this.readinessService = readinessService
    this.allocationProviderReadiness = allocationProviderReadiness ?? null
    this.live = this.live.bind(this)
    this.ready = this.ready.bind(this)
  }

  @Get('live')
  live() {
    return { ok: true, service: 'platform-api', status: 'live' }
  }

  @Get('ready')
  async ready() {
    const dependencies = await this.readinessService.readiness(this.allocationProviderReadiness)

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