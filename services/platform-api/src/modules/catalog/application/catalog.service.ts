import { Injectable } from '@nestjs/common'

import { InMemoryCatalogRepository } from '../infrastructure/catalog.repository.js'

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: InMemoryCatalogRepository) {}

  listGames() {
    return this.catalogRepository.list()
  }
}