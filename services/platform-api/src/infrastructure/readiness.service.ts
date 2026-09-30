import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { connect } from 'nats'
import { createClient } from 'redis'

import { createManagedPostgresPool } from './database.providers.js'
import { NATS, POSTGRES, REDIS } from './infrastructure.tokens.js'

type PostgresReadinessClient = {
  query(statement: string): Promise<unknown>
  end(): Promise<unknown>
}

type RedisReadinessClient = {
  ping(): Promise<string>
  quit(): Promise<unknown>
}

type NatsReadinessClient = {
  flush(): Promise<unknown>
  drain(): Promise<unknown>
}

function isTestEnvironment(configService: ConfigService) {
  return configService.get<string>('NODE_ENV') === 'test'
}

function shouldUseTestDouble(configService: ConfigService, envKey: string) {
  return isTestEnvironment(configService) && !configService.get<string>(envKey)
}

function createPostgresTestClient(): PostgresReadinessClient {
  return {
    async query() {
      return { rows: [] }
    },
    async end() {},
  }
}

function createRedisTestClient(): RedisReadinessClient {
  return {
    async ping() {
      return 'PONG'
    },
    async quit() {},
  }
}

function createNatsTestClient(): NatsReadinessClient {
  return {
    async flush() {},
    async drain() {},
  }
}

@Injectable()
export class ReadinessService implements OnApplicationShutdown {
  constructor(
    @Inject(POSTGRES) private readonly postgres: PostgresReadinessClient,
    @Inject(REDIS) private readonly redis: RedisReadinessClient,
    @Inject(NATS) private readonly nats: NatsReadinessClient,
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
    shouldUseTestDouble(configService, 'POSTGRES_URL')
      ? createPostgresTestClient()
      : createManagedPostgresPool(configService.getOrThrow<string>('POSTGRES_URL')),
}

export const redisProvider = {
  provide: REDIS,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    if (shouldUseTestDouble(configService, 'REDIS_URL')) {
      return createRedisTestClient()
    }

    const client = createClient({ url: configService.getOrThrow<string>('REDIS_URL') })
    await client.connect()
    return client
  },
}

export const natsProvider = {
  provide: NATS,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) =>
    shouldUseTestDouble(configService, 'NATS_URL')
      ? createNatsTestClient()
      : connect({ servers: configService.getOrThrow<string>('NATS_URL') }),
}