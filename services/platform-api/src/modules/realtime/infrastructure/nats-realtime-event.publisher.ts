import { Inject, Injectable, Optional } from '@nestjs/common'
import type { PlatformRealtimeEvent } from '@game-center/contracts'

import { JsonLogger } from '../../../common/logging/json-logger.service.js'
import { logDependencyDown } from '../../../infrastructure/dependency-health.js'
import { NATS } from '../../../infrastructure/infrastructure.tokens.js'
import type { RealtimeEventPublisher } from '../../../boundaries/realtime-event-publisher.js'

type NatsLike = {
  publish(subject: string, data: Uint8Array): void
}

export const REALTIME_EVENTS_SUBJECT = 'gc.v1.realtime.events'

@Injectable()
export class NatsRealtimeEventPublisher implements RealtimeEventPublisher {
  constructor(
    @Optional() @Inject(NATS) private readonly nats: NatsLike | null,
    @Inject(JsonLogger) private readonly logger: JsonLogger,
  ) {}

  async publish(event: PlatformRealtimeEvent): Promise<void> {
    if (!this.nats || typeof this.nats.publish !== 'function') {
      return
    }

    try {
      this.nats.publish(REALTIME_EVENTS_SUBJECT, new TextEncoder().encode(JSON.stringify(event)))
    } catch (error) {
      logDependencyDown('nats', error, 'NatsRealtimeEventPublisher')
      this.logger.error('realtime_publish_failed', error instanceof Error ? error.message : 'Unknown realtime publish error', 'RealtimePublisher')
    }
  }
}