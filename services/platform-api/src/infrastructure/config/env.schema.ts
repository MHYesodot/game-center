import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  POSTGRES_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  NATS_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),
})

export function validateEnv(environment: Record<string, unknown>) {
  return envSchema.parse(environment)
}