import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CatalogGameResponse, CatalogListResponse } from '@game-center/contracts'

import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
  toCatalogGameResponse,
} from '../domain/catalog-game.js'

@Injectable()
export class CatalogService {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly catalogRepository: CatalogRepository) {}

  async listGames(): Promise<CatalogListResponse> {
    const games = await this.catalogRepository.listGames()

    return {
      games: games.map((game) => toCatalogGameResponse(game)),
    }
  }

  async getGameBySlug(slug: string): Promise<CatalogGameResponse> {
    const game = await this.catalogRepository.getGameBySlug(slug)

    if (!game) {
      throw new NotFoundException(`Catalog game not found for slug ${slug}`)
    }

    return toCatalogGameResponse(game)
  }
}