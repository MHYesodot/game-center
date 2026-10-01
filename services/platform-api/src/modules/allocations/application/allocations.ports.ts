import type { AllocationProvider, AllocationRequest, ProviderAllocationResult } from '@game-center/contracts'

import type { DurableGameServerAllocation } from '../domain/game-server-allocation.js'

export const ALLOCATION_REPOSITORY = Symbol('ALLOCATION_REPOSITORY')
export const GAME_SERVER_ALLOCATOR_REGISTRY = Symbol('GAME_SERVER_ALLOCATOR_REGISTRY')
export const DEFAULT_ALLOCATION_PROVIDER = Symbol('DEFAULT_ALLOCATION_PROVIDER')

export type CreateAllocationRecordInput = DurableGameServerAllocation

export interface AllocationRepositoryTransaction {
  getById(allocationId: string): Promise<DurableGameServerAllocation | null>
  getByIdForUpdate(allocationId: string): Promise<DurableGameServerAllocation | null>
  getLatestBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null>
  getActiveBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null>
  getActiveBySessionIdForUpdate(sessionId: string): Promise<DurableGameServerAllocation | null>
  createAllocation(input: CreateAllocationRecordInput): Promise<void>
  updateAllocation(allocation: DurableGameServerAllocation): Promise<void>
}

export interface AllocationRepository {
  getById(allocationId: string): Promise<DurableGameServerAllocation | null>
  getLatestBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null>
  getActiveBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null>
  withTransaction<T>(callback: (transaction: AllocationRepositoryTransaction) => Promise<T>): Promise<T>
}

export interface GameServerAllocator {
  allocate(request: AllocationRequest): Promise<ProviderAllocationResult>
  getAllocation(reference: { allocationId: string; providerReference: string | null }): Promise<ProviderAllocationResult | null>
  release(reference: { allocationId: string; providerReference: string | null }): Promise<void>
}

export interface GameServerAllocatorRegistry {
  get(provider: AllocationProvider): GameServerAllocator
}