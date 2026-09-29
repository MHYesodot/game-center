import { Injectable } from '@nestjs/common'
import type { AllocateServer, AllocatorDescriptor, ServerReady } from '@game-center/contracts'

import type { GameServerAllocator } from '../domain/game-server-allocator.js'

@Injectable()
export class NoopGameServerAllocator implements GameServerAllocator {
  describe(): AllocatorDescriptor {
    return {
      allocator: 'noop-dev',
      delivery: 'synchronous',
      targetRuntime: 'process',
    }
  }

  async allocate(command: AllocateServer): Promise<ServerReady> {
    return {
      allocationId: `pending-${command.sessionId}`,
      sessionId: command.sessionId,
      state: 'ready',
      endpoint: 'unassigned',
      transport: 'custom',
      occurredAt: new Date().toISOString(),
      region: command.region,
    }
  }
}