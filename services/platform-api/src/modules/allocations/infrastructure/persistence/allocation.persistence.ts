import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import * as allocationSchema from './schema/allocation.schema.js'

export const ALLOCATIONS_DRIZZLE_DB = Symbol('ALLOCATIONS_DRIZZLE_DB')

export type AllocationsDrizzleDatabase = NodePgDatabase<typeof allocationSchema>

export function createAllocationsDatabase(pool: Pool): AllocationsDrizzleDatabase {
  return drizzle(pool, { schema: allocationSchema })
}