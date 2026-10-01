import { Module } from '@nestjs/common'

import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js'
import { AllocationProviderReadinessModule } from '../../module-bindings/allocation-provider-readiness.module.js'
import { HealthController } from './health.controller.js'

@Module({
  imports: [InfrastructureModule, AllocationProviderReadinessModule],
  controllers: [HealthController],
})
export class HealthModule {}