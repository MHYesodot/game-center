import type {
  GameDefinition,
  GameServerAllocation,
  GameSession,
  LobbyDetails,
} from '@game-center/contracts'

export function fixedIso(value = '2026-09-29T10:00:00Z') {
  return new Date(value).toISOString()
}

export function buildCatalogGame(overrides: Partial<GameDefinition> = {}): GameDefinition {
  const base: GameDefinition = {
    gameId: 'signal-grid',
    slug: 'signal-grid',
    status: 'active',
    tags: ['board'],
    categoryKey: 'navigation.categories.board',
    displayNameKey: 'catalog.gameMeta.names.signal-grid',
    descriptionKey: 'catalog.gameMeta.descriptions.signal-grid',
    taglineKey: 'catalog.gameMeta.tagline.signal-grid',
    manifest: {
      gameId: 'signal-grid',
      slug: 'signal-grid',
      category: 'board',
      categoryKey: 'navigation.categories.board',
      displayNameKey: 'catalog.gameMeta.names.signal-grid',
      descriptionKey: 'catalog.gameMeta.descriptions.signal-grid',
      taglineKey: 'catalog.gameMeta.tagline.signal-grid',
      runtime: {
        clientRuntime: 'web',
        engine: 'prototype-dom',
        serverType: 'dedicated',
      },
      version: {
        gameVersion: '0.1.0-prototype',
        protocolVersion: 'v1',
        buildVersion: 'prototype',
      },
      capabilities: {
        multiplayer: true,
        ranked: true,
        spectators: true,
        replays: false,
        privateRooms: true,
      },
      platforms: {
        web: true,
        windows: true,
        macos: true,
        android: false,
        ios: false,
        ipados: false,
      },
      distribution: {
        minimumVersion: '0.1.0',
        downloadStrategy: 'browser',
        launchStrategy: 'route',
        architecture: 'browser',
      },
    },
  }

  return {
    ...base,
    ...overrides,
    manifest: {
      ...base.manifest,
      ...overrides.manifest,
      runtime: {
        ...base.manifest.runtime,
        ...overrides.manifest?.runtime,
      },
      version: {
        ...base.manifest.version,
        ...overrides.manifest?.version,
      },
      capabilities: {
        ...base.manifest.capabilities,
        ...overrides.manifest?.capabilities,
      },
      platforms: {
        ...base.manifest.platforms,
        ...overrides.manifest?.platforms,
      },
      distribution: {
        ...base.manifest.distribution,
        ...overrides.manifest?.distribution,
      },
    },
  }
}

export function buildLobby(overrides: Partial<LobbyDetails> = {}): LobbyDetails {
  const base: LobbyDetails = {
    lobbyId: 'lobby-signal-grid-1',
    gameId: 'signal-grid',
    ownerPlayerId: 'player-1',
    status: 'open',
    visibility: 'public',
    capacity: 4,
    minimumPlayers: 2,
    configuration: {
      schemaVersion: 'v1',
      settings: {
        boardSize: 'standard',
      },
    },
    members: [
      {
        playerId: 'player-1',
        role: 'owner',
        joinedAt: fixedIso(),
        leftAt: null,
      },
      {
        playerId: 'player-2',
        role: 'member',
        joinedAt: fixedIso('2026-09-29T10:01:00Z'),
        leftAt: null,
      },
    ],
    runtime: {
      available: true,
      connectedMemberCount: 2,
      allMembersReady: true,
      readyMemberIds: ['player-1', 'player-2'],
      members: [
        {
          playerId: 'player-1',
          connectionState: 'connected',
          ready: true,
          lastSeenAt: fixedIso('2026-09-29T10:02:00Z'),
          reconnectDeadlineAt: null,
        },
        {
          playerId: 'player-2',
          connectionState: 'connected',
          ready: true,
          lastSeenAt: fixedIso('2026-09-29T10:02:00Z'),
          reconnectDeadlineAt: null,
        },
      ],
    },
    createdAt: fixedIso(),
    updatedAt: fixedIso('2026-09-29T10:02:00Z'),
    closedAt: null,
    expiresAt: fixedIso('2026-09-29T10:30:00Z'),
  }

  return {
    ...base,
    ...overrides,
    configuration: {
      ...base.configuration,
      ...overrides.configuration,
      settings: {
        ...base.configuration.settings,
        ...overrides.configuration?.settings,
      },
    },
    members: overrides.members ?? base.members,
    runtime: {
      ...base.runtime,
      ...overrides.runtime,
      readyMemberIds: overrides.runtime?.readyMemberIds ?? base.runtime.readyMemberIds,
      members: overrides.runtime?.members ?? base.runtime.members,
    },
  }
}

export function buildGameSession(overrides: Partial<GameSession> = {}): GameSession {
  const base: GameSession = {
    sessionId: 'session-signal-grid-1',
    source: {
      kind: 'matchmaking',
      matchId: 'match-signal-grid-1',
      proposalId: 'proposal-signal-grid-1',
    },
    gameId: 'signal-grid',
    queueType: 'quick-play',
    platform: 'web',
    region: null,
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    status: 'allocating',
    participants: [
      {
        playerId: 'player-1',
        sourceRequestId: 'request-1',
        sourceLobbyId: null,
        joinedAt: fixedIso(),
      },
    ],
    createdAt: fixedIso(),
    updatedAt: fixedIso('2026-09-29T10:04:00Z'),
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    expiresAt: fixedIso('2026-09-29T10:15:00Z'),
    failureCode: null,
  }

  return {
    ...base,
    ...overrides,
    source: {
      ...base.source,
      ...overrides.source,
    },
    participants: overrides.participants ?? base.participants,
  }
}

export function buildGameServerAllocation(
  overrides: Partial<GameServerAllocation> = {},
): GameServerAllocation {
  const base: GameServerAllocation = {
    allocationId: 'alloc-signal-grid-1',
    sessionId: 'session-signal-grid-1',
    provider: 'test',
    providerReference: 'test-provider-ref-1',
    status: 'ready',
    artifact: {
      artifactId: 'signal-grid:0.1.0-prototype:prototype',
      gameId: 'signal-grid',
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      buildVersion: 'prototype',
      serverType: 'dedicated',
      runtimeType: 'container',
    },
    runtimeRequirements: {
      runtimeProfile: 'dedicated-server',
      region: 'dev-local',
      participantCapacity: 2,
    },
    connection: {
      transport: 'websocket',
      host: 'signal-grid.dev',
      port: 443,
      secure: true,
      protocolVersion: 'v1',
      tokenReference: 'token-ref-1',
      expiresAt: fixedIso('2026-09-29T10:14:30Z'),
    },
    requestedAt: fixedIso('2026-09-29T10:04:00Z'),
    provisioningAt: fixedIso('2026-09-29T10:04:05Z'),
    readyAt: fixedIso('2026-09-29T10:04:30Z'),
    failedAt: null,
    releasingAt: null,
    releasedAt: null,
    expiresAt: fixedIso('2026-09-29T10:15:00Z'),
    failureCode: null,
  }

  return {
    ...base,
    ...overrides,
    artifact: {
      ...base.artifact,
      ...overrides.artifact,
    },
    runtimeRequirements: {
      ...base.runtimeRequirements,
      ...overrides.runtimeRequirements,
    },
    connection:
      overrides.connection === null
        ? null
        : {
            ...base.connection,
            ...overrides.connection,
          },
  }
}