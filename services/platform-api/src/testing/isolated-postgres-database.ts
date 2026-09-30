import { randomUUID } from 'node:crypto'

import { Client } from 'pg'

export async function createIsolatedPostgresDatabase(connectionString: string, prefix: string) {
  const databaseName = `${prefix}_${randomUUID().replace(/-/g, '')}`
  const adminConnectionString = withDatabaseName(connectionString, 'postgres')
  const databaseConnectionString = withDatabaseName(connectionString, databaseName)

  const adminClient = new Client({ connectionString: adminConnectionString })
  await adminClient.connect()

  try {
    await adminClient.query(`create database "${databaseName}"`)
  } finally {
    await adminClient.end()
  }

  return {
    connectionString: databaseConnectionString,
    cleanup: async () => {
      const cleanupClient = new Client({ connectionString: adminConnectionString })
      await cleanupClient.connect()

      try {
        await cleanupClient.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
          [databaseName],
        )
        await cleanupClient.query(`drop database if exists "${databaseName}"`)
      } finally {
        await cleanupClient.end()
      }
    },
  }
}

function withDatabaseName(connectionString: string, databaseName: string) {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}