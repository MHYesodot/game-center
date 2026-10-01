import { randomUUID } from 'node:crypto'

import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Pool } from 'pg'

import { SESSION_ALLOCATION_ORCHESTRATOR } from '../../boundaries/session-allocation-orchestrator.js'
import { ALLOCATION_PROVIDER_READINESS } from '../../boundaries/allocation-provider-readiness.js'
import { CLOCK } from '../../boundaries/clock.js'
import { ID_GENERATOR } from '../../boundaries/id-generator.js'
import { DATABASE_POOL } from '../../infrastructure/infrastructure.tokens.js'
import { CatalogAllocationArtifactQueryModule } from '../../module-bindings/catalog-allocation-artifact-query.module.js'
import { AllocationsService } from './application/allocations.service.js'
import {
  ALLOCATION_REPOSITORY,
  DEFAULT_ALLOCATION_PROVIDER,
  GAME_SERVER_ALLOCATOR_REGISTRY,
} from './application/allocations.ports.js'
import { createAllocationsDatabase, ALLOCATIONS_DRIZZLE_DB } from './infrastructure/persistence/allocation.persistence.js'
import { createDockerAllocatorConfig, DOCKER_ALLOCATOR_CONFIG } from './infrastructure/docker-allocator.config.js'
import { DockerAllocationCleanupService } from './infrastructure/docker-allocation-cleanup.service.js'
import { DockerGameServerAllocator } from './infrastructure/docker-game-server-allocator.js'
import { DockerAllocatorReadinessProbe } from './infrastructure/docker-allocator-readiness.probe.js'
import { DOCKER_RUNTIME_CLIENT } from './infrastructure/docker-runtime.client.js'
import { DockerodeRuntimeClient } from './infrastructure/dockerode-runtime.client.js'
import { PostgresAllocationRepository } from './infrastructure/persistence/repositories/postgres-allocation.repository.js'
import { StaticGameServerAllocatorRegistry } from './infrastructure/static-game-server-allocator.registry.js'
import { TestGameServerAllocator } from './infrastructure/test-game-server-allocator.js'
import { UnavailableGameServerAllocator } from './infrastructure/unavailable-game-server-allocator.js'

@Module({
  imports: [CatalogAllocationArtifactQueryModule],
  providers: [
    AllocationsService,
    PostgresAllocationRepository,
    UnavailableGameServerAllocator,
    TestGameServerAllocator,
    DockerodeRuntimeClient,
    DockerGameServerAllocator,
    DockerAllocationCleanupService,
    DockerAllocatorReadinessProbe,
    StaticGameServerAllocatorRegistry,
    {
      provide: CLOCK,
      useValue: {
        now: () => new Date(),
      },
    },
    {
      provide: ID_GENERATOR,
      useValue: {
        nextId: () => randomUUID(),
      },
    },
    {
      provide: ALLOCATIONS_DRIZZLE_DB,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => createAllocationsDatabase(pool),
    },
    {
      provide: DOCKER_ALLOCATOR_CONFIG,
      inject: [ConfigService],
      useFactory: createDockerAllocatorConfig,
    },
    {
      provide: DOCKER_RUNTIME_CLIENT,
      useExisting: DockerodeRuntimeClient,
    },
    {
      provide: ALLOCATION_REPOSITORY,
      useExisting: PostgresAllocationRepository,
    },
    {
      provide: GAME_SERVER_ALLOCATOR_REGISTRY,
      useExisting: StaticGameServerAllocatorRegistry,
    },
    {
      provide: DEFAULT_ALLOCATION_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.get<'unavailable' | 'test' | 'docker'>('ALLOCATION_PROVIDER') ?? 'unavailable',
    },
    {
      provide: ALLOCATION_PROVIDER_READINESS,
      useExisting: DockerAllocatorReadinessProbe,
    },
    {
      provide: SESSION_ALLOCATION_ORCHESTRATOR,
      useExisting: AllocationsService,
    },
  ],
  exports: [SESSION_ALLOCATION_ORCHESTRATOR, ALLOCATION_PROVIDER_READINESS, DockerAllocationCleanupService],
})
export class AllocationsModule {}