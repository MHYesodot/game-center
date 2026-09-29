import { Controller, Get } from '@nestjs/common'

import { CatalogService } from '../application/catalog.service.js'

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('games')
  listGames() {
    return { games: this.catalogService.listGames() }
  }
}