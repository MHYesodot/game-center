import { describe, expect, it, vi } from 'vitest'

import { RealtimeSubscriptionAuthorizerService } from './realtime-subscription-authorizer.service.js'
import { LobbyService } from '../../lobby/application/lobby.service.js'
import { MatchmakingService } from '../../matchmaking/application/matchmaking.service.js'
import { SessionsService } from '../../sessions/application/sessions.service.js'

describe('RealtimeSubscriptionAuthorizerService', () => {
  it('allows player self-subscriptions', async () => {
    const service = createHarness()

    await expect(service.authorizer.authorize({ playerId: 'player-a', target: { kind: 'player' } })).resolves.toEqual({
      allowed: true,
      channel: 'player:player-a',
    })
  })

  it('authorizes lobby subscriptions through lobby ownership rules', async () => {
    const service = createHarness({ canObserveLobby: true })

    await expect(service.authorizer.authorize({ playerId: 'player-a', target: { kind: 'lobby', lobbyId: 'lobby-1' } })).resolves.toEqual({
      allowed: true,
      channel: 'lobby:lobby-1',
    })
    await expect(service.authorizer.authorize({ playerId: 'player-b', target: { kind: 'lobby', lobbyId: 'lobby-2' } })).resolves.toEqual({
      allowed: true,
      channel: 'lobby:lobby-2',
    })
    expect(service.lobbyCanObserve).toHaveBeenCalledTimes(2)
  })

  it('denies unauthorized lobby subscriptions', async () => {
    const service = createHarness({ canObserveLobby: false })

    await expect(service.authorizer.authorize({ playerId: 'player-a', target: { kind: 'lobby', lobbyId: 'lobby-1' } })).resolves.toEqual({
      allowed: false,
      channel: null,
    })
  })

  it('allows and denies matchmaking request subscriptions through matchmaking ownership rules', async () => {
    const allowedHarness = createHarness({ canObserveRequest: true })
    await expect(
      allowedHarness.authorizer.authorize({ playerId: 'player-a', target: { kind: 'matchmakingRequest', requestId: 'request-1' } }),
    ).resolves.toEqual({
      allowed: true,
      channel: 'matchmaking:request:request-1',
    })

    const deniedHarness = createHarness({ canObserveRequest: false })
    await expect(
      deniedHarness.authorizer.authorize({ playerId: 'player-b', target: { kind: 'matchmakingRequest', requestId: 'request-2' } }),
    ).resolves.toEqual({
      allowed: false,
      channel: null,
    })
  })

  it('allows and denies session subscriptions through participant membership rules', async () => {
    const allowedHarness = createHarness({ canObserveSession: true })
    await expect(
      allowedHarness.authorizer.authorize({ playerId: 'player-a', target: { kind: 'session', sessionId: 'session-1' } }),
    ).resolves.toEqual({
      allowed: true,
      channel: 'session:session-1',
    })

    const deniedHarness = createHarness({ canObserveSession: false })
    await expect(
      deniedHarness.authorizer.authorize({ playerId: 'player-b', target: { kind: 'session', sessionId: 'session-2' } }),
    ).resolves.toEqual({
      allowed: false,
      channel: null,
    })
  })
})

function createHarness(overrides: {
  canObserveLobby?: boolean
  canObserveRequest?: boolean
  canObserveSession?: boolean
} = {}) {
  const lobbyCanObserve = vi.fn(async () => overrides.canObserveLobby ?? false)
  const matchmakingCanObserve = vi.fn(async () => overrides.canObserveRequest ?? false)
  const sessionsCanObserve = vi.fn(async () => overrides.canObserveSession ?? false)

  const authorizer = new RealtimeSubscriptionAuthorizerService(
    { canObserveLobby: lobbyCanObserve } as unknown as LobbyService,
    { canObserveRequest: matchmakingCanObserve } as unknown as MatchmakingService,
    { canObserveSession: sessionsCanObserve } as unknown as SessionsService,
  )

  return {
    authorizer,
    lobbyCanObserve,
    matchmakingCanObserve,
    sessionsCanObserve,
  }
}