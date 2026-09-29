import { Global, Module } from '@nestjs/common'

import { ReadinessService, postgresProvider, redisProvider, natsProvider } from './readiness.service.js'

@Global()
@Module({
  providers: [postgresProvider, redisProvider, natsProvider, ReadinessService],
  exports: [postgresProvider, redisProvider, natsProvider, ReadinessService],
})
export class InfrastructureModule {}