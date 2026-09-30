import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'

import { logDependencyDown } from './dependency-health.js'
import { DATABASE_POOL } from './infrastructure.tokens.js'

export function createManagedPostgresPool(connectionString: string) {
  const pool = new Pool({ connectionString })

  pool.on('error', (error) => {
    logDependencyDown('postgres', error, 'PostgresPool')
  })

  return pool
}

export const databasePoolProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    createManagedPostgresPool(configService.getOrThrow<string>('POSTGRES_URL')),
}