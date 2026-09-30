import type {
  GameDefinition,
  GameServerAllocation,
  GameSession,
  Lobby,
  MatchmakingOverview,
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

export function buildLobby(overrides: Partial<Lobby> = {}): Lobby {
  const base: Lobby = {
    lobbyId: 'lobby-signal-grid-1',
    gameId: 'signal-grid',
    ownerPlayerId: 'player-1',
    state: 'ready-check',
    settings: {
      visibility: 'public',
      minPlayers: 2,
      maxPlayers: 4,
      allowSpectators: true,
      isRanked: true,
      region: 'dev-local',
      customSettings: {},
    },
    members: [
      {
        playerId: 'player-1',
        displayName: 'Commander Vega',
        role: 'host',
        readyState: 'ready',
        joinedAt: fixedIso(),
      },
      {
        playerId: 'player-2',
        displayName: 'Analyst Noor',
        role: 'member',
        readyState: 'ready',
        joinedAt: fixedIso('2026-09-29T10:01:00Z'),
      },
    ],
    createdAt: fixedIso(),
    updatedAt: fixedIso('2026-09-29T10:02:00Z'),
  }

  return {
    ...base,
    ...overrides,
    settings: {
      ...base.settings,
      ...overrides.settings,
      customSettings: {
        ...base.settings.customSettings,
        ...overrides.settings?.customSettings,
      },
    },
    members: overrides.members ?? base.members,
  }
}

export function buildMatchmakingOverview(overrides: Partial<MatchmakingOverview> = {}): MatchmakingOverview {
  const base: MatchmakingOverview = {
    queues: [
      {
        queueId: 'queue-signal-grid-ranked',
        gameId: 'signal-grid',
        playlist: 'ranked-duel',
        minPlayers: 2,
        maxPlayers: 2,
        teamSize: 1,
        proposalTimeoutSeconds: 20,
        ephemeralStore: 'redis',
      },
    ],
    tickets: [
      {
        ticketId: 'ticket-signal-grid-ranked-1',
        gameId: 'signal-grid',
        queueId: 'queue-signal-grid-ranked',
        playerIds: ['player-1', 'player-2'],
        requestedAt: fixedIso(),
        state: 'proposed',
        lobbyId: 'lobby-signal-grid-1',
        attributes: {},
      },
    ],
    candidates: [],
    proposals: [
      {
        proposalId: 'proposal-signal-grid-1',
        queueId: 'queue-signal-grid-ranked',
        ticketIds: ['ticket-signal-grid-ranked-1', 'ticket-rush-lane-1'],
        acceptedTicketIds: ['ticket-signal-grid-ranked-1'],
        expiresAt: fixedIso('2026-09-29T10:05:00Z'),
        createdAt: fixedIso('2026-09-29T10:02:30Z'),
      },
    ],
    matches: [
      {
        matchId: 'match-signal-grid-1',
        gameId: 'signal-grid',
        queueId: 'queue-signal-grid-ranked',
        ticketIds: ['ticket-signal-grid-ranked-1'],
        lobbyIds: ['lobby-signal-grid-1'],
        state: 'allocating-session',
        createdAt: fixedIso('2026-09-29T10:03:00Z'),
      },
    ],
  }

  return {
    ...base,
    ...overrides,
    queues: overrides.queues ?? base.queues,
    tickets: overrides.tickets ?? base.tickets,
    candidates: overrides.candidates ?? base.candidates,
    proposals: overrides.proposals ?? base.proposals,
    matches: overrides.matches ?? base.matches,
  }
}

export function buildGameSession(overrides: Partial<GameSession> = {}): GameSession {
  const base: GameSession = {
    sessionId: 'session-signal-grid-1',
    gameId: 'signal-grid',
    state: 'ready',
    version: {
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      buildVersion: 'prototype',
    },
    participants: [
      {
        playerId: 'player-1',
        role: 'host',
        joinedAt: fixedIso(),
      },
    ],
    createdAt: fixedIso(),
    updatedAt: fixedIso('2026-09-29T10:04:00Z'),
  }

  return {
    ...base,
    ...overrides,
    version: {
      ...base.version,
      ...overrides.version,
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
    state: 'ready',
    endpoint: 'ws://signal-grid.dev/session-signal-grid-1',
    transport: 'ws',
    occurredAt: fixedIso('2026-09-29T10:04:30Z'),
    serverInstanceId: 'dev-server-signal-grid-1',
    region: 'dev-local',
  }

  return {
    ...base,
    ...overrides,
  }
}