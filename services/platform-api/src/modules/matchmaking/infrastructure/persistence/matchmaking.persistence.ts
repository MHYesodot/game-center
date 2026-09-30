import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import * as matchmakingSchema from './schema/matchmaking.schema.js'

export const MATCHMAKING_DRIZZLE_DB = Symbol('MATCHMAKING_DRIZZLE_DB')

export type MatchmakingDrizzleDatabase = ReturnType<typeof drizzle<typeof matchmakingSchema>>

export function createMatchmakingDatabase(pool: Pool) {
  return drizzle(pool, { schema: matchmakingSchema })
}