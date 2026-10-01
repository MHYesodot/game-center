import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray } from 'drizzle-orm'

import type {
  AllocationRepository,
  AllocationRepositoryTransaction,
  CreateAllocationRecordInput,
} from '../../../application/allocations.ports.js'
import type { DurableGameServerAllocation } from '../../../domain/game-server-allocation.js'
import { ALLOCATIONS_DRIZZLE_DB, type AllocationsDrizzleDatabase } from '../allocation.persistence.js'
import { gameServerAllocations } from '../schema/allocation.schema.js'

type AllocationRow = typeof gameServerAllocations.$inferSelect
type AllocationsQueryExecutor = any

const activeStatuses: DurableGameServerAllocation['status'][] = ['requested', 'provisioning', 'ready', 'releasing']

@Injectable()
export class PostgresAllocationRepository implements AllocationRepository {
  constructor(@Inject(ALLOCATIONS_DRIZZLE_DB) private readonly db: AllocationsDrizzleDatabase) {}

  async getById(allocationId: string): Promise<DurableGameServerAllocation | null> {
    return findOneBy(this.db, eq(gameServerAllocations.allocationId, allocationId))
  }

  async getLatestBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null> {
    return findLatestBySessionId(this.db, sessionId)
  }

  async getActiveBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null> {
    return findOneBy(this.db, and(eq(gameServerAllocations.sessionId, sessionId), inArray(gameServerAllocations.status, activeStatuses)))
  }

  async withTransaction<T>(callback: (transaction: AllocationRepositoryTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => callback(new PostgresAllocationRepositoryTransaction(transaction)))
  }
}

class PostgresAllocationRepositoryTransaction implements AllocationRepositoryTransaction {
  constructor(private readonly transaction: AllocationsQueryExecutor) {}

  async getById(allocationId: string): Promise<DurableGameServerAllocation | null> {
    return findOneBy(this.transaction, eq(gameServerAllocations.allocationId, allocationId))
  }

  async getByIdForUpdate(allocationId: string): Promise<DurableGameServerAllocation | null> {
    const rows = await this.transaction
      .select({ allocationId: gameServerAllocations.allocationId })
      .from(gameServerAllocations)
      .where(eq(gameServerAllocations.allocationId, allocationId))
      .for('update')
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    return this.getById(allocationId)
  }

  async getLatestBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null> {
    return findLatestBySessionId(this.transaction, sessionId)
  }

  async getActiveBySessionId(sessionId: string): Promise<DurableGameServerAllocation | null> {
    return findOneBy(this.transaction, and(eq(gameServerAllocations.sessionId, sessionId), inArray(gameServerAllocations.status, activeStatuses)))
  }

  async getActiveBySessionIdForUpdate(sessionId: string): Promise<DurableGameServerAllocation | null> {
    const rows = await this.transaction
      .select({ allocationId: gameServerAllocations.allocationId })
      .from(gameServerAllocations)
      .where(and(eq(gameServerAllocations.sessionId, sessionId), inArray(gameServerAllocations.status, activeStatuses)))
      .for('update')
      .limit(1)

    if (rows.length === 0) {
      return null
    }

    return this.getById(rows[0].allocationId)
  }

  async createAllocation(input: CreateAllocationRecordInput): Promise<void> {
    await this.transaction.insert(gameServerAllocations).values(mapAllocationInsert(input))
  }

  async updateAllocation(allocation: DurableGameServerAllocation): Promise<void> {
    await this.transaction
      .update(gameServerAllocations)
      .set(mapAllocationInsert(allocation))
      .where(eq(gameServerAllocations.allocationId, allocation.allocationId))
  }
}

async function findOneBy(executor: AllocationsQueryExecutor, whereClause: ReturnType<typeof eq> | ReturnType<typeof and>) {
  const rows = await executor.select().from(gameServerAllocations).where(whereClause).limit(1)
  return rows[0] ? mapAllocationRow(rows[0] as AllocationRow) : null
}

async function findLatestBySessionId(executor: AllocationsQueryExecutor, sessionId: string) {
  const rows = await executor
    .select()
    .from(gameServerAllocations)
    .where(eq(gameServerAllocations.sessionId, sessionId))
    .orderBy(desc(gameServerAllocations.requestedAt), desc(gameServerAllocations.allocationId))
    .limit(1)

  return rows[0] ? mapAllocationRow(rows[0] as AllocationRow) : null
}

function mapAllocationRow(row: AllocationRow): DurableGameServerAllocation {
  return {
    allocationId: row.allocationId,
    sessionId: row.sessionId,
    provider: row.provider as DurableGameServerAllocation['provider'],
    providerReference: row.providerReference,
    status: row.status as DurableGameServerAllocation['status'],
    gameId: row.gameId,
    gameVersion: row.gameVersion,
    protocolVersion: row.protocolVersion,
    buildVersion: row.buildVersion,
    serverType: row.serverType as DurableGameServerAllocation['serverType'],
    runtimeType: row.runtimeType as DurableGameServerAllocation['runtimeType'],
    runtimeProfile: row.runtimeProfile,
    region: row.region,
    participantCapacity: row.participantCapacity,
    requestedAt: row.requestedAt,
    provisioningAt: row.provisioningAt,
    readyAt: row.readyAt,
    failedAt: row.failedAt,
    releasingAt: row.releasingAt,
    releasedAt: row.releasedAt,
    expiresAt: row.expiresAt,
    failureCode: row.failureCode as DurableGameServerAllocation['failureCode'],
    connection:
      row.connectionTransport && row.connectionHost && row.connectionPort !== null && row.connectionSecure !== null
        ? {
            transport: row.connectionTransport as NonNullable<DurableGameServerAllocation['connection']>['transport'],
            host: row.connectionHost,
            port: row.connectionPort,
            secure: row.connectionSecure,
            protocolVersion: row.connectionProtocolVersion ?? row.protocolVersion,
            tokenReference: row.connectionTokenReference,
            expiresAt: row.connectionExpiresAt,
          }
        : null,
  }
}

function mapAllocationInsert(allocation: DurableGameServerAllocation) {
  return {
    allocationId: allocation.allocationId,
    sessionId: allocation.sessionId,
    provider: allocation.provider,
    providerReference: allocation.providerReference,
    status: allocation.status,
    gameId: allocation.gameId,
    gameVersion: allocation.gameVersion,
    protocolVersion: allocation.protocolVersion,
    buildVersion: allocation.buildVersion,
    serverType: allocation.serverType,
    runtimeType: allocation.runtimeType,
    runtimeProfile: allocation.runtimeProfile,
    region: allocation.region,
    participantCapacity: allocation.participantCapacity,
    requestedAt: allocation.requestedAt,
    provisioningAt: allocation.provisioningAt,
    readyAt: allocation.readyAt,
    failedAt: allocation.failedAt,
    releasingAt: allocation.releasingAt,
    releasedAt: allocation.releasedAt,
    expiresAt: allocation.expiresAt,
    failureCode: allocation.failureCode,
    connectionTransport: allocation.connection?.transport ?? null,
    connectionHost: allocation.connection?.host ?? null,
    connectionPort: allocation.connection?.port ?? null,
    connectionSecure: allocation.connection?.secure ?? null,
    connectionProtocolVersion: allocation.connection?.protocolVersion ?? null,
    connectionTokenReference: allocation.connection?.tokenReference ?? null,
    connectionExpiresAt: allocation.connection?.expiresAt ?? null,
  }
}