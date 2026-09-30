import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import * as sessionSchema from './schema/session.schema.js'

export const SESSIONS_DRIZZLE_DB = Symbol('SESSIONS_DRIZZLE_DB')

export type SessionsDrizzleDatabase = NodePgDatabase<typeof sessionSchema>

export function createSessionsDatabase(pool: Pool): SessionsDrizzleDatabase {
	return drizzle(pool, { schema: sessionSchema })
}