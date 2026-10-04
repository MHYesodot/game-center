import 'reflect-metadata'

import { randomUUID } from 'node:crypto'

import { Module, RequestMethod } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { validateEnv } from './infrastructure/config/env.schema.js'
import { InfrastructureModule } from './infrastructure/infrastructure.module.js'
import { createCatalogDatabase, createCatalogPool, migrateCatalogDatabase, seedCatalogReferenceDataWithClient } from './modules/catalog/infrastructure/persistence/catalog.persistence.js'
import { CatalogModule } from './modules/catalog/catalog.module.js'
import { DockerAllocationCleanupService } from './modules/allocations/infrastructure/docker-allocation-cleanup.service.js'
import { allocationContainerName } from './modules/allocations/infrastructure/docker-allocator.config.js'
import { DockerodeRuntimeClient } from './modules/allocations/infrastructure/dockerode-runtime.client.js'
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module.js'
import { PostgresMatchmakingRepository } from './modules/matchmaking/infrastructure/persistence/repositories/postgres-matchmaking.repository.js'
import { createMatchmakingDatabase } from './modules/matchmaking/infrastructure/persistence/matchmaking.persistence.js'
import { SessionsModule } from './modules/sessions/sessions.module.js'
import { PostgresSessionRepository } from './modules/sessions/infrastructure/persistence/repositories/postgres-session.repository.js'
import { createSessionsDatabase } from './modules/sessions/infrastructure/persistence/session.persistence.js'
import { jsonHeaders, registerTestAccount } from './testing/auth-test-client.js'
import { createIsolatedPostgresDatabase } from './testing/isolated-postgres-database.js'
import { createIsolatedRedisNamespace } from './testing/isolated-redis.js'

const baseConnectionString = process.env.POSTGRES_URL ?? 'postgresql://gamecenter:gamecenter@localhost:5432/gamecenter'
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const dockerClient = new DockerodeRuntimeClient()
const dockerImageEnvKey = 'DOCKER_ALLOCATOR_IMAGE_SIGNAL_GRID_0_1_0_PROTOTYPE_PROTOTYPE'
const cleanups: Array<() => Promise<void>> = []

beforeAll(async () => {
  try {
    await dockerClient.ping()
  } catch (error) {
    throw new Error(`Docker allocator integration tests require Docker daemon access: ${String(error)}`)
  }
})

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    if (cleanup) {
      await cleanup()
    }
  }

  for (const container of await dockerClient.listManagedContainers()) {
    await dockerClient.removeContainer(container.id, true).catch(() => undefined)
  }
})

describe('docker allocation integration', () => {
  it('creates a session, allocates a real Docker container, probes the descriptor, and releases idempotently', async () => {
    const testApp = await createDockerTestApplication()
    cleanups.push(testApp.cleanup)
    const playerOne = await registerTestAccount(testApp.baseUrl, 'player-1')
    const playerTwo = await registerTestAccount(testApp.baseUrl, 'player-2')

    await seedMatchedProposal(testApp.matchmakingRepository, 'docker-match-1', [playerOne.playerId, playerTwo.playerId])

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(playerOne.sessionCookie),
      body: JSON.stringify({ matchId: 'docker-match-1' }),
    })

    expect(createResponse.status).toBe(200)
    const created = (await createResponse.json()) as { sessionId: string; status: string }
    expect(created.status).toBe('ready')

    const getAllocation = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation`, {
      headers: jsonHeaders(playerTwo.sessionCookie),
    })

    expect(getAllocation.status).toBe(200)
    const allocation = (await getAllocation.json()) as { allocationId: string; provider: string; status: string; providerReference: string; connection: { host: string; port: number } }
    expect(allocation.provider).toBe('docker')
    expect(allocation.status).toBe('ready')
    expect(allocation.connection.host).toBe('127.0.0.1')
    expect(allocation.connection.port).toBeGreaterThan(0)

    const metadataResponse = await fetch(`http://${allocation.connection.host}:${allocation.connection.port}/metadata`)
    expect(metadataResponse.status).toBe(200)
    expect(await metadataResponse.json()).toMatchObject({
      allocationId: allocation.allocationId,
      sessionId: created.sessionId,
      gameId: 'signal-grid',
      protocolVersion: 'v1',
    })

    const container = await dockerClient.inspectContainer(allocation.providerReference)
    expect(container?.labels).toMatchObject({
      'game-center.managed': 'true',
      'game-center.allocation-id': allocation.allocationId,
      'game-center.session-id': created.sessionId,
      'game-center.game-id': 'signal-grid',
    })

    const release = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation/release`, {
      method: 'POST',
      headers: jsonHeaders(playerOne.sessionCookie),
    })
    expect(release.status).toBe(200)
    expect(await release.json()).toMatchObject({ status: 'released' })

    const repeatedRelease = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation/release`, {
      method: 'POST',
      headers: jsonHeaders(playerOne.sessionCookie),
    })
    expect(repeatedRelease.status).toBe(200)
    expect(await repeatedRelease.json()).toMatchObject({ status: 'released' })
    expect(await dockerClient.inspectContainer(allocation.providerReference)).toBeNull()
  }, 45_000)

  it('keeps concurrent allocation requests for the same session on one managed container', async () => {
    const testApp = await createDockerTestApplication()
    cleanups.push(testApp.cleanup)
    const playerOne = await registerTestAccount(testApp.baseUrl, 'player-1')

    const sessionId = await seedCreatedSession(testApp.sessionRepository, 'docker-session-concurrent', playerOne.playerId)

    const [left, right] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/allocation`, { method: 'POST', headers: jsonHeaders(playerOne.sessionCookie) }),
      fetch(`${testApp.baseUrl}/api/sessions/${sessionId}/allocation`, { method: 'POST', headers: jsonHeaders(playerOne.sessionCookie) }),
    ])

    expect(left.status).toBe(200)
    expect(right.status).toBe(200)

    const leftBody = (await left.json()) as { allocationId: string; providerReference: string; status: string }
    const rightBody = (await right.json()) as { allocationId: string; providerReference: string; status: string }

    expect(leftBody.allocationId).toBe(rightBody.allocationId)
    expect(leftBody.providerReference).toBe(rightBody.providerReference)
    expect(leftBody.status).toBe('ready')

    const container = await dockerClient.findManagedContainer({
      allocationId: leftBody.allocationId,
      name: allocationContainerName(leftBody.allocationId),
    })
    expect(container?.id).toBe(leftBody.providerReference)
  }, 45_000)

  it('reuses the same container after application restart without creating a duplicate', async () => {
    const testApp = await createDockerTestApplication()
    cleanups.push(testApp.cleanup)
    const playerOne = await registerTestAccount(testApp.baseUrl, 'player-1')
    const playerTwo = await registerTestAccount(testApp.baseUrl, 'player-2')

    await seedMatchedProposal(testApp.matchmakingRepository, 'docker-match-restart', [playerOne.playerId, playerTwo.playerId])

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(playerOne.sessionCookie),
      body: JSON.stringify({ matchId: 'docker-match-restart' }),
    })
    const created = (await createResponse.json()) as { sessionId: string }

    const allocationBefore = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation`, {
      headers: jsonHeaders(playerTwo.sessionCookie),
    }).then((response) => response.json() as Promise<{ providerReference: string; allocationId: string }>)

    await testApp.app.close()

    const restarted = await createDockerTestApplication({
      connectionString: testApp.connectionString,
      runtimeNamespace: testApp.runtimeNamespace,
      preserveDatabase: true,
      preserveRedis: true,
    })
    cleanups.push(restarted.cleanup)

    const allocationAfterResponse = await fetch(`${restarted.baseUrl}/api/sessions/${created.sessionId}/allocation`, {
      headers: jsonHeaders(playerTwo.sessionCookie),
    })

    expect(allocationAfterResponse.status).toBe(200)
    const allocationAfter = (await allocationAfterResponse.json()) as { providerReference: string; allocationId: string; status: string }
    expect(allocationAfter.status).toBe('ready')
    expect(allocationAfter.providerReference).toBe(allocationBefore.providerReference)

    const container = await dockerClient.findManagedContainer({
      allocationId: allocationAfter.allocationId,
      name: allocationContainerName(allocationAfter.allocationId),
    })
    expect(container?.id).toBe(allocationBefore.providerReference)
  }, 45_000)

  it('fails cleanly when the configured image is missing and does not leak a ready allocation', async () => {
    const testApp = await createDockerTestApplication({ image: 'game-center/missing-image:p03' })
    cleanups.push(testApp.cleanup)
    const playerOne = await registerTestAccount(testApp.baseUrl, 'player-1')
    const playerTwo = await registerTestAccount(testApp.baseUrl, 'player-2')

    await seedMatchedProposal(testApp.matchmakingRepository, 'docker-match-missing-image', [playerOne.playerId, playerTwo.playerId])

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(playerOne.sessionCookie),
      body: JSON.stringify({ matchId: 'docker-match-missing-image' }),
    })

    expect(createResponse.status).toBe(409)
    expect(await createResponse.json()).toEqual({ code: 'SESSION_CREATION_FAILED' })
  }, 45_000)

  it('fails cleanly on Docker health timeout and removes the failed managed container', async () => {
    const testApp = await createDockerTestApplication({ testMode: 'hang-health', healthTimeoutMs: '1500' })
    cleanups.push(testApp.cleanup)
    const playerOne = await registerTestAccount(testApp.baseUrl, 'player-1')
    const playerTwo = await registerTestAccount(testApp.baseUrl, 'player-2')

    await seedMatchedProposal(testApp.matchmakingRepository, 'docker-match-timeout', [playerOne.playerId, playerTwo.playerId])

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(playerOne.sessionCookie),
      body: JSON.stringify({ matchId: 'docker-match-timeout' }),
    })

    expect(createResponse.status).toBe(409)
    expect(await createResponse.json()).toEqual({ code: 'SESSION_CREATION_FAILED' })
  }, 45_000)

  it('cleans orphaned managed containers without touching active managed or unmanaged containers', async () => {
    const testApp = await createDockerTestApplication({ orphanMinAgeSeconds: '0' })
    cleanups.push(testApp.cleanup)
    const playerOne = await registerTestAccount(testApp.baseUrl, 'player-1')
    const playerTwo = await registerTestAccount(testApp.baseUrl, 'player-2')

    await seedMatchedProposal(testApp.matchmakingRepository, 'docker-match-cleanup', [playerOne.playerId, playerTwo.playerId])

    const createResponse = await fetch(`${testApp.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: jsonHeaders(playerOne.sessionCookie),
      body: JSON.stringify({ matchId: 'docker-match-cleanup' }),
    })

    const created = (await createResponse.json()) as { sessionId: string }
    const activeAllocation = await fetch(`${testApp.baseUrl}/api/sessions/${created.sessionId}/allocation`, {
      headers: jsonHeaders(playerTwo.sessionCookie),
    }).then((response) => response.json() as Promise<{ allocationId: string }>)

    const orphanAllocationId = `orphan-${randomUUID()}`
    const orphan = await dockerClient.createContainer({
      name: allocationContainerName(orphanAllocationId),
      image: 'game-center/test-game-server:p03',
      labels: {
        'game-center.managed': 'true',
        'game-center.allocation-id': orphanAllocationId,
        'game-center.session-id': `orphan-session-${randomUUID()}`,
        'game-center.game-id': 'signal-grid',
      },
      env: { PORT: '7777', TEST_MODE: 'normal' },
      networkName: 'game-center-game-servers',
      internalPort: 7777,
      memoryBytes: 64 * 1024 * 1024,
      nanoCpus: 250_000_000,
      pidsLimit: 64,
      stopTimeoutSeconds: 1,
    })
    await dockerClient.startContainer(orphan.id)

    const unmanaged = await dockerClient.createContainer({
      name: `manual-${randomUUID()}`,
      image: 'game-center/test-game-server:p03',
      labels: {},
      env: { PORT: '7777', TEST_MODE: 'normal' },
      networkName: 'game-center-game-servers',
      internalPort: 7777,
      memoryBytes: 64 * 1024 * 1024,
      nanoCpus: 250_000_000,
      pidsLimit: 64,
      stopTimeoutSeconds: 1,
    })

    const cleanupResult = await testApp.cleanupService.cleanupOrphanedContainers()
    expect(cleanupResult.orphanedManagedContainers).toBeGreaterThanOrEqual(1)

    expect(await dockerClient.findManagedContainer({ allocationId: activeAllocation.allocationId, name: allocationContainerName(activeAllocation.allocationId) })).not.toBeNull()
    expect(await dockerClient.findManagedContainer({ allocationId: orphanAllocationId, name: allocationContainerName(orphanAllocationId) })).toBeNull()
    expect(await dockerClient.inspectContainer(unmanaged.id)).not.toBeNull()
  }, 45_000)
})

async function createDockerTestApplication(options: {
  connectionString?: string
  runtimeNamespace?: string
  image?: string
  testMode?: 'normal' | 'hang-health' | 'exit-immediately'
  healthTimeoutMs?: string
  orphanMinAgeSeconds?: string
  preserveDatabase?: boolean
  preserveRedis?: boolean
} = {}) {
  const database = options.connectionString
    ? { connectionString: options.connectionString, cleanup: async () => {} }
    : await createIsolatedPostgresDatabase(baseConnectionString as string, 'docker_allocations_test')
  const runtimeNamespace = options.runtimeNamespace ?? `docker-allocations-${randomUUID()}`
  const redis = options.preserveRedis ? { namespace: runtimeNamespace, cleanup: async () => {} } : await createIsolatedRedisNamespace(redisUrl, runtimeNamespace)
  const pool = createCatalogPool(database.connectionString)

  if (!options.preserveDatabase) {
    await migrateCatalogDatabase(database.connectionString)
    await seedCatalogReferenceDataWithClient(createCatalogDatabase(pool))
  }

  const app = await createTestApplication(database.connectionString, redis.namespace, options)
  const baseUrl = await listenOnRandomPort(app)
  const matchmakingRepository = new PostgresMatchmakingRepository(createMatchmakingDatabase(pool))
  const sessionRepository = new PostgresSessionRepository(createSessionsDatabase(pool))
  const cleanupService = app.get(DockerAllocationCleanupService)

  return {
    app,
    baseUrl,
    connectionString: database.connectionString,
    runtimeNamespace: redis.namespace,
    matchmakingRepository,
    sessionRepository,
    cleanupService,
    cleanup: async () => {
      await app.close()
      await pool.end()
      await redis.cleanup()
      await database.cleanup()
    },
  }
}

async function createTestApplication(connectionString: string, runtimeNamespace: string, options: {
  image?: string
  testMode?: 'normal' | 'hang-health' | 'exit-immediately'
  healthTimeoutMs?: string
  orphanMinAgeSeconds?: string
}) {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_URL: process.env.POSTGRES_URL,
    REDIS_URL: process.env.REDIS_URL,
    NATS_URL: process.env.NATS_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    PORT: process.env.PORT,
    MATCHMAKING_QUEUE_NAMESPACE: process.env.MATCHMAKING_QUEUE_NAMESPACE,
    ALLOCATION_PROVIDER: process.env.ALLOCATION_PROVIDER,
    DOCKER_ALLOCATOR_PUBLIC_HOST: process.env.DOCKER_ALLOCATOR_PUBLIC_HOST,
    DOCKER_ALLOCATOR_HEALTH_TIMEOUT_MS: process.env.DOCKER_ALLOCATOR_HEALTH_TIMEOUT_MS,
    DOCKER_ALLOCATOR_HEALTH_POLL_INTERVAL_MS: process.env.DOCKER_ALLOCATOR_HEALTH_POLL_INTERVAL_MS,
    DOCKER_ALLOCATOR_TEST_MODE: process.env.DOCKER_ALLOCATOR_TEST_MODE,
    DOCKER_ALLOCATOR_ORPHAN_MIN_AGE_SECONDS: process.env.DOCKER_ALLOCATOR_ORPHAN_MIN_AGE_SECONDS,
    [dockerImageEnvKey]: process.env[dockerImageEnvKey],
  }

  process.env.NODE_ENV = 'test'
  process.env.POSTGRES_URL = connectionString
  process.env.REDIS_URL = redisUrl
  delete process.env.NATS_URL
  process.env.CORS_ORIGIN = 'http://127.0.0.1:0'
  process.env.PORT = '3003'
  process.env.MATCHMAKING_QUEUE_NAMESPACE = runtimeNamespace
  process.env.ALLOCATION_PROVIDER = 'docker'
  process.env.DOCKER_ALLOCATOR_PUBLIC_HOST = '127.0.0.1'
  process.env.DOCKER_ALLOCATOR_HEALTH_TIMEOUT_MS = options.healthTimeoutMs ?? '5000'
  process.env.DOCKER_ALLOCATOR_HEALTH_POLL_INTERVAL_MS = '150'
  process.env.DOCKER_ALLOCATOR_TEST_MODE = options.testMode ?? 'normal'
  process.env.DOCKER_ALLOCATOR_ORPHAN_MIN_AGE_SECONDS = options.orphanMinAgeSeconds ?? '30'
  process.env[dockerImageEnvKey] = options.image ?? 'game-center/test-game-server:p03'

  cleanups.push(async () => {
    restoreEnvironment(previousEnvironment)
  })

  class DockerAllocationTestModule {}

  Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validate: validateEnv,
      }),
      InfrastructureModule,
      CatalogModule,
      MatchmakingModule,
      SessionsModule,
    ],
  })(DockerAllocationTestModule)

  const app = await NestFactory.create(DockerAllocationTestModule, { logger: false })

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  })

  return app
}

async function seedMatchedProposal(repository: PostgresMatchmakingRepository, matchId: string, participantPlayerIds: [string, string]) {
  const queueKey = ['signal-grid', '0.1.0-prototype', 'v1', 'quick-play', 'web', 'global'].join('::')
  const requestedAt = '2026-09-30T11:00:00.000Z'
  const matchedAt = '2026-09-30T11:01:00.000Z'

  await repository.withTransaction(async (transaction) => {
    await transaction.createRequest({
      requestId: `${matchId}-request-1`,
      requesterType: 'player',
      requesterId: participantPlayerIds[0],
      gameId: 'signal-grid',
      queueKey,
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      status: 'matched',
      requestedAt,
      cancelledAt: null,
      matchedAt,
      expiresAt: null,
      terminalOutcome: 'matched',
      sourceLobbyId: 'lobby-1',
      activeProposalId: null,
    })
    await transaction.createRequest({
      requestId: `${matchId}-request-2`,
      requesterType: 'player',
      requesterId: participantPlayerIds[1],
      gameId: 'signal-grid',
      queueKey,
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      status: 'matched',
      requestedAt,
      cancelledAt: null,
      matchedAt,
      expiresAt: null,
      terminalOutcome: 'matched',
      sourceLobbyId: null,
      activeProposalId: null,
    })

    await transaction.createProposal({
      proposalId: `${matchId}-proposal`,
      matchId,
      queueKey,
      gameId: 'signal-grid',
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      status: 'matched',
      createdAt: requestedAt,
      expiresAt: '2026-09-30T11:05:00.000Z',
      matchedAt,
      resolvedAt: matchedAt,
      members: [
        {
          proposalId: `${matchId}-proposal`,
          requestId: `${matchId}-request-1`,
          playerId: participantPlayerIds[0],
          acceptanceStatus: 'accepted',
          respondedAt: matchedAt,
        },
        {
          proposalId: `${matchId}-proposal`,
          requestId: `${matchId}-request-2`,
          playerId: participantPlayerIds[1],
          acceptanceStatus: 'accepted',
          respondedAt: matchedAt,
        },
      ],
    })
  })
}

async function seedCreatedSession(repository: PostgresSessionRepository, sessionId: string, playerId: string) {
  await repository.withTransaction(async (transaction) => {
    await transaction.createSession({
      sessionId,
      sourceKind: 'matchmaking',
      matchId: `match-${sessionId}`,
      proposalId: `proposal-${sessionId}`,
      gameId: 'signal-grid',
      queueType: 'quick-play',
      platform: 'web',
      region: null,
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      status: 'created',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      expiresAt: '2026-12-31T10:15:00.000Z',
      failureCode: null,
      participants: [
        {
          sessionId,
          playerId,
          sourceRequestId: `request-${sessionId}`,
          sourceLobbyId: null,
          joinedAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    })
  })

  return sessionId
}

async function listenOnRandomPort(app: INestApplication) {
  await app.listen(0, '127.0.0.1')
  return await app.getUrl()
}

function restoreEnvironment(previousEnvironment: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}