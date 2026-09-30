import { seedCatalogReferenceData } from '../catalog.persistence.js'

const connectionString = process.env.POSTGRES_URL
const nodeEnv = process.env.NODE_ENV ?? 'development'
const allowProductionReferenceData = process.env.ALLOW_PRODUCTION_CATALOG_REFERENCE_DATA === 'true'

if (!connectionString) {
  throw new Error('POSTGRES_URL is required to seed the catalog database.')
}

if (nodeEnv === 'production' && !allowProductionReferenceData) {
  throw new Error(
    'db:seed applies catalog reference data and is blocked in production unless ALLOW_PRODUCTION_CATALOG_REFERENCE_DATA=true.',
  )
}

await seedCatalogReferenceData(connectionString)