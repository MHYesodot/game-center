import { Inject, Injectable } from '@nestjs/common'

import type { AllocationProvider } from '@game-center/contracts'

import type { GameServerAllocator, GameServerAllocatorRegistry } from '../application/allocations.ports.js'
import { TestGameServerAllocator } from './test-game-server-allocator.js'
import { UnavailableGameServerAllocator } from './unavailable-game-server-allocator.js'

@Injectable()
export class StaticGameServerAllocatorRegistry implements GameServerAllocatorRegistry {
  constructor(
    @Inject(UnavailableGameServerAllocator)
    private readonly unavailableAllocator: UnavailableGameServerAllocator,
    @Inject(TestGameServerAllocator)
    private readonly testAllocator: TestGameServerAllocator,
  ) {}

  get(provider: AllocationProvider): GameServerAllocator {
    if (provider === 'unavailable') {
      return this.unavailableAllocator
    }

    if (provider === 'test') {
      return this.testAllocator
    }

    throw new Error(`Unsupported allocation provider: ${provider}`)
  }
}