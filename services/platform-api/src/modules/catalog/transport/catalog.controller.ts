import { Controller, Get } from '@nestjs/common'
import type { CatalogListResponse } from '@game-center/contracts'

import { CatalogService } from '../application/catalog.service.js'

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('games')
  listGames(): CatalogListResponse {
    return this.catalogService.listGames()
  }
}