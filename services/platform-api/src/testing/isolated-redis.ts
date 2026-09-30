import { randomUUID } from 'node:crypto'

import { createClient } from 'redis'

export async function createIsolatedRedisNamespace(redisUrl: string, prefix = 'gc:test') {
  const namespace = `${prefix}:${randomUUID().replace(/-/g, '')}`
  const client = createClient({ url: redisUrl })
  client.on('error', () => {})
  await client.connect()

  return {
    namespace,
    client,
    clear: async () => {
      const keys = await client.keys(`${namespace}:*`)

      if (keys.length > 0) {
        await client.del(keys)
      }
    },
    cleanup: async () => {
      const keys = await client.keys(`${namespace}:*`)

      if (keys.length > 0) {
        await client.del(keys)
      }

      await client.quit()
    },
  }
}