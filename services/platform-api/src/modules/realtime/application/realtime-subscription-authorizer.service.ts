import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import type {
  AuthorizeRealtimeSubscriptionRequest,
  AuthorizeRealtimeSubscriptionResponse,
  RealtimeChannel,
  ResolveRealtimeIdentityRequest,
  ResolveRealtimeIdentityResponse,
} from '@game-center/contracts'

import { LobbyService } from '../../lobby/application/lobby.service.js'
import { MatchmakingService } from '../../matchmaking/application/matchmaking.service.js'
import { SessionsService } from '../../sessions/application/sessions.service.js'

@Injectable()
export class RealtimeSubscriptionAuthorizerService {
  constructor(
    @Inject(LobbyService) private readonly lobbyService: LobbyService,
    @Inject(MatchmakingService) private readonly matchmakingService: MatchmakingService,
    @Inject(SessionsService) private readonly sessionsService: SessionsService,
  ) {}

  async resolveIdentity(request: ResolveRealtimeIdentityRequest): Promise<ResolveRealtimeIdentityResponse> {
    const playerId = request.playerId.trim()

    if (!playerId) {
      throw new HttpException({ code: 'INVALID_PLAYER_ID' }, HttpStatus.BAD_REQUEST)
    }

    return { playerId }
  }

  async authorize(request: AuthorizeRealtimeSubscriptionRequest): Promise<AuthorizeRealtimeSubscriptionResponse> {
    const playerId = request.playerId.trim()

    if (!playerId) {
      throw new HttpException({ code: 'INVALID_PLAYER_ID' }, HttpStatus.BAD_REQUEST)
    }

    switch (request.target.kind) {
      case 'player':
        return { allowed: true, channel: this.playerChannel(playerId) }
      case 'lobby': {
        const allowed = await this.lobbyService.canObserveLobby(request.target.lobbyId, playerId)
        return { allowed, channel: allowed ? this.lobbyChannel(request.target.lobbyId) : null }
      }
      case 'matchmakingRequest': {
        const allowed = await this.matchmakingService.canObserveRequest(request.target.requestId, playerId)
        return { allowed, channel: allowed ? this.matchmakingRequestChannel(request.target.requestId) : null }
      }
      case 'session': {
        const allowed = await this.sessionsService.canObserveSession(request.target.sessionId, playerId)
        return { allowed, channel: allowed ? this.sessionChannel(request.target.sessionId) : null }
      }
      default:
        return { allowed: false, channel: null }
    }
  }

  private playerChannel(playerId: string): RealtimeChannel {
    return `player:${playerId}`
  }

  private lobbyChannel(lobbyId: string): RealtimeChannel {
    return `lobby:${lobbyId}`
  }

  private matchmakingRequestChannel(requestId: string): RealtimeChannel {
    return `matchmaking:request:${requestId}`
  }

  private sessionChannel(sessionId: string): RealtimeChannel {
    return `session:${sessionId}`
  }
}