import { Module } from '@nestjs/common'

import { CatalogService } from './application/catalog.service.js'
import { CatalogController } from './transport/catalog.controller.js'
import { InMemoryCatalogRepository } from './infrastructure/catalog.repository.js'

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, InMemoryCatalogRepository],
})
export class CatalogModule {}