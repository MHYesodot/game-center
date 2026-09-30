import { ConfigService } from '@nestjs/config'
import { afterEach, describe, expect, it } from 'vitest'

import { createIsolatedRedisNamespace } from '../../../../testing/isolated-redis.js'
import { RedisMatchmakingQueueStore } from './redis-matchmaking-queue.store.js'
import type { DurableMatchmakingRequest } from '../../domain/queue-ticket.js'

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

describe('RedisMatchmakingQueueStore integration', () => {
  it('uses a versioned namespace, tracks queue ordering, and stores proposal leases with TTL', async () => {
    const isolated = await createIsolatedRedisNamespace(redisUrl, 'gc:v1:mm-test')
    cleanups.push(() => isolated.cleanup())

    const store = new RedisMatchmakingQueueStore(
      isolated.client as never,
      new ConfigService({ MATCHMAKING_RUNTIME_NAMESPACE: isolated.namespace }),
    )

    const request: DurableMatchmakingRequest = {
      requestId: 'request-1',
      requesterType: 'player',
      requesterId: 'player-1',
      gameId: 'signal-grid',
      queueKey: 'signal-grid::0.1.0::v1::quick-play::web::global',
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0',
      protocolVersion: 'v1',
      status: 'queued',
      requestedAt: '2026-09-30T10:00:00.000Z',
      cancelledAt: null,
      matchedAt: null,
      expiresAt: '2026-09-30T10:10:00.000Z',
      terminalOutcome: null,
      sourceLobbyId: null,
      activeProposalId: null,
    }

    await store.enqueue(request)
    await store.enqueue({ ...request, requestId: 'request-2', requesterId: 'player-2', requestedAt: '2026-09-30T10:00:05.000Z' })
    await store.touchProposalLease('proposal-1', new Date(Date.now() + 15_000).toISOString())

    const candidates = await store.getCandidateRequestIds(request.queueKey, 10)
    const runtimeState = await store.getRuntimeState(request.queueKey, 'request-2')
    const keys = (await isolated.client.keys(`${isolated.namespace}:*`)).sort()
    const queueTtl = await isolated.client.ttl(`${isolated.namespace}:queue:${request.queueKey}`)
    const proposalTtl = await isolated.client.ttl(`${isolated.namespace}:proposal:proposal-1`)

    expect(keys).toEqual([
      `${isolated.namespace}:proposal:proposal-1`,
      `${isolated.namespace}:queue:${request.queueKey}`,
    ])
    expect(candidates).toEqual(['request-1', 'request-2'])
    expect(runtimeState).toEqual({
      available: true,
      queuePosition: 2,
      estimatedWaitSeconds: null,
      candidateCount: 2,
      lastHeartbeatAt: null,
      searchExpansionVersion: null,
    })
    expect(queueTtl).toBeGreaterThan(0)
    expect(queueTtl).toBeLessThanOrEqual(15 * 60)
    expect(proposalTtl).toBeGreaterThan(0)
  }, 15_000)
})