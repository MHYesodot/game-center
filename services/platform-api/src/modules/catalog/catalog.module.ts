import { Module } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import { CATALOG_ALLOCATION_ARTIFACT_QUERY } from '../../boundaries/catalog-allocation-artifact-query.js'
import { CATALOG_QUERY_SERVICE } from '../../boundaries/catalog-query.js'
import { CatalogService } from './application/catalog.service.js'
import { CatalogController } from './transport/catalog.controller.js'
import { CATALOG_REPOSITORY } from './domain/catalog-game.js'
import { DATABASE_POOL } from '../../infrastructure/infrastructure.tokens.js'
import {
  CATALOG_DRIZZLE_DB,
} from './infrastructure/persistence/catalog.persistence.js'
import { PostgresCatalogRepository } from './infrastructure/persistence/repositories/postgres-catalog.repository.js'
import * as catalogSchema from './infrastructure/persistence/schema/catalog.schema.js'

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    PostgresCatalogRepository,
    {
      provide: CATALOG_DRIZZLE_DB,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema: catalogSchema }),
    },
    {
      provide: CATALOG_REPOSITORY,
      useExisting: PostgresCatalogRepository,
    },
    {
      provide: CATALOG_QUERY_SERVICE,
      useExisting: CatalogService,
    },
    {
      provide: CATALOG_ALLOCATION_ARTIFACT_QUERY,
      useExisting: CatalogService,
    },
  ],
  exports: [CATALOG_QUERY_SERVICE, CATALOG_ALLOCATION_ARTIFACT_QUERY],
})
export class CatalogModule {}