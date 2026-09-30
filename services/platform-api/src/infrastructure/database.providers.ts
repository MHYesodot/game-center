import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'

import { DATABASE_POOL } from './infrastructure.tokens.js'

export const databasePoolProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    new Pool({ connectionString: configService.getOrThrow<string>('POSTGRES_URL') }),
}