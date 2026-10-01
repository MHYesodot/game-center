import { describe, expect, it, vi } from 'vitest'
import type { GameServerAllocation, MatchReadyPayload } from '@game-center/contracts'

import type { MatchReadyQuery } from '../../../boundaries/match-ready-query.js'
import type { Clock } from '../../../boundaries/clock.js'
import type { IdGenerator } from '../../../boundaries/id-generator.js'
import type { DurableGameSession, DurableGameSessionAggregate } from '../domain/game-session.js'
import type { SessionRequestIdentity } from './sessions.identity.js'
import type { SessionAllocationPort, SessionRepository, SessionRepositoryTransaction } from './sessions.ports.js'
import { SessionsService } from './sessions.service.js'

describe('SessionsService', () => {
  it('creates a durable session from a trusted match and transitions it to allocating', async () => {
    const harness = createHarness()

    const session = await harness.service.createSession(identity('player-1'), { matchId: 'match-1' })

    expect(session.sessionId).toBe('session-1')
    expect(session.status).toBe('allocating')
    expect(session.participants).toEqual([
      {
        playerId: 'player-1',
        sourceRequestId: 'request-1',
        sourceLobbyId: 'lobby-1',
        joinedAt: harness.now,
      },
      {
        playerId: 'player-2',
        sourceRequestId: 'request-2',
        sourceLobbyId: null,
        joinedAt: harness.now,
      },
    ])
    expect(harness.allocation.requests).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        matchId: 'match-1',
        playerIds: ['player-1', 'player-2'],
      }),
    ])
  })

  it('transitions the session to ready when allocation returns ready immediately', async () => {
    const harness = createHarness({ allocationStatus: 'ready' })

    const session = await harness.service.createSession(identity('player-1'), { matchId: 'match-1' })

    expect(session.status).toBe('ready')
  })

  it('keeps create idempotent for an existing authorized participant', async () => {
    const harness = createHarness({ session: buildAggregate({ status: 'allocating' }) })

    const session = await harness.service.createSession(identity('player-2'), { matchId: 'match-1' })

    expect(session.sessionId).toBe('session-1')
    expect(session.status).toBe('allocating')
    expect(harness.allocation.requests).toHaveLength(0)
  })

  it('rejects create when the caller is not part of the trusted match', async () => {
    const harness = createHarness()

    await expect(harness.service.createSession(identity('player-9'), { matchId: 'match-1' })).rejects.toMatchObject({
      response: { code: 'MATCH_NOT_READY' },
    })
  })

  it('returns only sessions visible to participants', async () => {
    const harness = createHarness({ session: buildAggregate({ status: 'allocating' }) })

    await expect(harness.service.getSession('session-1', identity('player-9'))).rejects.toMatchObject({
      response: { code: 'SESSION_NOT_FOUND' },
    })
  })

  it('cancels a ready-path session before it becomes active', async () => {
    const harness = createHarness({ session: buildAggregate({ status: 'ready' }) })

    const session = await harness.service.cancelSession('session-1', identity('player-1'))

    expect(session.status).toBe('cancelled')
    expect(session.cancelledAt).toBe(harness.now)
  })

  it('maps allocation request failure to controlled session creation failure', async () => {
    const harness = createHarness({ allocationFailure: new Error('allocator unavailable') })

    await expect(harness.service.createSession(identity('player-1'), { matchId: 'match-1' })).rejects.toMatchObject({
      response: { code: 'SESSION_CREATION_FAILED' },
    })

    expect(await harness.repository.getByMatchId('match-1')).toMatchObject({
      status: 'failed',
      failureCode: 'ALLOCATION_REQUEST_FAILED',
    })
  })

  it('maps postgres connectivity failures to SESSION_UNAVAILABLE', async () => {
    const harness = createHarness({ repositoryFailure: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }) })

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(harness.service.createSession(identity('player-1'), { matchId: 'match-1' })).rejects.toMatchObject({
      response: { code: 'SESSION_UNAVAILABLE' },
    })
    errorSpy.mockRestore()
  })
})

function createHarness(options: {
  session?: DurableGameSessionAggregate
  allocationFailure?: Error
  repositoryFailure?: Error
  matchReady?: MatchReadyPayload | null
  allocationStatus?: GameServerAllocation['status']
} = {}) {
  const now = '2026-09-30T11:00:00.000Z'
  const repository = new InMemorySessionRepository(options.session, options.repositoryFailure)
  const allocation = new FakeSessionAllocationPort(options.allocationFailure, options.allocationStatus)
  const matchReadyQuery: MatchReadyQuery = {
    async getMatchReady(matchId: string) {
      if (options.matchReady !== undefined) {
        return options.matchReady
      }

      if (matchId !== 'match-1') {
        return null
      }

      return buildMatchReadyPayload()
    },
  }
  const clock: Clock = {
    now: () => new Date(now),
  }
  const idGenerator: IdGenerator = {
    nextId: () => 'session-1',
  }

  return {
    now,
    repository,
    allocation,
    service: new SessionsService(repository, allocation, matchReadyQuery, clock, idGenerator),
  }
}

class InMemorySessionRepository implements SessionRepository {
  private session: DurableGameSessionAggregate | null

  constructor(session: DurableGameSessionAggregate | undefined, private readonly failure?: Error) {
    this.session = session ?? null
  }

  async getById(sessionId: string): Promise<DurableGameSessionAggregate | null> {
    this.throwIfConfigured()
    return this.session?.sessionId === sessionId ? structuredClone(this.session) : null
  }

  async getByMatchId(matchId: string): Promise<DurableGameSessionAggregate | null> {
    this.throwIfConfigured()
    return this.session?.matchId === matchId ? structuredClone(this.session) : null
  }

  async withTransaction<T>(callback: (transaction: SessionRepositoryTransaction) => Promise<T>): Promise<T> {
    this.throwIfConfigured()
    return callback({
      getById: async (sessionId: string) => this.getById(sessionId),
      getByIdForUpdate: async (sessionId: string) => this.getById(sessionId),
      getByMatchId: async (matchId: string) => this.getByMatchId(matchId),
      getByMatchIdForUpdate: async (matchId: string) => this.getByMatchId(matchId),
      createSession: async (input) => {
        this.session = structuredClone(input)
      },
      updateSession: async (session: DurableGameSession) => {
        if (!this.session) {
          return
        }

        this.session = {
          ...session,
          participants: this.session.participants,
        }
      },
    })
  }

  private throwIfConfigured() {
    if (this.failure) {
      throw this.failure
    }
  }
}

class FakeSessionAllocationPort implements SessionAllocationPort {
  readonly requests: Array<{ sessionId: string; matchId: string; playerIds: string[] }> = []

  constructor(
    private readonly failure?: Error,
    private readonly status: GameServerAllocation['status'] = 'provisioning',
  ) {}

  async requestAllocation(input: { sessionId: string; matchId: string; playerIds: string[] }): Promise<GameServerAllocation> {
    if (this.failure) {
      throw this.failure
    }

    this.requests.push(input)
    return {
      allocationId: 'allocation-1',
      sessionId: input.sessionId,
      provider: 'test',
      providerReference: 'provider-1',
      status: this.status,
      artifact: {
        artifactId: 'signal-grid:0.1.0-prototype:prototype',
        gameId: 'signal-grid',
        gameVersion: '0.1.0-prototype',
        protocolVersion: 'v1',
        buildVersion: 'prototype',
        serverType: 'dedicated',
        runtimeType: 'external',
      },
      runtimeRequirements: {
        runtimeProfile: 'dedicated-server',
        region: null,
        participantCapacity: 2,
      },
      connection:
        this.status === 'ready'
          ? {
              transport: 'websocket',
              host: 'test.game.local',
              port: 7443,
              secure: true,
              protocolVersion: 'v1',
              tokenReference: 'token-ref-1',
              expiresAt: null,
            }
          : null,
      requestedAt: '2026-09-30T11:00:00.000Z',
      provisioningAt: this.status === 'ready' ? '2026-09-30T11:00:01.000Z' : '2026-09-30T11:00:00.000Z',
      readyAt: this.status === 'ready' ? '2026-09-30T11:00:02.000Z' : null,
      failedAt: null,
      releasingAt: null,
      releasedAt: null,
      expiresAt: '2026-09-30T11:15:00.000Z',
      failureCode: null,
    }
  }

  async getAllocation(): Promise<GameServerAllocation | null> {
    return null
  }

  async releaseAllocation(): Promise<GameServerAllocation | null> {
    return null
  }
}

function buildMatchReadyPayload(overrides: Partial<MatchReadyPayload> = {}): MatchReadyPayload {
  return {
    matchId: 'match-1',
    proposalId: 'proposal-1',
    gameId: 'signal-grid',
    queueType: 'quick-play',
    region: null,
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    platform: 'web',
    participants: [
      {
        playerId: 'player-1',
        requestId: 'request-1',
        sourceLobbyId: 'lobby-1',
      },
      {
        playerId: 'player-2',
        requestId: 'request-2',
        sourceLobbyId: null,
      },
    ],
    ...overrides,
  }
}

function buildAggregate(overrides: Partial<DurableGameSessionAggregate> = {}): DurableGameSessionAggregate {
  const base: DurableGameSessionAggregate = {
    sessionId: 'session-1',
    sourceKind: 'matchmaking',
    matchId: 'match-1',
    proposalId: 'proposal-1',
    gameId: 'signal-grid',
    queueType: 'quick-play',
    platform: 'web',
    region: null,
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    status: 'created',
    createdAt: '2026-09-30T11:00:00.000Z',
    updatedAt: '2026-09-30T11:00:00.000Z',
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    expiresAt: '2026-09-30T11:15:00.000Z',
    failureCode: null,
    participants: [
      {
        sessionId: 'session-1',
        playerId: 'player-1',
        sourceRequestId: 'request-1',
        sourceLobbyId: 'lobby-1',
        joinedAt: '2026-09-30T11:00:00.000Z',
      },
      {
        sessionId: 'session-1',
        playerId: 'player-2',
        sourceRequestId: 'request-2',
        sourceLobbyId: null,
        joinedAt: '2026-09-30T11:00:00.000Z',
      },
    ],
  }

  return {
    ...base,
    ...overrides,
    participants: overrides.participants ?? base.participants,
  }
}

function identity(playerId: string): SessionRequestIdentity {
  return {
    playerId,
    requestId: 'request-client-1',
  }
}