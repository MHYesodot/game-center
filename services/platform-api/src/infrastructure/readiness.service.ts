import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { connect, type NatsConnection } from 'nats'
import { Pool } from 'pg'
import { createClient, type RedisClientType } from 'redis'

import { NATS, POSTGRES, REDIS } from './infrastructure.tokens.js'

@Injectable()
export class ReadinessService implements OnApplicationShutdown {
  constructor(
    @Inject(POSTGRES) private readonly postgres: Pool,
    @Inject(REDIS) private readonly redis: RedisClientType,
    @Inject(NATS) private readonly nats: NatsConnection,
  ) {}

  async readiness() {
    await this.postgres.query('select 1')
    await this.redis.ping()
    await this.nats.flush()

    return {
      postgres: 'up',
      redis: 'up',
      nats: 'up',
    }
  }

  async onApplicationShutdown() {
    await Promise.allSettled([
      this.postgres.end(),
      this.redis.quit(),
      this.nats.drain(),
    ])
  }
}

export const postgresProvider = {
  provide: POSTGRES,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    new Pool({ connectionString: configService.getOrThrow<string>('POSTGRES_URL') }),
}

export const redisProvider = {
  provide: REDIS,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const client = createClient({ url: configService.getOrThrow<string>('REDIS_URL') })
    await client.connect()
    return client
  },
}

export const natsProvider = {
  provide: NATS,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) =>
    connect({ servers: configService.getOrThrow<string>('NATS_URL') }),
}