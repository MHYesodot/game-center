import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'

import { ALLOCATIONS_DRIZZLE_DB, type AllocationsDrizzleDatabase } from './persistence/allocation.persistence.js'
import { gameServerAllocations } from './persistence/schema/allocation.schema.js'
import {
  type DockerAllocatorConfig,
  DOCKER_ALLOCATOR_CONFIG,
} from './docker-allocator.config.js'
import {
  DOCKER_RUNTIME_CLIENT,
  type DockerRuntimeClient,
} from './docker-runtime.client.js'

const activeStatuses = ['requested', 'provisioning', 'ready', 'releasing'] as const

@Injectable()
export class DockerAllocationCleanupService {
  constructor(
    @Inject(DOCKER_RUNTIME_CLIENT) private readonly dockerClient: DockerRuntimeClient,
    @Inject(DOCKER_ALLOCATOR_CONFIG) private readonly config: DockerAllocatorConfig,
    @Inject(ALLOCATIONS_DRIZZLE_DB) private readonly db: AllocationsDrizzleDatabase,
  ) {}

  async cleanupOrphanedContainers(options: { dryRun?: boolean } = {}) {
    const dryRun = options.dryRun ?? false
    const containers = await this.dockerClient.listManagedContainers()
    const now = Date.now()
    const requiredLabelCandidates = containers.filter((container) => hasRequiredLabels(container.labels))
    const eligible = requiredLabelCandidates.filter((container) => {
      const createdAt = new Date(container.createdAt).getTime()
      return Number.isFinite(createdAt) && now - createdAt >= this.config.orphanMinAgeSeconds * 1000
    })
    const allocationIds = [...new Set(eligible.map((container) => container.labels['game-center.allocation-id']))]

    const activeAllocations =
      allocationIds.length === 0
        ? []
        : await this.db
            .select({ allocationId: gameServerAllocations.allocationId })
            .from(gameServerAllocations)
            .where(
              and(
                eq(gameServerAllocations.provider, 'docker'),
                inArray(gameServerAllocations.status, [...activeStatuses]),
                inArray(gameServerAllocations.allocationId, allocationIds),
              ),
            )

    const activeAllocationIds = new Set(activeAllocations.map((row) => row.allocationId))
    const orphaned = eligible.filter((container) => !activeAllocationIds.has(container.labels['game-center.allocation-id']))

    let removed = 0

    for (const container of orphaned) {
      if (!dryRun) {
        await this.dockerClient.removeContainer(container.id, true)
        removed += 1
      }

      this.logCleanupEvent('docker_allocation_orphan_removed', {
        dryRun,
        allocationId: container.labels['game-center.allocation-id'],
        containerId: container.id,
        sessionId: container.labels['game-center.session-id'],
        gameId: container.labels['game-center.game-id'],
      })
    }

    return {
      dryRun,
      inspectedManagedContainers: containers.length,
      eligibleManagedContainers: eligible.length,
      orphanedManagedContainers: orphaned.length,
      removedManagedContainers: removed,
      preservedActiveManagedContainers: eligible.length - orphaned.length,
      preservedYoungManagedContainers: requiredLabelCandidates.length - eligible.length,
    }
  }

  private logCleanupEvent(event: string, details: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'log',
        context: 'DockerAllocationCleanupService',
        event,
        ...details,
      }),
    )
  }
}

function hasRequiredLabels(labels: Record<string, string>) {
  return (
    labels['game-center.managed'] === 'true' &&
    typeof labels['game-center.allocation-id'] === 'string' &&
    typeof labels['game-center.session-id'] === 'string' &&
    typeof labels['game-center.game-id'] === 'string'
  )
}