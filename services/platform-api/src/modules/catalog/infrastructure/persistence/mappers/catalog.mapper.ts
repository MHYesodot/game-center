import type { CatalogGame } from '../../../domain/catalog-game.js'

import {
  catalogGameCapabilities,
  catalogGameDistributionMetadata,
  catalogGamePlatformAvailability,
  catalogGameVersions,
  catalogGames,
} from '../schema/catalog.schema.js'

export type CatalogGamePersistenceRecord = {
  game: typeof catalogGames.$inferSelect
  version: typeof catalogGameVersions.$inferSelect
  capabilities: typeof catalogGameCapabilities.$inferSelect
  platforms: typeof catalogGamePlatformAvailability.$inferSelect
  distribution: typeof catalogGameDistributionMetadata.$inferSelect
}

export function mapCatalogGameRecordToDomain(record: CatalogGamePersistenceRecord): CatalogGame {
  return {
    definition: {
      gameId: record.game.gameId,
      slug: record.game.slug,
      status: record.game.status as CatalogGame['definition']['status'],
      tags: [...record.game.tags],
      category: record.game.category as CatalogGame['definition']['category'],
      categoryKey: record.game.categoryKey,
      displayNameKey: record.game.displayNameKey,
      descriptionKey: record.game.descriptionKey,
      taglineKey: record.game.taglineKey,
    },
    activeVersion: {
      gameVersion: record.version.gameVersion,
      protocolVersion: record.version.protocolVersion,
      buildVersion: record.version.buildVersion,
      runtime: {
        clientRuntime: record.version.clientRuntime as CatalogGame['activeVersion']['runtime']['clientRuntime'],
        engine: record.version.engine,
        serverType: record.version.serverType as CatalogGame['activeVersion']['runtime']['serverType'],
      },
      capabilities: {
        multiplayer: record.capabilities.multiplayer,
        ranked: record.capabilities.ranked,
        spectators: record.capabilities.spectators,
        replays: record.capabilities.replays,
        privateRooms: record.capabilities.privateRooms,
      },
      platforms: {
        web: record.platforms.web,
        windows: record.platforms.windows,
        macos: record.platforms.macos,
        android: record.platforms.android,
        ios: record.platforms.ios,
        ipados: record.platforms.ipados,
      },
      distribution: {
        minimumVersion: record.distribution.minimumVersion ?? undefined,
        downloadStrategy:
          (record.distribution.downloadStrategy as CatalogGame['activeVersion']['distribution']['downloadStrategy']) ??
          undefined,
        launchStrategy:
          (record.distribution.launchStrategy as CatalogGame['activeVersion']['distribution']['launchStrategy']) ??
          undefined,
        architecture:
          (record.distribution.architecture as CatalogGame['activeVersion']['distribution']['architecture']) ??
          undefined,
      },
    },
  }
}