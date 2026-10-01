import { Module } from '@nestjs/common'

import { CatalogModule } from '../modules/catalog/catalog.module.js'

@Module({
  imports: [CatalogModule],
  exports: [CatalogModule],
})
export class CatalogAllocationArtifactQueryModule {}