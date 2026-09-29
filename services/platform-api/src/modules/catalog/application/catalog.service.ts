import { Injectable } from '@nestjs/common'
import type { CatalogListResponse, GameDefinition } from '@game-center/contracts'

import { InMemoryCatalogRepository } from '../infrastructure/catalog.repository.js'

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: InMemoryCatalogRepository) {}

  listGames(): CatalogListResponse {
    return {
      games: this.catalogRepository.list().map((game) => this.toResponse(game)),
    }
  }

  private toResponse(game: GameDefinition): GameDefinition {
    return {
      ...game,
      manifest: {
        ...game.manifest,
      },
    }
  }
}