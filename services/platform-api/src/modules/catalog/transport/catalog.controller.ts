import { Controller, Get, Inject, Param } from '@nestjs/common'
import type { CatalogGameResponse, CatalogListResponse } from '@game-center/contracts'

import { CatalogService } from '../application/catalog.service.js'

@Controller()
export class CatalogController {
  private readonly catalogService: CatalogService

  constructor(@Inject(CatalogService) catalogService: CatalogService) {
    this.catalogService = catalogService
    this.listGames = this.listGames.bind(this)
    this.getGameBySlug = this.getGameBySlug.bind(this)
  }

  @Get('games')
  listGames(): Promise<CatalogListResponse> {
    return this.catalogService.listGames()
  }

  @Get('games/:slug')
  getGameBySlug(@Param('slug') slug: string): Promise<CatalogGameResponse> {
    return this.catalogService.getGameBySlug(slug)
  }
}