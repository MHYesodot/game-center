import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import type { AllocationFailureCode, AllocationRequest, GameServerAllocation, ProviderAllocationResult } from '@game-center/contracts'

import {
  CATALOG_ALLOCATION_ARTIFACT_QUERY,
  type CatalogAllocationArtifactQuery,
} from '../../../boundaries/catalog-allocation-artifact-query.js'
import {
  SessionAllocationError,
  type SessionAllocationCommand,
  type SessionAllocationOrchestrator,
} from '../../../boundaries/session-allocation-orchestrator.js'
import { type Clock, CLOCK } from '../../../boundaries/clock.js'
import { type IdGenerator, ID_GENERATOR } from '../../../boundaries/id-generator.js'
import { isPostgresDependencyError, logDependencyDown } from '../../../infrastructure/dependency-health.js'
import {
  canReleaseAllocation,
  canTransitionAllocation,
  isAllocationTerminal,
  materializeAllocationStatus,
  type DurableGameServerAllocation,
} from '../domain/game-server-allocation.js'
import { AllocationProviderError } from './allocations.errors.js'
import {
  ALLOCATION_REPOSITORY,
  DEFAULT_ALLOCATION_PROVIDER,
  GAME_SERVER_ALLOCATOR_REGISTRY,
  type AllocationRepository,
  type GameServerAllocatorRegistry,
} from './allocations.ports.js'

@Injectable()
export class AllocationsService implements SessionAllocationOrchestrator {
  constructor(
    @Inject(ALLOCATION_REPOSITORY) private readonly allocationRepository: AllocationRepository,
    @Inject(GAME_SERVER_ALLOCATOR_REGISTRY) private readonly allocatorRegistry: GameServerAllocatorRegistry,
    @Inject(DEFAULT_ALLOCATION_PROVIDER) private readonly defaultProvider: DurableGameServerAllocation['provider'],
    @Inject(CATALOG_ALLOCATION_ARTIFACT_QUERY) private readonly catalogArtifactQuery: CatalogAllocationArtifactQuery,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async requestAllocation(input: SessionAllocationCommand): Promise<GameServerAllocation> {
    const allocation = await this.insertOrReuseRequestedAllocation(input)
    const current = await this.reconcileAllocationOnAccess(await this.materializeExpiryOnAccess(allocation))

    if (current.status === 'ready') {
      return this.composeAllocation(current)
    }

    if (current.status === 'failed') {
      throw new SessionAllocationError('ALLOCATION_FAILED')
    }

    if (current.status === 'expired') {
      throw new SessionAllocationError('ALLOCATION_FAILED')
    }

    const claimed = await this.claimProvisioning(current.allocationId)

    if (claimed.status === 'ready') {
      return this.composeAllocation(claimed.allocation)
    }

    const provider = this.allocatorRegistry.get(claimed.allocation.provider)

    try {
      const providerResult =
        claimed.claimed
          ? await provider.allocate(this.toAllocationRequest(claimed.allocation))
          : claimed.allocation.status === 'provisioning'
          ?
              (await provider.getAllocation({
                allocationId: claimed.allocation.allocationId,
                providerReference: claimed.allocation.providerReference,
              })) ?? (await provider.allocate(this.toAllocationRequest(claimed.allocation)))
          : await provider.allocate(this.toAllocationRequest(claimed.allocation))

      const updated = await this.persistProviderResult(claimed.allocation.allocationId, providerResult)
      return this.composeAllocation(updated)
    } catch (error) {
      if (error instanceof SessionAllocationError) {
        throw error
      }

      if (this.isAvailabilityError(error)) {
        this.logAllocationEvent('allocation_reconciliation_failed', {
          allocationId: claimed.allocation.allocationId,
          sessionId: claimed.allocation.sessionId,
          provider: claimed.allocation.provider,
        })
        throw new SessionAllocationError('ALLOCATION_UNAVAILABLE')
      }

      const failureCode = error instanceof AllocationProviderError ? error.failureCode : 'ALLOCATION_PROVIDER_FAILED'
      const failed = await this.markFailed(claimed.allocation.allocationId, failureCode)

      this.logAllocationEvent('allocation_failed', {
        allocationId: failed.allocationId,
        sessionId: failed.sessionId,
        provider: failed.provider,
        failureCode,
      })

      throw new SessionAllocationError('ALLOCATION_FAILED')
    }
  }

  async getAllocation(sessionId: string): Promise<GameServerAllocation | null> {
    const allocation = await this.allocationRepository.getLatestBySessionId(sessionId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!allocation) {
      return null
    }

    return this.composeAllocation(await this.reconcileAllocationOnAccess(await this.materializeExpiryOnAccess(allocation)))
  }

  async releaseAllocation(sessionId: string): Promise<GameServerAllocation | null> {
    const current = await this.allocationRepository.getLatestBySessionId(sessionId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!current) {
      return null
    }

    const allocation = await this.materializeExpiryOnAccess(current)

    if (allocation.status === 'released') {
      return this.composeAllocation(allocation)
    }

    if (!canReleaseAllocation(allocation.status)) {
      throw new SessionAllocationError('ALLOCATION_INVALID_STATE')
    }

    const releasing = await this.transitionToReleasing(allocation)
    const provider = this.allocatorRegistry.get(releasing.provider)

    this.logAllocationEvent('allocation_release_requested', {
      allocationId: releasing.allocationId,
      sessionId: releasing.sessionId,
      provider: releasing.provider,
    })

    try {
      await provider.release({
        allocationId: releasing.allocationId,
        providerReference: releasing.providerReference,
      })
    } catch (error) {
      if (this.isAvailabilityError(error)) {
        throw new SessionAllocationError('ALLOCATION_UNAVAILABLE')
      }

      throw new SessionAllocationError('ALLOCATION_FAILED')
    }

    const released = await this.markReleased(releasing.allocationId)

    this.logAllocationEvent('allocation_released', {
      allocationId: released.allocationId,
      sessionId: released.sessionId,
      provider: released.provider,
    })

    return this.composeAllocation(released)
  }

  private async insertOrReuseRequestedAllocation(input: SessionAllocationCommand) {
    const artifact = await this.catalogArtifactQuery.getGameServerArtifact(input.gameId).catch((error) => {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.SERVICE_UNAVAILABLE) {
        throw new SessionAllocationError('ALLOCATION_UNAVAILABLE')
      }

      throw error
    })

    if (!artifact || artifact.gameVersion !== input.gameVersion || artifact.protocolVersion !== input.protocolVersion) {
      throw new SessionAllocationError('ALLOCATION_UNAVAILABLE')
    }

    const created: DurableGameServerAllocation = {
      allocationId: this.idGenerator.nextId(),
      sessionId: input.sessionId,
      provider: this.defaultProvider,
      providerReference: null,
      status: 'requested',
      gameId: input.gameId,
      gameVersion: input.gameVersion,
      protocolVersion: input.protocolVersion,
      buildVersion: artifact.buildVersion,
      serverType: artifact.serverType,
      runtimeType: artifact.runtimeType,
      runtimeProfile: toRuntimeProfile(artifact.serverType),
      region: input.region,
      participantCapacity: input.participantCapacity,
      requestedAt: input.requestedAt,
      provisioningAt: null,
      readyAt: null,
      failedAt: null,
      releasingAt: null,
      releasedAt: null,
      expiresAt: input.expiresAt,
      failureCode: null,
      connection: null,
    }

    try {
      return await this.allocationRepository.withTransaction(async (transaction) => {
        const existing = await transaction.getActiveBySessionIdForUpdate(input.sessionId)

        if (existing) {
          return existing
        }

        await transaction.createAllocation(created)
        this.logAllocationEvent('allocation_requested', {
          allocationId: created.allocationId,
          sessionId: created.sessionId,
          matchId: input.matchId,
          provider: created.provider,
        })
        return created
      })
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existing = await this.allocationRepository.getActiveBySessionId(input.sessionId).catch((lookupError) => {
          this.handlePostgresError(lookupError)
          throw lookupError
        })

        if (existing) {
          return existing
        }
      }

      if (error instanceof SessionAllocationError) {
        throw error
      }

      this.handlePostgresError(error)
      throw error
    }
  }

  private async persistProviderResult(allocationId: string, result: ProviderAllocationResult) {
    if (result.status === 'ready' && !result.connection) {
      throw new AllocationProviderError('ALLOCATION_PROVIDER_FAILED', 'Provider returned ready without a connection descriptor')
    }

    return this.allocationRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(allocationId)

      if (!current) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      if (current.status === 'ready') {
        return current
      }

      if (isAllocationTerminal(current.status)) {
        return current
      }

      if (!canTransitionAllocation(current.status, result.status)) {
        throw new SessionAllocationError('ALLOCATION_INVALID_STATE')
      }

      const now = this.clock.now().toISOString()
      const updated: DurableGameServerAllocation = {
        ...current,
        providerReference: result.providerReference ?? current.providerReference,
        status: result.status,
        provisioningAt: current.provisioningAt ?? now,
        readyAt: result.status === 'ready' ? now : current.readyAt,
        failedAt: null,
        releasingAt: null,
        releasedAt: null,
        failureCode: null,
        connection: result.status === 'ready' ? result.connection : null,
      }

      await transaction.updateAllocation(updated)

      this.logAllocationEvent(result.status === 'ready' ? 'allocation_ready' : 'allocation_provisioning', {
        allocationId: updated.allocationId,
        sessionId: updated.sessionId,
        provider: updated.provider,
      })

      return updated
    }).catch((error) => {
      if (error instanceof SessionAllocationError) {
        throw error
      }

      this.handlePostgresError(error)
      throw new SessionAllocationError('ALLOCATION_UNAVAILABLE')
    })
  }

  private async claimProvisioning(allocationId: string): Promise<{ allocation: DurableGameServerAllocation; claimed: boolean; status: DurableGameServerAllocation['status'] }> {
    return this.allocationRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(allocationId)

      if (!current) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      if (current.status === 'ready') {
        return { allocation: current, claimed: false, status: current.status }
      }

      if (current.status === 'provisioning') {
        return { allocation: current, claimed: false, status: current.status }
      }

      if (current.status !== 'requested') {
        return { allocation: current, claimed: false, status: current.status }
      }

      const updated: DurableGameServerAllocation = {
        ...current,
        status: 'provisioning',
        provisioningAt: current.provisioningAt ?? this.clock.now().toISOString(),
      }

      await transaction.updateAllocation(updated)

      this.logAllocationEvent('allocation_provisioning', {
        allocationId: updated.allocationId,
        sessionId: updated.sessionId,
        provider: updated.provider,
      })

      return { allocation: updated, claimed: true, status: updated.status }
    }).catch((error) => {
      if (error instanceof SessionAllocationError) {
        throw error
      }

      this.handlePostgresError(error)
      throw error
    })
  }

  private async materializeExpiryOnAccess(allocation: DurableGameServerAllocation) {
    const now = this.clock.now().toISOString()
    if (materializeAllocationStatus(allocation, now) !== 'expired') {
      return allocation
    }

    return this.allocationRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(allocation.allocationId)

      if (!current) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      if (materializeAllocationStatus(current, now) !== 'expired') {
        return current
      }

      const updated: DurableGameServerAllocation = {
        ...current,
        status: 'expired',
        failureCode: current.failureCode ?? 'ALLOCATION_TIMEOUT',
      }

      await transaction.updateAllocation(updated)
      return updated
    }).catch((error) => {
      if (error instanceof SessionAllocationError) {
        throw error
      }

      this.handlePostgresError(error)
      throw error
    })
  }

  private async reconcileAllocationOnAccess(allocation: DurableGameServerAllocation) {
    if (allocation.status !== 'provisioning' && allocation.status !== 'ready') {
      return allocation
    }

    const provider = this.allocatorRegistry.get(allocation.provider)

    try {
      const result = await provider.getAllocation({
        allocationId: allocation.allocationId,
        providerReference: allocation.providerReference,
      })

      if (!result) {
        if (allocation.status === 'provisioning') {
          return allocation
        }

        return this.markFailed(allocation.allocationId, 'ALLOCATION_PROVIDER_FAILED')
      }

      if (allocation.status === 'ready' && result.status === 'ready') {
        return allocation
      }

      return this.persistProviderResult(allocation.allocationId, result)
    } catch (error) {
      if (this.isAvailabilityError(error)) {
        throw new SessionAllocationError('ALLOCATION_UNAVAILABLE')
      }

      const failureCode = error instanceof AllocationProviderError ? error.failureCode : 'ALLOCATION_PROVIDER_FAILED'
      return this.markFailed(allocation.allocationId, failureCode)
    }
  }

  private async markFailed(allocationId: string, failureCode: AllocationFailureCode) {
    return this.allocationRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(allocationId)

      if (!current) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      if (current.status === 'failed') {
        return current
      }

      const updated: DurableGameServerAllocation = {
        ...current,
        status: 'failed',
        failedAt: this.clock.now().toISOString(),
        failureCode,
        connection: null,
      }

      await transaction.updateAllocation(updated)
      return updated
    }).catch((error) => {
      if (error instanceof SessionAllocationError) {
        throw error
      }

      this.handlePostgresError(error)
      throw error
    })
  }

  private async transitionToReleasing(allocation: DurableGameServerAllocation) {
    if (allocation.status === 'releasing' || allocation.status === 'released') {
      return allocation
    }

    return this.allocationRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(allocation.allocationId)

      if (!current) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      if (current.status === 'releasing' || current.status === 'released') {
        return current
      }

      if (!canTransitionAllocation(current.status, 'releasing')) {
        throw new SessionAllocationError('ALLOCATION_INVALID_STATE')
      }

      const updated: DurableGameServerAllocation = {
        ...current,
        status: 'releasing',
        releasingAt: this.clock.now().toISOString(),
      }

      await transaction.updateAllocation(updated)
      return updated
    }).catch((error) => {
      if (error instanceof SessionAllocationError) {
        throw error
      }

      this.handlePostgresError(error)
      throw error
    })
  }

  private async markReleased(allocationId: string) {
    return this.allocationRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(allocationId)

      if (!current) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      if (current.status === 'released') {
        return current
      }

      if (!canTransitionAllocation(current.status, 'released')) {
        throw new SessionAllocationError('ALLOCATION_INVALID_STATE')
      }

      const updated: DurableGameServerAllocation = {
        ...current,
        status: 'released',
        releasedAt: this.clock.now().toISOString(),
        connection: null,
      }

      await transaction.updateAllocation(updated)
      return updated
    }).catch((error) => {
      if (error instanceof SessionAllocationError) {
        throw error
      }

      this.handlePostgresError(error)
      throw error
    })
  }

  private toAllocationRequest(allocation: DurableGameServerAllocation): AllocationRequest {
    return {
      allocationId: allocation.allocationId,
      sessionId: allocation.sessionId,
      gameId: allocation.gameId,
      gameVersion: allocation.gameVersion,
      protocolVersion: allocation.protocolVersion,
      requestedAt: allocation.requestedAt,
      artifact: {
        artifactId: `${allocation.gameId}:${allocation.gameVersion}:${allocation.buildVersion}`,
        gameId: allocation.gameId,
        gameVersion: allocation.gameVersion,
        protocolVersion: allocation.protocolVersion,
        buildVersion: allocation.buildVersion,
        serverType: allocation.serverType,
        runtimeType: allocation.runtimeType,
      },
      runtimeRequirements: {
        runtimeProfile: allocation.runtimeProfile,
        region: allocation.region,
        participantCapacity: allocation.participantCapacity,
      },
    }
  }

  private composeAllocation(allocation: DurableGameServerAllocation): GameServerAllocation {
    return {
      allocationId: allocation.allocationId,
      sessionId: allocation.sessionId,
      provider: allocation.provider,
      providerReference: allocation.providerReference,
      status: allocation.status,
      artifact: {
        artifactId: `${allocation.gameId}:${allocation.gameVersion}:${allocation.buildVersion}`,
        gameId: allocation.gameId,
        gameVersion: allocation.gameVersion,
        protocolVersion: allocation.protocolVersion,
        buildVersion: allocation.buildVersion,
        serverType: allocation.serverType,
        runtimeType: allocation.runtimeType,
      },
      runtimeRequirements: {
        runtimeProfile: allocation.runtimeProfile,
        region: allocation.region,
        participantCapacity: allocation.participantCapacity,
      },
      connection: allocation.connection,
      requestedAt: allocation.requestedAt,
      provisioningAt: allocation.provisioningAt,
      readyAt: allocation.readyAt,
      failedAt: allocation.failedAt,
      releasingAt: allocation.releasingAt,
      releasedAt: allocation.releasedAt,
      expiresAt: allocation.expiresAt,
      failureCode: allocation.failureCode,
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof Error) && (!error || typeof error !== 'object')) {
      return false
    }

    const candidate = error as { code?: string; cause?: unknown }
    if (candidate.code === '23505') {
      return true
    }

    return candidate.cause ? this.isUniqueViolation(candidate.cause) : false
  }

  private isAvailabilityError(error: unknown) {
    if (error instanceof SessionAllocationError && error.code === 'ALLOCATION_UNAVAILABLE') {
      return true
    }

    if (error instanceof HttpException && error.getStatus() === HttpStatus.SERVICE_UNAVAILABLE) {
      return true
    }

    return isPostgresDependencyError(error)
  }

  private handlePostgresError(error: unknown) {
    if (isPostgresDependencyError(error)) {
      logDependencyDown('postgres', error, 'AllocationsService')
      throw new SessionAllocationError('ALLOCATION_UNAVAILABLE')
    }
  }

  private logAllocationEvent(event: string, details: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        timestamp: this.clock.now().toISOString(),
        level: 'log',
        context: 'AllocationsService',
        event,
        ...details,
      }),
    )
  }
}

function toRuntimeProfile(serverType: DurableGameServerAllocation['serverType']) {
  return serverType === 'dedicated' ? 'dedicated-server' : serverType === 'shared' ? 'shared-runtime' : 'no-server'
}