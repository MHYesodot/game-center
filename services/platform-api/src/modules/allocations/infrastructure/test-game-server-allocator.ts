import { Injectable } from '@nestjs/common'
import type { AllocationRequest, ProviderAllocationResult } from '@game-center/contracts'

import type { GameServerAllocator } from '../application/allocations.ports.js'

@Injectable()
export class TestGameServerAllocator implements GameServerAllocator {
  private readonly allocations = new Map<string, ProviderAllocationResult>()

  async allocate(request: AllocationRequest): Promise<ProviderAllocationResult> {
    const existing = this.allocations.get(request.allocationId)

    if (existing) {
      return existing
    }

    const created: ProviderAllocationResult = {
      providerReference: `test-${request.allocationId}`,
      status: 'ready',
      connection: {
        transport: 'websocket',
        host: 'test.game.local',
        port: 7443,
        secure: true,
        protocolVersion: request.protocolVersion,
        tokenReference: `alloc:${request.allocationId}`,
        expiresAt: null,
      },
    }

    this.allocations.set(request.allocationId, created)
    return created
  }

  async getAllocation(reference: { allocationId: string }): Promise<ProviderAllocationResult | null> {
    return this.allocations.get(reference.allocationId) ?? null
  }

  async release(reference: { allocationId: string }): Promise<void> {
    this.allocations.delete(reference.allocationId)
  }
}