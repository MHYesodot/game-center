import { Injectable } from '@nestjs/common'

import { AllocationProviderError } from '../application/allocations.errors.js'
import type { GameServerAllocator } from '../application/allocations.ports.js'

@Injectable()
export class UnavailableGameServerAllocator implements GameServerAllocator {
  async allocate(): Promise<never> {
    throw new AllocationProviderError('ALLOCATION_PROVIDER_UNAVAILABLE', 'No real game-server allocator is configured in P02 runtime')
  }

  async getAllocation(): Promise<null> {
    return null
  }

  async release(): Promise<void> {
    throw new AllocationProviderError('ALLOCATION_PROVIDER_UNAVAILABLE', 'No real game-server allocator is configured in P02 runtime')
  }
}