import { Injectable } from '@nestjs/common'

import type { CatalogGame } from '../domain/catalog-game.js'

const games: CatalogGame[] = [
  {
    gameId: 'signal-grid',
    slug: 'signal-grid',
    status: 'active',
    tags: ['board', 'ranked', 'dedicated-server'],
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
      minimumVersion: '0.1.0',
      downloadStrategy: 'browser',
      launchStrategy: 'route',
      architecture: 'browser',
    },
  },
  {
    gameId: 'rush-lane',
    slug: 'rush-lane',
    status: 'active',
    tags: ['arcade', 'shared-runtime', 'quick-play'],
    categoryKey: 'navigation.categories.arcade',
    displayNameKey: 'catalog.gameMeta.names.rush-lane',
    descriptionKey: 'catalog.gameMeta.descriptions.rush-lane',
    taglineKey: 'catalog.gameMeta.tagline.rush-lane',
    manifest: {
      gameId: 'rush-lane',
      slug: 'rush-lane',
      category: 'arcade',
      categoryKey: 'navigation.categories.arcade',
      displayNameKey: 'catalog.gameMeta.names.rush-lane',
      descriptionKey: 'catalog.gameMeta.descriptions.rush-lane',
      taglineKey: 'catalog.gameMeta.tagline.rush-lane',
      runtime: {
        clientRuntime: 'web',
        engine: 'prototype-canvas',
        serverType: 'shared',
      },
      version: {
        gameVersion: '0.1.0-prototype',
        protocolVersion: 'v1',
        buildVersion: 'prototype',
      },
      capabilities: {
        multiplayer: true,
        ranked: false,
        spectators: false,
        replays: false,
        privateRooms: true,
      },
      platforms: {
        web: true,
        windows: true,
        macos: true,
        android: true,
        ios: true,
        ipados: true,
      },
      minimumVersion: '0.1.0',
      downloadStrategy: 'browser',
      launchStrategy: 'route',
      architecture: 'browser',
    },
  },
  {
    gameId: 'aether-flight',
    slug: 'aether-flight',
    status: 'active',
    tags: ['simulation', '3d', 'mission-bay'],
    categoryKey: 'navigation.categories.simulation3d',
    displayNameKey: 'catalog.gameMeta.names.aether-flight',
    descriptionKey: 'catalog.gameMeta.descriptions.aether-flight',
    taglineKey: 'catalog.gameMeta.tagline.aether-flight',
    manifest: {
      gameId: 'aether-flight',
      slug: 'aether-flight',
      category: 'simulation',
      categoryKey: 'navigation.categories.simulation3d',
      displayNameKey: 'catalog.gameMeta.names.aether-flight',
      descriptionKey: 'catalog.gameMeta.descriptions.aether-flight',
      taglineKey: 'catalog.gameMeta.tagline.aether-flight',
      runtime: {
        clientRuntime: 'web',
        engine: 'prototype-threejs-preview',
        serverType: 'dedicated',
      },
      version: {
        gameVersion: '0.1.0-prototype',
        protocolVersion: 'v1',
        buildVersion: 'prototype',
      },
      capabilities: {
        multiplayer: true,
        ranked: false,
        spectators: false,
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
      minimumVersion: '0.1.0',
      downloadStrategy: 'browser',
      launchStrategy: 'route',
      architecture: 'browser',
    },
  },
]

@Injectable()
export class InMemoryCatalogRepository {
  list(): CatalogGame[] {
    return games
  }
}