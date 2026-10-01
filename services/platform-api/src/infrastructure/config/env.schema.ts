import { z } from 'zod'

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  POSTGRES_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  NATS_URL: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1).optional(),
  ALLOCATION_PROVIDER: z.enum(['unavailable', 'test']).default('unavailable'),
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