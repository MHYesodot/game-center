import { seedCatalogDatabase } from '../catalog.persistence.js'

const connectionString = process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error('POSTGRES_URL is required to seed the catalog database.')
}

await seedCatalogDatabase(connectionString)