import { setTimeout as delay } from 'node:timers/promises'

import { Inject, Injectable } from '@nestjs/common'
import type { AllocationRequest, ProviderAllocationResult } from '@game-center/contracts'

import { AllocationProviderError } from '../application/allocations.errors.js'
import type { GameServerAllocator } from '../application/allocations.ports.js'
import {
  allocationContainerName,
  buildDockerAllocationLabels,
  type DockerAllocatorConfig,
  DOCKER_ALLOCATOR_CONFIG,
  resolveDockerImageReference,
} from './docker-allocator.config.js'
import {
  type DockerRuntimeClient,
  type DockerRuntimeContainer,
  DOCKER_RUNTIME_CLIENT,
} from './docker-runtime.client.js'

@Injectable()
export class DockerGameServerAllocator implements GameServerAllocator {
  constructor(
    @Inject(DOCKER_RUNTIME_CLIENT) private readonly dockerClient: DockerRuntimeClient,
    @Inject(DOCKER_ALLOCATOR_CONFIG) private readonly config: DockerAllocatorConfig,
  ) {}

  async allocate(request: AllocationRequest): Promise<ProviderAllocationResult> {
    const containerName = allocationContainerName(request.allocationId)

    try {
      await this.dockerClient.ping()
      await this.dockerClient.ensureNetwork(this.config.networkName)

      let container = await this.dockerClient.findManagedContainer({
        allocationId: request.allocationId,
        name: containerName,
      })

      if (!container) {
        container = await this.createManagedContainer(request, containerName)
      }

      if (container.state === 'created') {
        await this.startContainer(container.id, request)
        const started = await this.dockerClient.inspectContainer(container.id)

        if (!started) {
          throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Managed Docker game server disappeared after start.')
        }

        container = started
      }

      return this.waitForReady(request, container)
    } catch (error) {
      throw this.mapDockerError(error)
    }
  }

  async getAllocation(reference: { allocationId: string; providerReference: string | null }): Promise<ProviderAllocationResult | null> {
    try {
      await this.dockerClient.ping()
      const container = await this.findContainer(reference)

      if (!container) {
        return null
      }

      return this.toProviderResult(reference.allocationId, container)
    } catch (error) {
      throw this.mapDockerError(error)
    }
  }

  async release(reference: { allocationId: string; providerReference: string | null }): Promise<void> {
    try {
      await this.dockerClient.ping()
      const container = await this.findContainer(reference)

      if (!container) {
        return
      }

      this.logDockerEvent('docker_allocation_release_started', {
        allocationId: reference.allocationId,
        containerId: container.id,
        sessionId: container.labels['game-center.session-id'] ?? null,
        gameId: container.labels['game-center.game-id'] ?? null,
      })

      if (container.state === 'running' || container.state === 'paused' || container.state === 'restarting') {
        await this.stopIgnoringMissing(container.id)
      }

      await this.removeIgnoringMissing(container.id)

      this.logDockerEvent('docker_allocation_released', {
        allocationId: reference.allocationId,
        containerId: container.id,
        sessionId: container.labels['game-center.session-id'] ?? null,
        gameId: container.labels['game-center.game-id'] ?? null,
      })
    } catch (error) {
      throw this.mapDockerError(error, 'ALLOCATION_PROVIDER_FAILED', 'Docker release failed.')
    }
  }

  private async createManagedContainer(request: AllocationRequest, containerName: string) {
    const image = resolveDockerImageReference(request)

    try {
      const container = await this.dockerClient.createContainer({
        name: containerName,
        image,
        labels: buildDockerAllocationLabels(request),
        env: {
          SESSION_ID: request.sessionId,
          ALLOCATION_ID: request.allocationId,
          GAME_ID: request.gameId,
          GAME_VERSION: request.gameVersion,
          PROTOCOL_VERSION: request.protocolVersion,
          PORT: String(this.config.internalPort),
          TEST_MODE: this.config.testMode,
        },
        networkName: this.config.networkName,
        internalPort: this.config.internalPort,
        memoryBytes: this.config.memoryBytes,
        nanoCpus: this.config.nanoCpus,
        pidsLimit: this.config.pidsLimit,
        stopTimeoutSeconds: this.config.stopTimeoutSeconds,
      })

      this.logDockerEvent('docker_allocation_container_created', {
        allocationId: request.allocationId,
        containerId: container.id,
        sessionId: request.sessionId,
        gameId: request.gameId,
      })

      return container
    } catch (error) {
      if (isConflictError(error)) {
        const existing = await this.findContainerAfterConflict(request.allocationId, containerName)

        if (existing) {
          return existing
        }
      }

      throw error
    }
  }

  private async startContainer(containerId: string, request: AllocationRequest) {
    try {
      await this.dockerClient.startContainer(containerId)
    } catch (error) {
      if (!isAlreadyStartedError(error)) {
        throw error
      }
    }

    this.logDockerEvent('docker_allocation_container_started', {
      allocationId: request.allocationId,
      containerId,
      sessionId: request.sessionId,
      gameId: request.gameId,
    })
  }

  private async waitForReady(request: AllocationRequest, initialContainer: DockerRuntimeContainer): Promise<ProviderAllocationResult> {
    const deadline = Date.now() + this.config.healthTimeoutMs
    let current = initialContainer

    for (;;) {
      const currentState = await this.toProviderState(request, current)

      if (currentState.status === 'ready') {
        this.logDockerEvent('docker_allocation_health_ready', {
          allocationId: request.allocationId,
          containerId: current.id,
          sessionId: request.sessionId,
          gameId: request.gameId,
        })
        return currentState.result
      }

      if (currentState.status === 'failed') {
        await this.captureFailureLogs(request, current, currentState.message)
        await this.removeIgnoringMissing(current.id)
        this.logDockerEvent('docker_allocation_health_failed', {
          allocationId: request.allocationId,
          containerId: current.id,
          sessionId: request.sessionId,
          gameId: request.gameId,
          reason: currentState.message,
        })
        throw new AllocationProviderError(currentState.failureCode, currentState.message)
      }

      if (Date.now() >= deadline) {
        await this.captureFailureLogs(request, current, 'Managed Docker game server did not become healthy before the configured timeout.')
        await this.removeIgnoringMissing(current.id)
        throw new AllocationProviderError('ALLOCATION_TIMEOUT', 'Managed Docker game server did not become healthy before the configured timeout.')
      }

      await delay(this.config.healthPollIntervalMs)

      const refreshed = await this.findContainer({
        allocationId: request.allocationId,
        providerReference: current.id,
      })

      if (!refreshed) {
        throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Managed Docker game server disappeared during provisioning.')
      }

      current = refreshed
    }
  }

  private async toProviderState(request: AllocationRequest, container: DockerRuntimeContainer) {
    if (container.state === 'running' && container.health === 'healthy') {
      return {
        status: 'ready' as const,
        result: this.buildReadyResult(request, container),
      }
    }

    if (container.state === 'created' || container.state === 'running' || container.state === 'restarting' || container.state === 'removing') {
      return {
        status: 'provisioning' as const,
      }
    }

    this.logDockerEvent('docker_allocation_container_exited', {
      allocationId: request.allocationId,
      containerId: container.id,
      sessionId: request.sessionId,
      gameId: request.gameId,
      exitCode: container.exitCode,
    })

    return {
      status: 'failed' as const,
      failureCode: 'ALLOCATION_PROVIDER_FAILED' as const,
      message: `Managed Docker game server exited before becoming ready. State=${container.state} exitCode=${container.exitCode ?? 'unknown'}`,
    }
  }

  private buildReadyResult(request: AllocationRequest, container: DockerRuntimeContainer): ProviderAllocationResult {
    const publishedPort = container.portBindings.find(
      (binding) => binding.containerPort === this.config.internalPort && binding.protocol === 'tcp',
    )

    if (!publishedPort) {
      throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Managed Docker game server is healthy but has no published TCP port.')
    }

    return {
      providerReference: container.id,
      status: 'ready',
      connection: {
        transport: 'tcp',
        host: this.config.publicHost,
        port: publishedPort.hostPort,
        secure: false,
        protocolVersion: request.protocolVersion,
        tokenReference: null,
        expiresAt: null,
      },
    }
  }

  private async toProviderResult(allocationId: string, container: DockerRuntimeContainer): Promise<ProviderAllocationResult> {
    if (container.state === 'running' && container.health === 'healthy') {
      return {
        providerReference: container.id,
        status: 'ready',
        connection: {
          transport: 'tcp',
          host: this.config.publicHost,
          port: this.requirePublishedPort(container),
          secure: false,
          protocolVersion: container.labels['game-center.protocol-version'] ?? 'v1',
          tokenReference: null,
          expiresAt: null,
        },
      }
    }

    if (container.state === 'created' || container.state === 'running' || container.state === 'restarting' || container.state === 'removing') {
      return {
        providerReference: container.id,
        status: 'provisioning',
        connection: null,
      }
    }

    throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', `Managed Docker game server is not runnable. State=${container.state}`)
  }

  private requirePublishedPort(container: DockerRuntimeContainer) {
    const publishedPort = container.portBindings.find(
      (binding) => binding.containerPort === this.config.internalPort && binding.protocol === 'tcp',
    )

    if (!publishedPort) {
      throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Managed Docker game server is missing a published host port.')
    }

    return publishedPort.hostPort
  }

  private async findContainer(reference: { allocationId: string; providerReference: string | null }) {
    if (reference.providerReference) {
      const direct = await this.dockerClient.inspectContainer(reference.providerReference)

      if (direct?.labels['game-center.managed'] === 'true' && direct.labels['game-center.allocation-id'] === reference.allocationId) {
        return direct
      }
    }

    return this.dockerClient.findManagedContainer({
      allocationId: reference.allocationId,
      name: allocationContainerName(reference.allocationId),
    })
  }

  private async captureFailureLogs(request: AllocationRequest, container: DockerRuntimeContainer, reason: string) {
    try {
      const rawLogs = await this.dockerClient.getLogs(container.id, this.config.logsTailLines)
      const logPreview = rawLogs.slice(0, 4000)

      this.logDockerEvent('docker_allocation_health_failed', {
        allocationId: request.allocationId,
        containerId: container.id,
        sessionId: request.sessionId,
        gameId: request.gameId,
        reason,
        logPreview,
      })
    } catch {
      this.logDockerEvent('docker_allocation_health_failed', {
        allocationId: request.allocationId,
        containerId: container.id,
        sessionId: request.sessionId,
        gameId: request.gameId,
        reason,
      })
    }
  }

  private async findContainerAfterConflict(allocationId: string, containerName: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await this.dockerClient.findManagedContainer({
        allocationId,
        name: containerName,
      })

      if (existing) {
        return existing
      }

      await delay(100)
    }

    return null
  }

  private async stopIgnoringMissing(containerId: string) {
    try {
      await this.dockerClient.stopContainer(containerId, this.config.stopTimeoutSeconds)
    } catch (error) {
      if (!isMissingError(error)) {
        throw error
      }
    }
  }

  private async removeIgnoringMissing(containerId: string) {
    try {
      await this.dockerClient.removeContainer(containerId, true)
    } catch (error) {
      if (!isMissingError(error)) {
        throw error
      }
    }
  }

  private mapDockerError(error: unknown, fallbackCode: 'ALLOCATION_PROVIDER_FAILED' | 'ALLOCATION_PROVIDER_UNAVAILABLE' = 'ALLOCATION_PROVIDER_FAILED', fallbackMessage?: string) {
    if (error instanceof AllocationProviderError) {
      return error
    }

    if (isDockerUnavailableError(error)) {
      return new AllocationProviderError('ALLOCATION_PROVIDER_UNAVAILABLE', 'Docker daemon is unavailable for the DEV allocator.')
    }

    if (isImageMissingError(error)) {
      return new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Configured Docker image could not be found.')
    }

    return new AllocationProviderError(fallbackCode, fallbackMessage ?? 'Docker allocator operation failed.')
  }

  private logDockerEvent(event: string, details: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'log',
        context: 'DockerGameServerAllocator',
        event,
        ...details,
      }),
    )
  }
}

function isConflictError(error: unknown) {
  return isDockerStatusCode(error, 409)
}

function isMissingError(error: unknown) {
  return isDockerStatusCode(error, 404)
}

function isImageMissingError(error: unknown) {
  return isDockerStatusCode(error, 404)
}

function isDockerUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return ['ECONNREFUSED', 'ENOENT', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND'].includes((error as Error & { code?: string }).code ?? '')
}

function isDockerStatusCode(error: unknown, statusCode: number) {
  return typeof error === 'object' && error !== null && 'statusCode' in error && (error as { statusCode?: number }).statusCode === statusCode
}

function isAlreadyStartedError(error: unknown) {
  if (isDockerStatusCode(error, 304)) {
    return true
  }

  return error instanceof Error && error.message.toLowerCase().includes('already started')
}