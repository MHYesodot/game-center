import { Module } from '@nestjs/common'

import { AllocationsModule } from '../modules/allocations/allocations.module.js'

@Module({
  imports: [AllocationsModule],
  exports: [AllocationsModule],
})
export class SessionAllocationOrchestratorModule {}