import { Injectable } from '@nestjs/common'

import { MatchmakingRepository } from '../infrastructure/matchmaking.repository.js'

@Injectable()
export class MatchmakingService {
  constructor(private readonly matchmakingRepository: MatchmakingRepository) {}

  status() {
    const overview = this.matchmakingRepository.overview()

    return {
      module: 'matchmaking',
      status: 'active-seed',
      ephemeralStore: 'redis',
      queueCount: overview.queues.length,
      ticketCount: overview.tickets.length,
      proposalCount: overview.proposals.length,
      matchCount: overview.matches.length,
      overview,
    }
  }
}