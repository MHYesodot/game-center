import type { AllocationRequest } from '@game-center/contracts'
import type { ConfigService } from '@nestjs/config'

import { AllocationProviderError } from '../application/allocations.errors.js'

export const DOCKER_ALLOCATOR_CONFIG = Symbol('DOCKER_ALLOCATOR_CONFIG')

export type DockerAllocatorConfig = {
  publicHost: string
  internalPort: number
  healthTimeoutMs: number
  healthPollIntervalMs: number
  stopTimeoutSeconds: number
  orphanMinAgeSeconds: number
  logsTailLines: number
  memoryBytes: number
  nanoCpus: number
  pidsLimit: number
  networkName: string
  testMode: 'normal' | 'hang-health' | 'exit-immediately'
}

export function createDockerAllocatorConfig(configService: ConfigService): DockerAllocatorConfig {
  return {
    publicHost: configService.get<string>('DOCKER_ALLOCATOR_PUBLIC_HOST') ?? 'localhost',
    internalPort: configService.get<number>('DOCKER_ALLOCATOR_INTERNAL_PORT') ?? 7777,
    healthTimeoutMs: configService.get<number>('DOCKER_ALLOCATOR_HEALTH_TIMEOUT_MS') ?? 20_000,
    healthPollIntervalMs: configService.get<number>('DOCKER_ALLOCATOR_HEALTH_POLL_INTERVAL_MS') ?? 500,
    stopTimeoutSeconds: configService.get<number>('DOCKER_ALLOCATOR_STOP_TIMEOUT_SECONDS') ?? 5,
    orphanMinAgeSeconds: configService.get<number>('DOCKER_ALLOCATOR_ORPHAN_MIN_AGE_SECONDS') ?? 30,
    logsTailLines: configService.get<number>('DOCKER_ALLOCATOR_LOG_TAIL_LINES') ?? 80,
    memoryBytes: configService.get<number>('DOCKER_ALLOCATOR_MEMORY_BYTES') ?? 268_435_456,
    nanoCpus: configService.get<number>('DOCKER_ALLOCATOR_NANO_CPUS') ?? 500_000_000,
    pidsLimit: configService.get<number>('DOCKER_ALLOCATOR_PIDS_LIMIT') ?? 128,
    networkName: configService.get<string>('GAME_SERVER_DOCKER_NETWORK') ?? 'game-center-game-servers',
    testMode: configService.get<'normal' | 'hang-health' | 'exit-immediately'>('DOCKER_ALLOCATOR_TEST_MODE') ?? 'normal',
  }
}

export function allocationContainerName(allocationId: string) {
  return `gc-game-${sanitizeNameSegment(allocationId)}`
}

export function buildDockerAllocationLabels(request: AllocationRequest) {
  return {
    'game-center.managed': 'true',
    'game-center.allocation-id': request.allocationId,
    'game-center.session-id': request.sessionId,
    'game-center.game-id': request.gameId,
    'game-center.game-version': request.gameVersion,
    'game-center.protocol-version': request.protocolVersion,
  }
}

export function buildDockerImageEnvKey(request: AllocationRequest) {
  return `DOCKER_ALLOCATOR_IMAGE_${normalizeEnvSegment(request.gameId)}_${normalizeEnvSegment(request.gameVersion)}_${normalizeEnvSegment(request.artifact.buildVersion)}`
}

export function resolveDockerImageReference(request: AllocationRequest) {
  const envKey = buildDockerImageEnvKey(request)
  const image = process.env[envKey]

  if (!image) {
    throw new AllocationProviderError(
      'ALLOCATION_PROVIDER_FAILED',
      `No Docker allocator image is configured for ${request.artifact.artifactId}. Expected environment variable ${envKey}.`,
    )
  }

  if (image.endsWith(':latest')) {
    throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Docker allocator images must not use the latest tag.')
  }

  if (!image.includes('@sha256:') && !/:[^/]+$/.test(image)) {
    throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Docker allocator images must use an explicit tag or digest.')
  }

  return image
}

function normalizeEnvSegment(value: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return normalized.length > 0 ? normalized.toUpperCase() : 'UNSPECIFIED'
}

function sanitizeNameSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9][^a-z0-9._-]*/g, '-').replace(/^-+|-+$/g, '')
}