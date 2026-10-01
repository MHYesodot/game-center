import { Global, Module } from '@nestjs/common'

import { REALTIME_EVENT_PUBLISHER } from '../boundaries/realtime-event-publisher.js'
import { JsonLogger } from '../common/logging/json-logger.service.js'
import { databasePoolProvider } from './database.providers.js'
import { ReadinessService, postgresProvider, redisProvider, natsProvider } from './readiness.service.js'
import { NatsRealtimeEventPublisher } from '../modules/realtime/infrastructure/nats-realtime-event.publisher.js'

@Global()
@Module({
  providers: [
    JsonLogger,
    databasePoolProvider,
    postgresProvider,
    redisProvider,
    natsProvider,
    ReadinessService,
    NatsRealtimeEventPublisher,
    {
      provide: REALTIME_EVENT_PUBLISHER,
      useExisting: NatsRealtimeEventPublisher,
    },
  ],
  exports: [
    JsonLogger,
    databasePoolProvider,
    postgresProvider,
    redisProvider,
    natsProvider,
    ReadinessService,
    NatsRealtimeEventPublisher,
    REALTIME_EVENT_PUBLISHER,
  ],
})
export class InfrastructureModule {}