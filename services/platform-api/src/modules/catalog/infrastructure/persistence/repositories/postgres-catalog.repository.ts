import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

import { type CatalogGame, type CatalogRepository } from '../../../domain/catalog-game.js'

import {
  CATALOG_DRIZZLE_DB,
  type CatalogDrizzleDatabase,
} from '../catalog.persistence.js'
import { mapCatalogGameRecordToDomain } from '../mappers/catalog.mapper.js'
import {
  catalogGameCapabilities,
  catalogGameDistributionMetadata,
  catalogGamePlatformAvailability,
  catalogGameVersions,
  catalogGames,
} from '../schema/catalog.schema.js'

@Injectable()
export class PostgresCatalogRepository implements CatalogRepository {
  constructor(@Inject(CATALOG_DRIZZLE_DB) private readonly db: CatalogDrizzleDatabase) {}

  async listGames(): Promise<CatalogGame[]> {
    const rows = await this.baseQuery()

    return rows.map((row) => mapCatalogGameRecordToDomain(row))
  }

  async getGameBySlug(slug: string): Promise<CatalogGame | null> {
    const [row] = await this.baseQuery(eq(catalogGames.slug, slug), 1)

    return row ? mapCatalogGameRecordToDomain(row) : null
  }

  private async baseQuery(predicate?: ReturnType<typeof eq>, limit?: number) {
    const query = this.db
      .select({
        game: catalogGames,
        version: catalogGameVersions,
        capabilities: catalogGameCapabilities,
        platforms: catalogGamePlatformAvailability,
        distribution: catalogGameDistributionMetadata,
      })
      .from(catalogGames)
      .innerJoin(
        catalogGameVersions,
        and(eq(catalogGameVersions.gameId, catalogGames.gameId), eq(catalogGameVersions.isActive, true)),
      )
      .innerJoin(catalogGameCapabilities, eq(catalogGameCapabilities.versionId, catalogGameVersions.id))
      .innerJoin(catalogGamePlatformAvailability, eq(catalogGamePlatformAvailability.versionId, catalogGameVersions.id))
      .innerJoin(catalogGameDistributionMetadata, eq(catalogGameDistributionMetadata.versionId, catalogGameVersions.id))
      .orderBy(catalogGames.slug)

    if (!predicate) {
      return limit ? query.limit(limit) : query
    }

    const filteredQuery = query.where(predicate)

    return limit ? filteredQuery.limit(limit) : filteredQuery
  }
}