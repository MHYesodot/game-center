import { Injectable } from '@nestjs/common'
import Docker, { type DockerOptions } from 'dockerode'

import {
  type DockerRuntimeClient,
  type DockerRuntimeContainer,
  type DockerRuntimeContainerState,
  type DockerRuntimeCreateContainerInput,
  DOCKER_RUNTIME_CLIENT,
} from './docker-runtime.client.js'

@Injectable()
export class DockerodeRuntimeClient implements DockerRuntimeClient {
  readonly [DOCKER_RUNTIME_CLIENT] = true

  private readonly docker = new Docker(resolveDockerConnectionOptions())

  async ping(): Promise<void> {
    await this.docker.ping()
  }

  async ensureNetwork(name: string): Promise<void> {
    try {
      await this.docker.createNetwork({ Name: name, CheckDuplicate: true })
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return
      }

      throw error
    }
  }

  async inspectContainer(idOrName: string): Promise<DockerRuntimeContainer | null> {
    try {
      const details = await this.docker.getContainer(idOrName).inspect()
      return normalizeContainer(details)
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }

      throw error
    }
  }

  async findManagedContainer(input: { allocationId: string; name: string }): Promise<DockerRuntimeContainer | null> {
    const byName = await this.inspectContainer(input.name)

    if (byName?.labels['game-center.managed'] === 'true' && byName.labels['game-center.allocation-id'] === input.allocationId) {
      return byName
    }

    const summaries = await this.docker.listContainers({
      all: true,
      filters: {
        label: ['game-center.managed=true', `game-center.allocation-id=${input.allocationId}`],
      },
    })

    const matches = (
      await Promise.all(
        summaries.map(async (summary) => this.inspectContainer(summary.Id)),
      )
    ).filter((container): container is DockerRuntimeContainer => container !== null)

    if (matches.length === 0) {
      return null
    }

    matches.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    return matches[0]
  }

  async createContainer(input: DockerRuntimeCreateContainerInput): Promise<DockerRuntimeContainer> {
    const environment = Object.entries(input.env).map(([key, value]) => `${key}=${value}`)
    const container = await this.docker.createContainer({
      name: input.name,
      Image: input.image,
      Labels: input.labels,
      Env: environment,
      ExposedPorts: {
        [`${input.internalPort}/tcp`]: {},
      },
      HostConfig: {
        AutoRemove: false,
        NetworkMode: input.networkName,
        PortBindings: {
          [`${input.internalPort}/tcp`]: [{ HostPort: '' }],
        },
        Memory: input.memoryBytes,
        NanoCpus: input.nanoCpus,
        PidsLimit: input.pidsLimit,
        ReadonlyRootfs: input.readOnlyRootFilesystem ?? false,
      },
      StopTimeout: input.stopTimeoutSeconds,
      User: input.user ?? undefined,
      NetworkingConfig: {
        EndpointsConfig: {
          [input.networkName]: {},
        },
      },
    })

    const created = await this.inspectContainer(container.id)

    if (!created) {
      throw new Error(`Container ${container.id} was created but could not be inspected.`)
    }

    return created
  }

  async startContainer(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).start()
  }

  async stopContainer(containerId: string, timeoutSeconds: number): Promise<void> {
    await this.docker.getContainer(containerId).stop({ t: timeoutSeconds })
  }

  async removeContainer(containerId: string, force: boolean): Promise<void> {
    await this.docker.getContainer(containerId).remove({ force })
  }

  async getLogs(containerId: string, tail: number): Promise<string> {
    const logs = await this.docker.getContainer(containerId).logs({
      stdout: true,
      stderr: true,
      tail,
    })

    return Buffer.isBuffer(logs) ? logs.toString('utf8') : String(logs)
  }

  async listManagedContainers(): Promise<DockerRuntimeContainer[]> {
    const summaries = await this.docker.listContainers({
      all: true,
      filters: {
        label: ['game-center.managed=true'],
      },
    })

    return (
      await Promise.all(summaries.map(async (summary) => this.inspectContainer(summary.Id)))
    ).filter((container): container is DockerRuntimeContainer => container !== null)
  }
}

function normalizeContainer(details: any): DockerRuntimeContainer {
  const state = (details.State?.Status ?? 'unknown') as DockerRuntimeContainerState
  const labels = (details.Config?.Labels ?? {}) as Record<string, string>
  const portBindings = Object.entries(details.NetworkSettings?.Ports ?? {}).flatMap(([key, values]) => {
    const [containerPortText, protocolText] = key.split('/')
    const containerPort = Number(containerPortText)
    const protocol: 'tcp' | 'udp' = protocolText === 'udp' ? 'udp' : 'tcp'

    if (!Array.isArray(values)) {
      return []
    }

    return values
      .map((value) => Number(value?.HostPort))
      .filter((hostPort) => Number.isInteger(hostPort) && hostPort > 0)
      .map((hostPort) => ({ containerPort, hostPort, protocol }))
  })

  return {
    id: details.Id as string,
    name: String(details.Name ?? '').replace(/^\//, ''),
    image: String(details.Config?.Image ?? ''),
    labels,
    state,
    health: (details.State?.Health?.Status ?? null) as DockerRuntimeContainer['health'],
    exitCode: typeof details.State?.ExitCode === 'number' ? details.State.ExitCode : null,
    createdAt: String(details.Created ?? ''),
    startedAt: details.State?.StartedAt ? String(details.State.StartedAt) : null,
    finishedAt: details.State?.FinishedAt ? String(details.State.FinishedAt) : null,
    portBindings,
  }
}

function resolveDockerConnectionOptions(): DockerOptions {
  const dockerHost = process.env.DOCKER_HOST

  if (!dockerHost) {
    return process.platform === 'win32' ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' }
  }

  if (dockerHost.startsWith('unix://')) {
    return { socketPath: dockerHost.slice('unix://'.length) }
  }

  if (dockerHost.startsWith('npipe://')) {
    return { socketPath: dockerHost.slice('npipe://'.length).replace(/\//g, '\\') }
  }

  if (dockerHost.startsWith('tcp://')) {
    const url = new URL(dockerHost.replace('tcp://', 'http://'))
    return {
      host: url.hostname,
      port: Number(url.port || '2375'),
      protocol: (url.protocol.replace(':', '') as 'http' | 'https' | 'ssh'),
    }
  }

  return process.platform === 'win32' ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' }
}

function isAlreadyExistsError(error: unknown) {
  return isDockerStatusCode(error, 409)
}

function isNotFoundError(error: unknown) {
  return isDockerStatusCode(error, 404)
}

function isDockerStatusCode(error: unknown, statusCode: number) {
  return typeof error === 'object' && error !== null && 'statusCode' in error && (error as { statusCode?: number }).statusCode === statusCode
}