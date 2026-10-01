import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AllocationProviderReadiness } from '../../../boundaries/allocation-provider-readiness.js'
import { DOCKER_RUNTIME_CLIENT, type DockerRuntimeClient } from './docker-runtime.client.js'

@Injectable()
export class DockerAllocatorReadinessProbe implements AllocationProviderReadiness {
  readonly dependencyName = 'docker' as const

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(DOCKER_RUNTIME_CLIENT) private readonly dockerClient: DockerRuntimeClient,
  ) {}

  enabled() {
    return (this.configService.get<string>('ALLOCATION_PROVIDER') ?? 'unavailable') === 'docker'
  }

  async check(): Promise<void> {
    await this.dockerClient.ping()
  }
}