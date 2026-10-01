import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import * as authSchema from './schema/auth.schema.js'

export const AUTH_DRIZZLE_DB = Symbol('AUTH_DRIZZLE_DB')

export type AuthDrizzleDatabase = NodePgDatabase<typeof authSchema>

export function createAuthDatabase(pool: Pool): AuthDrizzleDatabase {
  return drizzle(pool, { schema: authSchema })
}