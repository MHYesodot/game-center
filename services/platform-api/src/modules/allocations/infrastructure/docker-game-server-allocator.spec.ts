import { describe, expect, it } from 'vitest'

import type { AllocationRequest } from '@game-center/contracts'

import { DockerGameServerAllocator } from './docker-game-server-allocator.js'
import type { DockerAllocatorConfig } from './docker-allocator.config.js'
import type { DockerRuntimeClient, DockerRuntimeContainer, DockerRuntimeCreateContainerInput } from './docker-runtime.client.js'

describe('DockerGameServerAllocator', () => {
  it('reuses the conflict winner when concurrent create races resolve to the same logical container', async () => {
    const runtimeClient = new FakeDockerRuntimeClient({ conflictOnCreate: true })
    const allocator = new DockerGameServerAllocator(runtimeClient, buildConfig())

    const result = await allocator.allocate(buildRequest())

    expect(result).toMatchObject({
      providerReference: 'container-1',
      status: 'ready',
      connection: {
        host: '127.0.0.1',
        port: 39001,
        transport: 'tcp',
      },
    })
    expect(runtimeClient.createCalls).toBe(1)
  })

  it('treats repeated release as idempotent when the managed container is already missing', async () => {
    const runtimeClient = new FakeDockerRuntimeClient()
    const allocator = new DockerGameServerAllocator(runtimeClient, buildConfig())

    await allocator.release({ allocationId: 'allocation-1', providerReference: null })

    expect(runtimeClient.removeCalls).toBe(0)
  })
})

class FakeDockerRuntimeClient implements DockerRuntimeClient {
  createCalls = 0
  removeCalls = 0
  private readonly containers = new Map<string, DockerRuntimeContainer>()

  constructor(private readonly options: { conflictOnCreate?: boolean } = {}) {}

  async ping(): Promise<void> {}

  async ensureNetwork(): Promise<void> {}

  async inspectContainer(idOrName: string): Promise<DockerRuntimeContainer | null> {
    return this.containers.get(idOrName) ?? [...this.containers.values()].find((container) => container.name === idOrName) ?? null
  }

  async findManagedContainer(input: { allocationId: string; name: string }): Promise<DockerRuntimeContainer | null> {
    return (
      [...this.containers.values()].find(
        (container) =>
          container.labels['game-center.allocation-id'] === input.allocationId &&
          container.labels['game-center.managed'] === 'true' &&
          container.name === input.name,
      ) ?? null
    )
  }

  async createContainer(input: DockerRuntimeCreateContainerInput): Promise<DockerRuntimeContainer> {
    this.createCalls += 1

    if (this.options.conflictOnCreate) {
      this.options.conflictOnCreate = false
      this.containers.set('container-1', buildContainer(input.name, input.image, input.labels))
      throw Object.assign(new Error('conflict'), { statusCode: 409 })
    }

    const created = buildContainer(input.name, input.image, input.labels)
    this.containers.set(created.id, created)
    return created
  }

  async startContainer(containerId: string): Promise<void> {
    const current = this.containers.get(containerId)

    if (current) {
      this.containers.set(containerId, {
        ...current,
        state: 'running',
        health: 'healthy',
      })
    }
  }

  async stopContainer(): Promise<void> {}

  async removeContainer(containerId: string): Promise<void> {
    this.removeCalls += 1
    this.containers.delete(containerId)
  }

  async getLogs(): Promise<string> {
    return 'ok'
  }

  async listManagedContainers(): Promise<DockerRuntimeContainer[]> {
    return [...this.containers.values()]
  }
}

function buildContainer(name: string, image: string, labels: Record<string, string>): DockerRuntimeContainer {
  return {
    id: 'container-1',
    name,
    image,
    labels,
    state: 'running',
    health: 'healthy',
    exitCode: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    startedAt: '2026-10-01T10:00:01.000Z',
    finishedAt: null,
    portBindings: [{ containerPort: 7777, hostPort: 39001, protocol: 'tcp' }],
  }
}

function buildConfig(): DockerAllocatorConfig {
  return {
    publicHost: '127.0.0.1',
    internalPort: 7777,
    healthTimeoutMs: 1_000,
    healthPollIntervalMs: 10,
    stopTimeoutSeconds: 5,
    orphanMinAgeSeconds: 30,
    logsTailLines: 80,
    memoryBytes: 268_435_456,
    nanoCpus: 500_000_000,
    pidsLimit: 128,
    networkName: 'game-center-game-servers',
    testMode: 'normal',
  }
}

function buildRequest(): AllocationRequest {
  process.env.DOCKER_ALLOCATOR_IMAGE_SIGNAL_GRID_0_1_0_PROTOTYPE_PROTOTYPE = 'game-center/test-game-server:p03'

  return {
    allocationId: 'allocation-1',
    sessionId: 'session-1',
    gameId: 'signal-grid',
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    requestedAt: '2026-10-01T10:00:00.000Z',
    artifact: {
      artifactId: 'signal-grid:0.1.0-prototype:prototype',
      gameId: 'signal-grid',
      gameVersion: '0.1.0-prototype',
      protocolVersion: 'v1',
      buildVersion: 'prototype',
      serverType: 'dedicated',
      runtimeType: 'external',
    },
    runtimeRequirements: {
      runtimeProfile: 'dedicated-server',
      region: null,
      participantCapacity: 2,
    },
  }
}