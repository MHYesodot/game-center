import { ConfigService } from '@nestjs/config'
import { afterEach, describe, expect, it } from 'vitest'

import { createIsolatedRedisNamespace } from '../../../../testing/isolated-redis.js'
import { RedisLobbyRuntimeStore } from './redis-lobby-runtime.store.js'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    if (cleanup) {
      await cleanup()
    }
  }
})

describe('RedisLobbyRuntimeStore integration', () => {
  it('uses a versioned namespace, stores runtime state with TTL, and clears ready on disconnect', async () => {
    const isolated = await createIsolatedRedisNamespace(redisUrl, 'gc:v1:lobby-test')
    cleanups.push(() => isolated.cleanup())

    const configService = new ConfigService({
      LOBBY_RUNTIME_NAMESPACE: isolated.namespace,
    })
    const store = new RedisLobbyRuntimeStore(isolated.client as never, configService)

    await store.markConnected('lobby-1', 'player-1', '2026-09-29T10:00:00.000Z')
    await store.setReadyState('lobby-1', 'player-1', true, '2026-09-29T10:00:10.000Z')

    const initialRuntime = await store.getRuntimeState('lobby-1', ['player-1'])
    const keysAfterReady = (await isolated.client.keys(`${isolated.namespace}:lobby:lobby-1:*`)).sort()
    const ttlPresence = await isolated.client.ttl(`${isolated.namespace}:lobby:lobby-1:presence`)
    const ttlReady = await isolated.client.ttl(`${isolated.namespace}:lobby:lobby-1:ready`)

    expect(keysAfterReady).toEqual([
      `${isolated.namespace}:lobby:lobby-1:presence`,
      `${isolated.namespace}:lobby:lobby-1:ready`,
    ])
    expect(initialRuntime.available).toBe(true)
    expect(initialRuntime.allMembersReady).toBe(true)
    expect(ttlPresence).toBeGreaterThan(0)
    expect(ttlPresence).toBeLessThanOrEqual(15 * 60)
    expect(ttlReady).toBeGreaterThan(0)
    expect(ttlReady).toBeLessThanOrEqual(15 * 60)

    await store.markDisconnected(
      'lobby-1',
      'player-1',
      '2026-09-29T10:01:00.000Z',
      store.reconnectDeadlineAt(new Date('2026-09-29T10:01:00.000Z')),
    )

    const disconnectedRuntime = await store.getRuntimeState('lobby-1', ['player-1'])

    expect(disconnectedRuntime.readyMemberIds).toEqual([])
    expect(disconnectedRuntime.allMembersReady).toBe(false)
    expect(disconnectedRuntime.members).toEqual([
      {
        playerId: 'player-1',
        connectionState: 'reconnecting',
        ready: false,
        lastSeenAt: '2026-09-29T10:01:00.000Z',
        reconnectDeadlineAt: '2026-09-29T10:03:00.000Z',
      },
    ])
  }, 15_000)
})