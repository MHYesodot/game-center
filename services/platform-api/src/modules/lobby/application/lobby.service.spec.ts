import { describe, expect, it } from 'vitest'
import type {
  CreateLobbyRequest,
  LobbyDetails,
  LobbyRuntimeState,
  SetLobbyReadyRequest,
} from '@game-center/contracts'

import type { CatalogQueryService } from '../../../boundaries/catalog-query.js'
import type { Clock } from '../../../boundaries/clock.js'
import type { IdGenerator } from '../../../boundaries/id-generator.js'
import { buildUnavailableRuntimeState, type LobbyRepository, type LobbyRepositoryTransaction, type LobbyRuntimeStore } from './lobby.ports.js'
import { LobbyService } from './lobby.service.js'
import type { DurableLobbyAggregate, DurableLobbyMemberRecord, DurableLobbyRecord } from '../domain/lobby-record.js'

describe('LobbyService', () => {
  it('creates a durable lobby owned by the caller', async () => {
    const harness = createHarness()

    const lobby = await harness.service.createLobby(
      { playerId: 'player-1', requestId: 'request-1' },
      createLobbyRequest(),
    )

    expect(lobby.ownerPlayerId).toBe('player-1')
    expect(lobby.members).toEqual([
      {
        playerId: 'player-1',
        role: 'owner',
        joinedAt: harness.now,
        leftAt: null,
      },
    ])
  })

  it('keeps join idempotent for an existing active member', async () => {
    const harness = createHarness({ lobby: buildLobbyAggregate() })

    const first = await harness.service.joinLobby('lobby-1', { playerId: 'player-2', requestId: 'request-2' }, {})
    const second = await harness.service.joinLobby('lobby-1', { playerId: 'player-2', requestId: 'request-3' }, {})

    expect(first.members.filter((member) => member.leftAt === null)).toHaveLength(2)
    expect(second.members.filter((member) => member.leftAt === null)).toHaveLength(2)
    expect(harness.runtime.lastClearReadyLobbyId).toBe('lobby-1')
    expect(harness.runtime.clearReadyStateCalls).toBe(1)
  })

  it('transfers ownership deterministically when the owner leaves an open lobby', async () => {
    const harness = createHarness({
      lobby: buildLobbyAggregate({
        members: [
          {
            lobbyId: 'lobby-1',
            playerId: 'player-1',
            role: 'owner',
            joinedAt: '2026-09-29T10:00:00.000Z',
            leftAt: null,
          },
          {
            lobbyId: 'lobby-1',
            playerId: 'player-2',
            role: 'member',
            joinedAt: '2026-09-29T10:01:00.000Z',
            leftAt: null,
          },
        ],
      }),
    })

    const lobby = await harness.service.leaveLobby('lobby-1', { playerId: 'player-1', requestId: 'request-1' })

    expect(lobby.ownerPlayerId).toBe('player-2')
    expect(lobby.members.find((member) => member.playerId === 'player-1')?.leftAt).toBe(harness.now)
  })

  it('resets ready state when a new member joins', async () => {
    const harness = createHarness({ lobby: buildLobbyAggregate() })

    await harness.service.joinLobby('lobby-1', { playerId: 'player-2', requestId: 'request-1' }, {})

    expect(harness.runtime.lastClearReadyLobbyId).toBe('lobby-1')
  })

  it('requires all active members to be ready before starting', async () => {
    const harness = createHarness({
      lobby: buildLobbyAggregate({
        members: [
          {
            lobbyId: 'lobby-1',
            playerId: 'player-1',
            role: 'owner',
            joinedAt: '2026-09-29T10:00:00.000Z',
            leftAt: null,
          },
          {
            lobbyId: 'lobby-1',
            playerId: 'player-2',
            role: 'member',
            joinedAt: '2026-09-29T10:01:00.000Z',
            leftAt: null,
          },
        ],
      }),
      runtimeState: {
        available: true,
        connectedMemberCount: 2,
        allMembersReady: false,
        readyMemberIds: ['player-1'],
        members: [
          {
            playerId: 'player-1',
            connectionState: 'connected',
            ready: true,
            lastSeenAt: null,
            reconnectDeadlineAt: null,
          },
          {
            playerId: 'player-2',
            connectionState: 'connected',
            ready: false,
            lastSeenAt: null,
            reconnectDeadlineAt: null,
          },
        ],
      },
    })

    await expect(
      harness.service.startLobby('lobby-1', { playerId: 'player-1', requestId: 'request-1' }),
    ).rejects.toMatchObject({ response: { code: 'PLAYER_NOT_READY' } })
  })

  it('returns unavailable runtime for durable reads when redis is down', async () => {
    const harness = createHarness({
      lobby: buildLobbyAggregate(),
      runtimeFailure: new Error('connect ECONNREFUSED 127.0.0.1:6379'),
    })

    const lobby = await harness.service.getLobby('lobby-1')

    expect(lobby.runtime).toEqual(buildUnavailableRuntimeState(['player-1']))
  })

  it('rejects ready updates when redis is down', async () => {
    const harness = createHarness({
      lobby: buildLobbyAggregate(),
      runtimeFailure: new Error('connect ECONNREFUSED 127.0.0.1:6379'),
    })

    await expect(
      harness.service.setReady('lobby-1', { playerId: 'player-1', requestId: 'request-1' }, { ready: true } satisfies SetLobbyReadyRequest),
    ).rejects.toMatchObject({ response: { code: 'LOBBY_UNAVAILABLE' } })
  })
})

function createHarness(options: {
  lobby?: DurableLobbyAggregate
  runtimeState?: LobbyRuntimeState
  runtimeFailure?: Error
} = {}) {
  const now = '2026-09-29T10:00:00.000Z'
  const repository = new InMemoryLobbyRepository(options.lobby)
  const runtime = new FakeLobbyRuntimeStore(options.runtimeState, options.runtimeFailure)
  const clock: Clock = {
    now: () => new Date(now),
  }
  const idGenerator: IdGenerator = {
    nextId: () => 'lobby-created-1',
  }
  const catalogQueryService: CatalogQueryService = {
    async getGameById(gameId: string) {
      if (gameId === 'missing-game') {
        return null
      }

      return {
        gameId,
        status: 'active',
        multiplayer: true,
        privateRooms: true,
        platforms: {
          web: true,
          windows: true,
          macos: true,
          android: false,
          ios: false,
          ipados: false,
        },
      }
    },
  }

  return {
    now,
    runtime,
    service: new LobbyService(repository, runtime, catalogQueryService, clock, idGenerator),
  }
}

class InMemoryLobbyRepository implements LobbyRepository {
  private lobby: DurableLobbyAggregate | null

  constructor(lobby: DurableLobbyAggregate | undefined) {
    this.lobby = lobby ?? null
  }

  async getById(lobbyId: string): Promise<DurableLobbyAggregate | null> {
    return this.lobby?.lobbyId === lobbyId ? structuredClone(this.lobby) : null
  }

  async withTransaction<T>(callback: (transaction: LobbyRepositoryTransaction) => Promise<T>): Promise<T> {
    return callback({
      getById: async (lobbyId: string) => this.getById(lobbyId),
      getByIdForUpdate: async (lobbyId: string) => this.getById(lobbyId),
      createLobby: async (input) => {
        this.lobby = {
          ...input,
          members: [input.ownerMembership],
        }
      },
      addMember: async (member) => {
        if (!this.lobby) {
          return
        }

        this.lobby.members.push(member)
      },
      markMemberLeft: async (_lobbyId: string, playerId: string, leftAt: string) => {
        if (!this.lobby) {
          return
        }

        this.lobby.members = this.lobby.members.map((member) =>
          member.playerId === playerId && member.leftAt === null
            ? {
                ...member,
                leftAt,
              }
            : member,
        )
      },
      updateMemberRole: async (_lobbyId: string, playerId: string, role) => {
        if (!this.lobby) {
          return
        }

        this.lobby.members = this.lobby.members.map((member) =>
          member.playerId === playerId && member.leftAt === null
            ? {
                ...member,
                role,
              }
            : member,
        )
      },
      updateLobby: async (lobby) => {
        if (!this.lobby) {
          return
        }

        this.lobby = {
          ...lobby,
          members: this.lobby.members,
        }
      },
    })
  }
}

class FakeLobbyRuntimeStore implements LobbyRuntimeStore {
  lastClearReadyLobbyId: string | null = null
  clearReadyStateCalls = 0

  constructor(
    private readonly runtimeState: LobbyRuntimeState | undefined,
    private readonly runtimeFailure: Error | undefined,
  ) {}

  async getRuntimeState(_lobbyId: string, activePlayerIds: string[]): Promise<LobbyRuntimeState> {
    if (this.runtimeFailure) {
      throw Object.assign(this.runtimeFailure, { code: 'ECONNREFUSED' })
    }

    return this.runtimeState ?? buildUnavailableRuntimeState(activePlayerIds)
  }

  async markConnected(): Promise<void> {
    return
  }

  async markDisconnected(): Promise<void> {
    return
  }

  async setReadyState(): Promise<void> {
    if (this.runtimeFailure) {
      throw Object.assign(this.runtimeFailure, { code: 'ECONNREFUSED' })
    }
  }

  async removeMember(): Promise<void> {
    return
  }

  async clearReadyState(lobbyId: string): Promise<void> {
    this.lastClearReadyLobbyId = lobbyId
    this.clearReadyStateCalls += 1
  }

  async clearLobbyRuntime(): Promise<void> {
    return
  }
}

function createLobbyRequest(overrides: Partial<CreateLobbyRequest> = {}): CreateLobbyRequest {
  return {
    gameId: 'signal-grid',
    visibility: 'public',
    capacity: 4,
    minimumPlayers: 2,
    configuration: {
      schemaVersion: 'v1',
      settings: {
        boardSize: 'standard',
      },
    },
    ...overrides,
  }
}

function buildLobbyAggregate(overrides: Partial<DurableLobbyAggregate> = {}): DurableLobbyAggregate {
  return {
    lobbyId: 'lobby-1',
    gameId: 'signal-grid',
    ownerPlayerId: 'player-1',
    status: 'open',
    visibility: 'public',
    capacity: 2,
    minimumPlayers: 2,
    configuration: {
      schemaVersion: 'v1',
      settings: {
        boardSize: 'standard',
      },
    },
    joinCodeHash: null,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    closedAt: null,
    expiresAt: '2026-09-29T14:00:00.000Z',
    members: [
      {
        lobbyId: 'lobby-1',
        playerId: 'player-1',
        role: 'owner',
        joinedAt: '2026-09-29T10:00:00.000Z',
        leftAt: null,
      },
    ],
    ...overrides,
  }
}