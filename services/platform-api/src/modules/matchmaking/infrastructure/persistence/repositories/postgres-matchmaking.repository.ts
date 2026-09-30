import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, inArray } from 'drizzle-orm'

import type {
  CreateMatchProposalInput,
  MatchmakingRepository,
  MatchmakingRepositoryTransaction,
} from '../../../application/matchmaking.ports.js'
import type {
  DurableMatchProposal,
  DurableMatchProposalAggregate,
  DurableMatchProposalMember,
  DurableMatchmakingRequest,
} from '../../../domain/queue-ticket.js'
import { MATCHMAKING_DRIZZLE_DB, type MatchmakingDrizzleDatabase } from '../matchmaking.persistence.js'
import { matchProposalMembers, matchProposals, matchmakingRequests } from '../schema/matchmaking.schema.js'

type MatchRequestRow = typeof matchmakingRequests.$inferSelect
type MatchProposalRow = typeof matchProposals.$inferSelect
type MatchProposalMemberRow = typeof matchProposalMembers.$inferSelect
type MatchmakingQueryExecutor = any

@Injectable()
export class PostgresMatchmakingRepository implements MatchmakingRepository {
  constructor(@Inject(MATCHMAKING_DRIZZLE_DB) private readonly db: MatchmakingDrizzleDatabase) {}

  async getRequestById(requestId: string): Promise<DurableMatchmakingRequest | null> {
    const rows = await this.db.select().from(matchmakingRequests).where(eq(matchmakingRequests.requestId, requestId)).limit(1)
    return rows[0] ? mapRequestRow(rows[0]) : null
  }

  async getProposalById(proposalId: string): Promise<DurableMatchProposalAggregate | null> {
    return findProposal(this.db, proposalId)
  }

  async getActiveRequestByRequester(requester: { type: string; id: string }): Promise<DurableMatchmakingRequest | null> {
    const rows = await this.db
      .select()
      .from(matchmakingRequests)
      .where(
        and(
          eq(matchmakingRequests.requesterType, requester.type),
          eq(matchmakingRequests.requesterId, requester.id),
          inArray(matchmakingRequests.status, ['queued', 'proposed']),
        ),
      )
      .orderBy(asc(matchmakingRequests.requestedAt))
      .limit(1)

    return rows[0] ? mapRequestRow(rows[0]) : null
  }

  async withTransaction<T>(callback: (transaction: MatchmakingRepositoryTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => callback(new PostgresMatchmakingRepositoryTransaction(transaction)))
  }
}

class PostgresMatchmakingRepositoryTransaction implements MatchmakingRepositoryTransaction {
  constructor(private readonly transaction: MatchmakingQueryExecutor) {}

  async getRequestById(requestId: string): Promise<DurableMatchmakingRequest | null> {
    const rows = await this.transaction.select().from(matchmakingRequests).where(eq(matchmakingRequests.requestId, requestId)).limit(1)
    return rows[0] ? mapRequestRow(rows[0]) : null
  }

  async getRequestByIdForUpdate(requestId: string): Promise<DurableMatchmakingRequest | null> {
    const rows = await this.transaction
      .select()
      .from(matchmakingRequests)
      .where(eq(matchmakingRequests.requestId, requestId))
      .for('update')
      .limit(1)

    return rows[0] ? mapRequestRow(rows[0]) : null
  }

  async getRequestsByIdsForUpdate(requestIds: string[]): Promise<DurableMatchmakingRequest[]> {
    if (requestIds.length === 0) {
      return []
    }

    const rows = await this.transaction
      .select()
      .from(matchmakingRequests)
      .where(inArray(matchmakingRequests.requestId, requestIds))
      .orderBy(asc(matchmakingRequests.requestedAt))
      .for('update')

    return rows.map(mapRequestRow)
  }

  async getActiveRequestByRequester(requester: { type: string; id: string }): Promise<DurableMatchmakingRequest | null> {
    const rows = await this.transaction
      .select()
      .from(matchmakingRequests)
      .where(
        and(
          eq(matchmakingRequests.requesterType, requester.type),
          eq(matchmakingRequests.requesterId, requester.id),
          inArray(matchmakingRequests.status, ['queued', 'proposed']),
        ),
      )
      .orderBy(asc(matchmakingRequests.requestedAt))
      .limit(1)

    return rows[0] ? mapRequestRow(rows[0]) : null
  }

  async getActiveRequestByRequesterForUpdate(requester: { type: string; id: string }): Promise<DurableMatchmakingRequest | null> {
    const rows = await this.transaction
      .select()
      .from(matchmakingRequests)
      .where(
        and(
          eq(matchmakingRequests.requesterType, requester.type),
          eq(matchmakingRequests.requesterId, requester.id),
          inArray(matchmakingRequests.status, ['queued', 'proposed']),
        ),
      )
      .orderBy(asc(matchmakingRequests.requestedAt))
      .for('update')
      .limit(1)

    return rows[0] ? mapRequestRow(rows[0]) : null
  }

  async createRequest(request: DurableMatchmakingRequest): Promise<void> {
    await this.transaction.insert(matchmakingRequests).values(mapRequestInsert(request))
  }

  async updateRequest(request: DurableMatchmakingRequest): Promise<void> {
    await this.transaction.update(matchmakingRequests).set(mapRequestInsert(request)).where(eq(matchmakingRequests.requestId, request.requestId))
  }

  async getProposalById(proposalId: string): Promise<DurableMatchProposalAggregate | null> {
    return findProposal(this.transaction, proposalId)
  }

  async getProposalByIdForUpdate(proposalId: string): Promise<DurableMatchProposalAggregate | null> {
    const proposalRows = await this.transaction
      .select({ proposalId: matchProposals.proposalId })
      .from(matchProposals)
      .where(eq(matchProposals.proposalId, proposalId))
      .for('update')

    if (proposalRows.length === 0) {
      return null
    }

    return this.getProposalById(proposalId)
  }

  async createProposal(proposal: CreateMatchProposalInput): Promise<void> {
    await this.transaction.insert(matchProposals).values(mapProposalInsert(proposal))
    await this.transaction.insert(matchProposalMembers).values(proposal.members.map(mapProposalMemberInsert))
  }

  async updateProposal(proposal: DurableMatchProposal): Promise<void> {
    await this.transaction.update(matchProposals).set(mapProposalInsert(proposal)).where(eq(matchProposals.proposalId, proposal.proposalId))
  }

  async updateProposalMember(member: DurableMatchProposalMember): Promise<void> {
    await this.transaction
      .update(matchProposalMembers)
      .set(mapProposalMemberInsert(member))
      .where(and(eq(matchProposalMembers.proposalId, member.proposalId), eq(matchProposalMembers.requestId, member.requestId)))
  }
}

async function findProposal(executor: MatchmakingQueryExecutor, proposalId: string): Promise<DurableMatchProposalAggregate | null> {
  const rows = await executor
    .select({
      proposal: matchProposals,
      member: matchProposalMembers,
    })
    .from(matchProposals)
    .leftJoin(matchProposalMembers, eq(matchProposals.proposalId, matchProposalMembers.proposalId))
    .where(eq(matchProposals.proposalId, proposalId))
    .orderBy(asc(matchProposalMembers.id))

  if (rows.length === 0) {
    return null
  }

  return mapProposalRows(
    rows.map((row: { proposal: MatchProposalRow; member: MatchProposalMemberRow | null }) => ({
      proposal: row.proposal,
      member: row.member,
    })),
  )
}

function mapRequestRow(row: MatchRequestRow): DurableMatchmakingRequest {
  return {
    requestId: row.requestId,
    requesterType: row.requesterType as DurableMatchmakingRequest['requesterType'],
    requesterId: row.requesterId,
    gameId: row.gameId,
    queueKey: row.queueKey,
    queueType: row.queueType as DurableMatchmakingRequest['queueType'],
    platform: row.platform as DurableMatchmakingRequest['platform'],
    region: row.region,
    gameVersion: row.gameVersion,
    protocolVersion: row.protocolVersion,
    status: row.status as DurableMatchmakingRequest['status'],
    requestedAt: row.requestedAt,
    cancelledAt: row.cancelledAt,
    matchedAt: row.matchedAt,
    expiresAt: row.expiresAt,
    terminalOutcome: row.terminalOutcome as DurableMatchmakingRequest['terminalOutcome'],
    sourceLobbyId: row.sourceLobbyId,
    activeProposalId: row.activeProposalId,
  }
}

function mapProposalRows(rows: Array<{ proposal: MatchProposalRow; member: MatchProposalMemberRow | null }>): DurableMatchProposalAggregate {
  const [first] = rows
  return {
    proposalId: first.proposal.proposalId,
    matchId: first.proposal.matchId,
    queueKey: first.proposal.queueKey,
    gameId: first.proposal.gameId,
    queueType: first.proposal.queueType as DurableMatchProposal['queueType'],
    platform: first.proposal.platform as DurableMatchProposal['platform'],
    region: first.proposal.region,
    gameVersion: first.proposal.gameVersion,
    protocolVersion: first.proposal.protocolVersion,
    status: first.proposal.status as DurableMatchProposal['status'],
    createdAt: first.proposal.createdAt,
    expiresAt: first.proposal.expiresAt,
    matchedAt: first.proposal.matchedAt,
    resolvedAt: first.proposal.resolvedAt,
    members: rows
      .map((row) => row.member)
      .filter((member): member is MatchProposalMemberRow => member !== null)
      .map((member) => ({
        proposalId: member.proposalId,
        requestId: member.requestId,
        playerId: member.playerId,
        acceptanceStatus: member.acceptanceStatus as DurableMatchProposalMember['acceptanceStatus'],
        respondedAt: member.respondedAt,
      })),
  }
}

function mapRequestInsert(request: DurableMatchmakingRequest) {
  return {
    requestId: request.requestId,
    requesterType: request.requesterType,
    requesterId: request.requesterId,
    gameId: request.gameId,
    queueKey: request.queueKey,
    queueType: request.queueType,
    platform: request.platform,
    region: request.region,
    gameVersion: request.gameVersion,
    protocolVersion: request.protocolVersion,
    status: request.status,
    requestedAt: request.requestedAt,
    cancelledAt: request.cancelledAt,
    matchedAt: request.matchedAt,
    expiresAt: request.expiresAt,
    terminalOutcome: request.terminalOutcome,
    sourceLobbyId: request.sourceLobbyId,
    activeProposalId: request.activeProposalId,
  }
}

function mapProposalInsert(proposal: DurableMatchProposal) {
  return {
    proposalId: proposal.proposalId,
    matchId: proposal.matchId,
    queueKey: proposal.queueKey,
    gameId: proposal.gameId,
    queueType: proposal.queueType,
    platform: proposal.platform,
    region: proposal.region,
    gameVersion: proposal.gameVersion,
    protocolVersion: proposal.protocolVersion,
    status: proposal.status,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
    matchedAt: proposal.matchedAt,
    resolvedAt: proposal.resolvedAt,
  }
}

function mapProposalMemberInsert(member: DurableMatchProposalMember) {
  return {
    proposalId: member.proposalId,
    requestId: member.requestId,
    playerId: member.playerId,
    acceptanceStatus: member.acceptanceStatus,
    respondedAt: member.respondedAt,
  }
}