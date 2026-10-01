import { z } from 'zod'

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  POSTGRES_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  NATS_URL: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1).optional(),
  ALLOCATION_PROVIDER: z.enum(['unavailable', 'test', 'docker']).default('unavailable'),
  DOCKER_ALLOCATOR_PUBLIC_HOST: z.string().min(1).default('localhost'),
  DOCKER_ALLOCATOR_INTERNAL_PORT: z.coerce.number().int().positive().default(7777),
  DOCKER_ALLOCATOR_HEALTH_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  DOCKER_ALLOCATOR_HEALTH_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  DOCKER_ALLOCATOR_STOP_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(5),
  DOCKER_ALLOCATOR_ORPHAN_MIN_AGE_SECONDS: z.coerce.number().int().nonnegative().default(30),
  DOCKER_ALLOCATOR_LOG_TAIL_LINES: z.coerce.number().int().positive().default(80),
  DOCKER_ALLOCATOR_MEMORY_BYTES: z.coerce.number().int().positive().default(268_435_456),
  DOCKER_ALLOCATOR_NANO_CPUS: z.coerce.number().int().positive().default(500_000_000),
  DOCKER_ALLOCATOR_PIDS_LIMIT: z.coerce.number().int().positive().default(128),
  DOCKER_ALLOCATOR_TEST_MODE: z.enum(['normal', 'hang-health', 'exit-immediately']).default('normal'),
  GAME_SERVER_DOCKER_NETWORK: z.string().min(1).default('game-center-game-servers'),
})

export function validateEnv(environment: Record<string, unknown>) {
  const parsed = baseEnvSchema.parse(environment)

  if (parsed.NODE_ENV === 'test') {
    return parsed
  }

  if (!parsed.REDIS_URL || !parsed.NATS_URL || !parsed.CORS_ORIGIN) {
    throw new Error('REDIS_URL, NATS_URL, and CORS_ORIGIN are required outside test environments.')
  }

  return parsed
}