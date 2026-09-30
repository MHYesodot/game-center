import 'reflect-metadata'

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { createClient } from 'redis'
import { afterEach, describe, expect, it } from 'vitest'

import { validateEnv } from './infrastructure/config/env.schema.js'
import { InfrastructureModule } from './infrastructure/infrastructure.module.js'
import { CatalogModule } from './modules/catalog/catalog.module.js'
import { createCatalogDatabase, createCatalogPool, migrateCatalogDatabase, seedCatalogReferenceDataWithClient } from './modules/catalog/infrastructure/persistence/catalog.persistence.js'
import { MatchmakingService } from './modules/matchmaking/application/matchmaking.service.js'
import { MATCHMAKING_QUEUE_STORE, MATCHMAKING_REPOSITORY, type MatchmakingQueueStore, type MatchmakingRepository } from './modules/matchmaking/application/matchmaking.ports.js'
import { buildQueueKey, type DurableMatchProposal, type DurableMatchmakingRequest } from './modules/matchmaking/domain/queue-ticket.js'
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module.js'
import { createIsolatedPostgresDatabase } from './testing/isolated-postgres-database.js'
import { createIsolatedRedisNamespace } from './testing/isolated-redis.js'

const baseConnectionString = process.env.POSTGRES_URL
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const execFileAsync = promisify(execFile)

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for matchmaking integration tests.')
}

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    if (cleanup) {
      await cleanup()
    }
  }
})

describe('matchmaking http integration', () => {
  it('enqueues, gets, and cancels a durable matchmaking request idempotently', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const enqueueResponse = await fetch(`${testApp.baseUrl}/api/matchmaking/requests`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
      body: JSON.stringify({
        gameId: 'signal-grid',
        queueType: 'quick-play',
        platform: 'web',
      }),
    })

    expect(enqueueResponse.status).toBe(200)
    const created = (await enqueueResponse.json()) as { requestId: string; status: string; runtime: { available: boolean } }
    expect(created.status).toBe('queued')
    expect(created.runtime.available).toBe(true)

    const getResponse = await fetch(`${testApp.baseUrl}/api/matchmaking/requests/${created.requestId}`, {
      headers: jsonHeaders('player-1'),
    })
    expect(getResponse.status).toBe(200)

    const cancelResponse = await fetch(`${testApp.baseUrl}/api/matchmaking/requests/${created.requestId}/cancel`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
    })
    expect(cancelResponse.status).toBe(200)

    const repeatedCancelResponse = await fetch(`${testApp.baseUrl}/api/matchmaking/requests/${created.requestId}/cancel`, {
      method: 'POST',
      headers: jsonHeaders('player-1'),
    })
    expect(repeatedCancelResponse.status).toBe(200)

    const cancelled = (await repeatedCancelResponse.json()) as { status: string; terminalOutcome: string | null }
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.terminalOutcome).toBe('cancelled')
  }, 20_000)

  it('prevents duplicate concurrent enqueue for the same player', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/matchmaking/requests`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
        body: JSON.stringify({ gameId: 'signal-grid', queueType: 'quick-play', platform: 'web' }),
      }),
      fetch(`${testApp.baseUrl}/api/matchmaking/requests`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
        body: JSON.stringify({ gameId: 'signal-grid', queueType: 'quick-play', platform: 'web' }),
      }),
    ])

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)

    const first = (await firstResponse.json()) as { requestId: string; queue: { gameId: string; queueType: 'quick-play'; platform: 'web'; region: string | null; gameVersion: string; protocolVersion: string } }
    const second = (await secondResponse.json()) as { requestId: string }
    expect(second.requestId).toBe(first.requestId)

    const queueKey = buildQueueKey(first.queue)
    const candidates = await testApp.store.getCandidateRequestIds(queueKey, 10)

    expect(candidates).toEqual([first.requestId])
  }, 20_000)

  it('creates a proposal, keeps accept idempotent, and resolves matched after all accepts', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const requestOne = await enqueue(testApp.baseUrl, 'player-1')
    const requestTwo = await enqueue(testApp.baseUrl, 'player-2')

    const refreshedOne = await getRequest(testApp.baseUrl, requestOne.requestId, 'player-1')
    const refreshedTwo = await getRequest(testApp.baseUrl, requestTwo.requestId, 'player-2')
    const proposalId = refreshedOne.activeProposalId ?? refreshedTwo.activeProposalId

    expect(proposalId).toBeTruthy()

    const [acceptFirst, acceptSecond] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/matchmaking/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
      }),
      fetch(`${testApp.baseUrl}/api/matchmaking/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: jsonHeaders('player-1'),
      }),
    ])

    expect(acceptFirst.status).toBe(200)
    expect(acceptSecond.status).toBe(200)

    const proposalAfterRepeatedAccept = (await acceptSecond.json()) as { status: string; members: Array<{ playerId: string; acceptanceStatus: string }> }
    expect(proposalAfterRepeatedAccept.status).toBe('pending')
    expect(proposalAfterRepeatedAccept.members.find((member) => member.playerId === 'player-1')?.acceptanceStatus).toBe('accepted')

    const finalAccept = await fetch(`${testApp.baseUrl}/api/matchmaking/proposals/${proposalId}/accept`, {
      method: 'POST',
      headers: jsonHeaders('player-2'),
    })
    expect(finalAccept.status).toBe(200)

    const matched = (await finalAccept.json()) as { status: string }
    expect(matched.status).toBe('matched')
  }, 20_000)

  it('cancels a proposed request and requeues the other member', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const queue = await createQueuedPair(testApp)
    const proposal = await testApp.service.runQueueCycle(queue.queueKey)
    expect(proposal?.proposalId).toBeTruthy()

    await testApp.service.cancelRequest(queue.requestIds[0], { playerId: 'player-1', requestId: 'cancel-proposed-1' })

    const cancelled = await testApp.repository.getRequestById(queue.requestIds[0])
    const survivor = await testApp.repository.getRequestById(queue.requestIds[1])
    const cancelledProposal = await testApp.repository.getProposalById(proposal?.proposalId as string)

    expect(cancelled?.status).toBe('cancelled')
    expect(survivor?.status).toBe('queued')
    expect(cancelledProposal?.status).toBe('cancelled')
  }, 20_000)

  it('allows only one proposal when two workers race the same queue', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const queue = await createQueuedPair(testApp)

    const [first, second] = await Promise.all([
      testApp.service.runQueueCycle(queue.queueKey),
      testApp.service.runQueueCycle(queue.queueKey),
    ])

    const proposals = [first, second].filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null)
    expect(proposals).toHaveLength(1)

    const requestOne = await testApp.repository.getRequestById(queue.requestIds[0])
    const requestTwo = await testApp.repository.getRequestById(queue.requestIds[1])
    expect(requestOne?.activeProposalId).toBeTruthy()
    expect(requestOne?.activeProposalId).toBe(requestTwo?.activeProposalId)
  }, 20_000)

  it('keeps cancel vs match within a legal converged durable state', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const queue = await createQueuedPair(testApp)

    await Promise.allSettled([
      testApp.service.runQueueCycle(queue.queueKey),
      testApp.service.cancelRequest(queue.requestIds[0], { playerId: 'player-1', requestId: 'cancel-race-1' }),
    ])

    const cancelled = await testApp.repository.getRequestById(queue.requestIds[0])
    const survivor = await testApp.repository.getRequestById(queue.requestIds[1])

    const cancellationWon = cancelled?.status === 'cancelled' && survivor?.status === 'queued'
    const proposalWon =
      cancelled?.status === 'proposed' &&
      survivor?.status === 'proposed' &&
      cancelled.activeProposalId !== null &&
      cancelled.activeProposalId === survivor.activeProposalId

    expect(cancellationWon || proposalWon).toBe(true)
  }, 20_000)

  it('keeps timeout vs accept within a legal durable recovery state', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const queue = await createQueuedPair(testApp)
    const createdProposal = await testApp.service.runQueueCycle(queue.queueKey)
    expect(createdProposal?.proposalId).toBeTruthy()

    await testApp.repository.withTransaction(async (transaction) => {
      const proposal = await transaction.getProposalByIdForUpdate(createdProposal?.proposalId as string)

      if (!proposal) {
        throw new Error('Expected proposal to exist')
      }

      await transaction.updateProposal({
        ...proposal,
        expiresAt: '2026-09-30T09:59:00.000Z',
      } as DurableMatchProposal)
    })

    await Promise.allSettled([
      testApp.service.acceptProposal(createdProposal?.proposalId as string, { playerId: 'player-1', requestId: 'accept-timeout-1' }),
      testApp.service.acceptProposal(createdProposal?.proposalId as string, { playerId: 'player-2', requestId: 'accept-timeout-2' }),
    ])

    const proposal = await testApp.repository.getProposalById(createdProposal?.proposalId as string)
    const requestOne = await testApp.repository.getRequestById(queue.requestIds[0])
    const requestTwo = await testApp.repository.getRequestById(queue.requestIds[1])

    expect(proposal?.status).toBe('expired')
    const requestsQueued = requestOne?.status === 'queued' && requestTwo?.status === 'queued'
    const requestsRematched =
      requestOne?.status === 'proposed' &&
      requestTwo?.status === 'proposed' &&
      requestOne.activeProposalId !== null &&
      requestOne.activeProposalId === requestTwo.activeProposalId

    expect(requestsQueued || requestsRematched).toBe(true)
  }, 20_000)

  it('reconstructs queued requests after Redis runtime flush without creating duplicates', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)

    const queue = await createQueuedPair(testApp)
    await testApp.redis.clear()

    await testApp.service.getRequest(queue.requestIds[0], { playerId: 'player-1', requestId: 'rebuild-1' })
    await testApp.service.getRequest(queue.requestIds[1], { playerId: 'player-2', requestId: 'rebuild-2' })

    const candidates = await testApp.store.getCandidateRequestIds(queue.queueKey, 10)
    expect(candidates.sort()).toEqual([...queue.requestIds].sort())

    const proposal = await testApp.service.runQueueCycle(queue.queueKey)
    expect(proposal?.proposalId).toBeTruthy()
  }, 20_000)

  it('fails runQueueCycle fast during Redis outage and recovers after Redis is restored', async () => {
    const testApp = await createMatchmakingTestApplication()
    cleanups.push(testApp.cleanup)
    cleanups.push(async () => {
      await ensureComposeServiceRunning('redis')
      await waitForRedisAvailability()
    })

    const queue = await createQueuedPair(testApp)

    await stopComposeService('redis')
    await waitFor(async () => {
      const request = await testApp.service.getRequest(queue.requestIds[0], { playerId: 'player-1', requestId: randomUUID() })
      expect(request.runtime.available).toBe(false)
    })

    const startedAt = Date.now()
    const rejection = await testApp.service.runQueueCycle(queue.queueKey).catch((error: unknown) => error)
    const elapsedMs = Date.now() - startedAt

    expect(elapsedMs).toBeLessThan(2_000)
    expect(rejection).toMatchObject({
      getStatus: expect.any(Function),
      getResponse: expect.any(Function),
    })
    expect(rejection.getStatus()).toBe(503)
    expect(rejection.getResponse()).toEqual({ code: 'MATCHMAKING_UNAVAILABLE' })

    const queuedAfterFailure = await Promise.all(queue.requestIds.map((requestId) => testApp.repository.getRequestById(requestId)))
    expect(queuedAfterFailure).toEqual([
      expect.objectContaining({ requestId: queue.requestIds[0], status: 'queued', activeProposalId: null }),
      expect.objectContaining({ requestId: queue.requestIds[1], status: 'queued', activeProposalId: null }),
    ])
    expect(await countQueueProposals(testApp.connectionString, queue.queueKey)).toBe(0)

    await ensureComposeServiceRunning('redis')
    await waitForRedisAvailability()

    await testApp.service.getRequest(queue.requestIds[0], { playerId: 'player-1', requestId: randomUUID() })
    await testApp.service.getRequest(queue.requestIds[1], { playerId: 'player-2', requestId: randomUUID() })
    await waitFor(async () => {
      expect((await testApp.store.getCandidateRequestIds(queue.queueKey, 10)).sort()).toEqual([...queue.requestIds].sort())
    })

    await testApp.service.getRequest(queue.requestIds[0], { playerId: 'player-1', requestId: randomUUID() })
    await testApp.service.getRequest(queue.requestIds[1], { playerId: 'player-2', requestId: randomUUID() })
    await waitFor(async () => {
      expect((await testApp.store.getCandidateRequestIds(queue.queueKey, 10)).sort()).toEqual([...queue.requestIds].sort())
    })

    const proposal = await testApp.service.runQueueCycle(queue.queueKey)
    expect(proposal?.proposalId).toBeTruthy()
    expect(await testApp.store.getCandidateRequestIds(queue.queueKey, 10)).toEqual([])
    expect(await countQueueProposals(testApp.connectionString, queue.queueKey)).toBe(1)
  }, 45_000)
})

async function createMatchmakingTestApplication() {
  const database = await createIsolatedPostgresDatabase(baseConnectionString as string, 'matchmaking_test')
  const redis = await createIsolatedRedisNamespace(redisUrl, 'gc:v1:mm-test')

  await migrateCatalogDatabase(database.connectionString)
  const pool = createCatalogPool(database.connectionString)
  await seedCatalogReferenceDataWithClient(createCatalogDatabase(pool))
  await pool.end()

  process.env.NODE_ENV = 'test'
  process.env.POSTGRES_URL = database.connectionString
  process.env.REDIS_URL = redisUrl
  process.env.MATCHMAKING_RUNTIME_NAMESPACE = redis.namespace
  process.env.PORT = '3201'

  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validate: validateEnv,
      }),
      InfrastructureModule,
      CatalogModule,
      MatchmakingModule,
    ],
  })
  class MatchmakingIntegrationTestModule {}

  const app = await NestFactory.create(MatchmakingIntegrationTestModule, {
    logger: false,
  })
  app.setGlobalPrefix('api')
  await app.listen(0, '127.0.0.1')

  const address = app.getHttpServer().address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const repository = app.get<MatchmakingRepository>(MATCHMAKING_REPOSITORY as never)
  const store = app.get<MatchmakingQueueStore>(MATCHMAKING_QUEUE_STORE as never)
  const service = app.get(MatchmakingService)

  return {
    app,
    baseUrl,
    connectionString: database.connectionString,
    repository,
    store,
    service,
    redis,
    cleanup: async () => {
      await app.close()
      await redis.cleanup()
      await database.cleanup()
    },
  }
}

async function stopComposeService(service: string) {
  await runDockerCompose(['stop', service])
}

async function ensureComposeServiceRunning(service: string) {
  await runDockerCompose(['up', '-d', service])
}

async function runDockerCompose(args: string[]) {
  await execFileAsync('docker', ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml', ...args], {
    cwd: repoRoot,
    windowsHide: true,
  })
}

async function waitForRedisAvailability() {
  await waitFor(async () => {
    const client = createClient({ url: redisUrl })
    client.on('error', () => {})

    try {
      await client.connect()
      expect(await client.ping()).toBe('PONG')
    } finally {
      if (client.isOpen) {
        await client.quit()
      }
    }
  })
}

async function waitFor(assertion: () => Promise<void>, timeoutMs = 10_000, intervalMs = 100) {
  const startedAt = Date.now()
  let lastError: unknown = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  throw lastError ?? new Error('Timed out waiting for condition')
}

async function countQueueProposals(connectionString: string, queueKey: string) {
  const pool = createCatalogPool(connectionString)

  try {
    const result = await pool.query<{ count: number }>('select count(*)::int as count from match_proposals where queue_key = $1', [queueKey])
    return result.rows[0]?.count ?? 0
  } finally {
    await pool.end()
  }
}

async function enqueue(baseUrl: string, playerId: string) {
  const response = await fetch(`${baseUrl}/api/matchmaking/requests`, {
    method: 'POST',
    headers: jsonHeaders(playerId),
    body: JSON.stringify({
      gameId: 'signal-grid',
      queueType: 'quick-play',
      platform: 'web',
    }),
  })

  expect(response.status).toBe(200)
  return (await response.json()) as {
    requestId: string
    queue: {
      gameId: string
      queueType: 'quick-play'
      platform: 'web'
      region: string | null
      gameVersion: string
      protocolVersion: string
    }
    activeProposalId: string | null
  }
}

async function getRequest(baseUrl: string, requestId: string, playerId: string) {
  const response = await fetch(`${baseUrl}/api/matchmaking/requests/${requestId}`, {
    headers: jsonHeaders(playerId),
  })
  expect(response.status).toBe(200)
  return (await response.json()) as { activeProposalId: string | null }
}

function jsonHeaders(playerId: string) {
  return {
    'content-type': 'application/json',
    'x-player-id': playerId,
    'x-request-id': randomUUID(),
  }
}

async function createQueuedPair(testApp: Awaited<ReturnType<typeof createMatchmakingTestApplication>>) {
  const now = Date.now()
  const firstRequestedAt = new Date(now - 2_000).toISOString()
  const secondRequestedAt = new Date(now - 1_000).toISOString()
  const expiresAt = new Date(now + 10 * 60 * 1_000).toISOString()
  const queue: MatchmakingQueueIdentity = {
    gameId: 'signal-grid',
    queueType: 'quick-play',
    platform: 'web',
    region: null,
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
  }
  const queueKey = buildQueueKey(queue)
  const requestIds = ['request-a', 'request-b']
  const requests: DurableMatchmakingRequest[] = [
    {
      requestId: requestIds[0],
      requesterType: 'player',
      requesterId: 'player-1',
      gameId: queue.gameId,
      queueKey,
      queueType: queue.queueType,
      platform: queue.platform,
      region: queue.region,
      gameVersion: queue.gameVersion,
      protocolVersion: queue.protocolVersion,
      status: 'queued',
      requestedAt: firstRequestedAt,
      cancelledAt: null,
      matchedAt: null,
      expiresAt,
      terminalOutcome: null,
      sourceLobbyId: null,
      activeProposalId: null,
    },
    {
      requestId: requestIds[1],
      requesterType: 'player',
      requesterId: 'player-2',
      gameId: queue.gameId,
      queueKey,
      queueType: queue.queueType,
      platform: queue.platform,
      region: queue.region,
      gameVersion: queue.gameVersion,
      protocolVersion: queue.protocolVersion,
      status: 'queued',
      requestedAt: secondRequestedAt,
      cancelledAt: null,
      matchedAt: null,
      expiresAt,
      terminalOutcome: null,
      sourceLobbyId: null,
      activeProposalId: null,
    },
  ]

  await testApp.repository.withTransaction(async (transaction) => {
    for (const request of requests) {
      await transaction.createRequest(request)
    }
  })

  for (const request of requests) {
    await testApp.store.enqueue(request)
  }

  return {
    queueKey,
    requestIds,
  }
}