import { Global, Module } from '@nestjs/common'

import { databasePoolProvider } from './database.providers.js'
import { ReadinessService, postgresProvider, redisProvider, natsProvider } from './readiness.service.js'

@Global()
@Module({
  providers: [databasePoolProvider, postgresProvider, redisProvider, natsProvider, ReadinessService],
  exports: [databasePoolProvider, postgresProvider, redisProvider, natsProvider, ReadinessService],
})
export class InfrastructureModule {}