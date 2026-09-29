import { Injectable } from '@nestjs/common'

import { SessionsRepository } from '../infrastructure/sessions.repository.js'
import { NoopGameServerAllocator } from '../infrastructure/noop-game-server-allocator.js'

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly gameServerAllocator: NoopGameServerAllocator,
  ) {}

  status() {
    const overview = this.sessionsRepository.overview()

    return {
      module: 'sessions',
      status: 'active-seed',
      allocationStrategy: this.gameServerAllocator.describe(),
      sessionCount: overview.sessions.length,
      allocationCount: overview.allocations.length,
      overview,
    }
  }
}