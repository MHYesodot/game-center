import { Controller, Get, Param } from '@nestjs/common'
import type { CatalogGameResponse, CatalogListResponse } from '@game-center/contracts'

import { CatalogService } from '../application/catalog.service.js'

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('games')
  listGames(): Promise<CatalogListResponse> {
    return this.catalogService.listGames()
  }

  @Get('games/:slug')
  getGameBySlug(@Param('slug') slug: string): Promise<CatalogGameResponse> {
    return this.catalogService.getGameBySlug(slug)
  }
}