import { describe, expect, it } from 'vitest'

import { mapCatalogGameRecordToDomain, type CatalogGamePersistenceRecord } from './catalog.mapper.js'

describe('catalog persistence mapper', () => {
  it('maps the persisted active-version record into the catalog domain projection', () => {
    const record: CatalogGamePersistenceRecord = {
      game: {
        gameId: 'rush-lane',
        slug: 'rush-lane',
        status: 'active',
        category: 'arcade',
        categoryKey: 'navigation.categories.arcade',
        displayNameKey: 'catalog.gameMeta.names.rush-lane',
        descriptionKey: 'catalog.gameMeta.descriptions.rush-lane',
        taglineKey: 'catalog.gameMeta.tagline.rush-lane',
        tags: ['arcade', 'shared-runtime', 'quick-play'],
        createdAt: '2026-09-30T00:00:00.000Z',
        updatedAt: '2026-09-30T00:00:00.000Z',
      },
      version: {
        id: 7,
        gameId: 'rush-lane',
        gameVersion: '1.2.3',
        protocolVersion: 'v2',
        buildVersion: 'build-99',
        clientRuntime: 'web',
        engine: 'phaser',
        serverType: 'shared',
        isActive: true,
        createdAt: '2026-09-30T00:00:00.000Z',
      },
      capabilities: {
        versionId: 7,
        multiplayer: true,
        ranked: false,
        spectators: true,
        replays: false,
        privateRooms: true,
      },
      platforms: {
        versionId: 7,
        web: true,
        windows: true,
        macos: true,
        android: true,
        ios: true,
        ipados: false,
      },
      distribution: {
        versionId: 7,
        minimumVersion: '1.0.0',
        downloadStrategy: 'browser',
        launchStrategy: 'route',
        architecture: 'browser',
      },
    }

    const game = mapCatalogGameRecordToDomain(record)

    expect(game.definition.slug).toBe('rush-lane')
    expect(game.activeVersion.gameVersion).toBe('1.2.3')
    expect(game.activeVersion.protocolVersion).toBe('v2')
    expect(game.activeVersion.runtime.engine).toBe('phaser')
    expect(game.activeVersion.platforms.android).toBe(true)
    expect(game.activeVersion.platforms.ipados).toBe(false)
    expect(game.activeVersion.capabilities.spectators).toBe(true)
    expect(game.activeVersion.distribution.minimumVersion).toBe('1.0.0')
    expect(game.activeVersion.distribution.launchStrategy).toBe('route')
  })
})