import { Inject, Injectable } from '@nestjs/common'
import type { GameServerAllocation } from '@game-center/contracts'

import {
  SESSION_ALLOCATION_ORCHESTRATOR,
  type SessionAllocationOrchestrator,
} from '../../../boundaries/session-allocation-orchestrator.js'
import type { SessionAllocationPort, SessionAllocationRequest } from '../application/sessions.ports.js'

@Injectable()
export class SessionAllocationPortAdapter implements SessionAllocationPort {
  constructor(
    @Inject(SESSION_ALLOCATION_ORCHESTRATOR)
    private readonly allocationOrchestrator: SessionAllocationOrchestrator,
  ) {}

  requestAllocation(input: SessionAllocationRequest): Promise<GameServerAllocation> {
    return this.allocationOrchestrator.requestAllocation(input)
  }

  getAllocation(sessionId: string): Promise<GameServerAllocation | null> {
    return this.allocationOrchestrator.getAllocation(sessionId)
  }

  releaseAllocation(sessionId: string): Promise<GameServerAllocation | null> {
    return this.allocationOrchestrator.releaseAllocation(sessionId)
  }
}