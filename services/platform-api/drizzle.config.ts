import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/modules/catalog/infrastructure/persistence/schema/catalog.schema.ts',
    './src/modules/lobby/infrastructure/persistence/schema/lobby.schema.ts',
    './src/modules/matchmaking/infrastructure/persistence/schema/matchmaking.schema.ts',
    './src/modules/sessions/infrastructure/persistence/schema/session.schema.ts',
    './src/modules/allocations/infrastructure/persistence/schema/allocation.schema.ts',
  ],
  out: './drizzle',
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? 'postgresql://gamecenter:gamecenter@localhost:5432/gamecenter',
  },
  strict: true,
  verbose: true,
})