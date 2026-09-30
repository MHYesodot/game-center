import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import * as lobbySchema from './schema/lobby.schema.js'

export const LOBBY_DRIZZLE_DB = Symbol('LOBBY_DRIZZLE_DB')

export type LobbyDrizzleDatabase = NodePgDatabase<typeof lobbySchema>

export function createLobbyDatabase(pool: Pool): LobbyDrizzleDatabase {
  return drizzle(pool, { schema: lobbySchema })
}