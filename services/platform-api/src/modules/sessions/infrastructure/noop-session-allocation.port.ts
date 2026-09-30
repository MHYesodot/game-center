import { Injectable } from '@nestjs/common'

import type { SessionAllocationPort, SessionAllocationRequest } from '../application/sessions.ports.js'

@Injectable()
export class NoopSessionAllocationPort implements SessionAllocationPort {
  async requestAllocation(_input: SessionAllocationRequest): Promise<void> {}
}