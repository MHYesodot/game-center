import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, isNull } from 'drizzle-orm'

import type { CreateLobbyRecordInput, LobbyRepository, LobbyRepositoryTransaction } from '../../../application/lobby.ports.js'
import type { DurableLobbyAggregate, DurableLobbyMemberRecord, DurableLobbyRecord } from '../../../domain/lobby-record.js'
import { LOBBY_DRIZZLE_DB, type LobbyDrizzleDatabase } from '../lobby.persistence.js'
import { lobbies, lobbyMembers } from '../schema/lobby.schema.js'

type LobbyMemberRow = typeof lobbyMembers.$inferSelect
type LobbyRow = typeof lobbies.$inferSelect
type LobbyQueryExecutor = any

@Injectable()
export class PostgresLobbyRepository implements LobbyRepository {
  constructor(@Inject(LOBBY_DRIZZLE_DB) private readonly db: LobbyDrizzleDatabase) {}

  async getById(lobbyId: string): Promise<DurableLobbyAggregate | null> {
    return this.findLobby(this.db, lobbyId)
  }

  async withTransaction<T>(callback: (transaction: LobbyRepositoryTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => callback(new PostgresLobbyRepositoryTransaction(transaction)))
  }

  private async findLobby(executor: LobbyQueryExecutor, lobbyId: string) {
    const rows = await executor
      .select({
        lobby: lobbies,
        member: lobbyMembers,
      })
      .from(lobbies)
      .leftJoin(lobbyMembers, eq(lobbies.lobbyId, lobbyMembers.lobbyId))
      .where(eq(lobbies.lobbyId, lobbyId))
      .orderBy(asc(lobbyMembers.joinedAt))

    if (rows.length === 0) {
      return null
    }

    return mapRowsToAggregate(rows.map((row: { lobby: LobbyRow; member: LobbyMemberRow | null }) => ({ lobby: row.lobby, member: row.member })))
  }
}

class PostgresLobbyRepositoryTransaction implements LobbyRepositoryTransaction {
  constructor(private readonly transaction: LobbyQueryExecutor) {}

  async getById(lobbyId: string): Promise<DurableLobbyAggregate | null> {
    const rows = await this.transaction
      .select({
        lobby: lobbies,
        member: lobbyMembers,
      })
      .from(lobbies)
      .leftJoin(lobbyMembers, eq(lobbies.lobbyId, lobbyMembers.lobbyId))
      .where(eq(lobbies.lobbyId, lobbyId))
      .orderBy(asc(lobbyMembers.joinedAt))

    if (rows.length === 0) {
      return null
    }

    return mapRowsToAggregate(rows.map((row: { lobby: LobbyRow; member: LobbyMemberRow | null }) => ({ lobby: row.lobby, member: row.member })))
  }

  async getByIdForUpdate(lobbyId: string): Promise<DurableLobbyAggregate | null> {
    const lobbyRows = await this.transaction
      .select({ lobbyId: lobbies.lobbyId })
      .from(lobbies)
      .where(eq(lobbies.lobbyId, lobbyId))
      .for('update')

    if (lobbyRows.length === 0) {
      return null
    }

    return this.getById(lobbyId)
  }

  async createLobby(input: CreateLobbyRecordInput): Promise<void> {
    await this.transaction.insert(lobbies).values(mapLobbyToInsert(input))
    await this.transaction.insert(lobbyMembers).values(mapMemberToInsert(input.ownerMembership))
  }

  async addMember(member: DurableLobbyMemberRecord): Promise<void> {
    await this.transaction.insert(lobbyMembers).values(mapMemberToInsert(member))
  }

  async markMemberLeft(lobbyId: string, playerId: string, leftAt: string): Promise<void> {
    await this.transaction
      .update(lobbyMembers)
      .set({ leftAt })
      .where(and(eq(lobbyMembers.lobbyId, lobbyId), eq(lobbyMembers.playerId, playerId), isNull(lobbyMembers.leftAt)))
  }

  async updateMemberRole(lobbyId: string, playerId: string, role: DurableLobbyMemberRecord['role']): Promise<void> {
    await this.transaction
      .update(lobbyMembers)
      .set({ role })
      .where(and(eq(lobbyMembers.lobbyId, lobbyId), eq(lobbyMembers.playerId, playerId), isNull(lobbyMembers.leftAt)))
  }

  async updateLobby(lobby: DurableLobbyRecord): Promise<void> {
    await this.transaction.update(lobbies).set(mapLobbyToInsert(lobby)).where(eq(lobbies.lobbyId, lobby.lobbyId))
  }
}

function mapRowsToAggregate(rows: Array<{ lobby: LobbyRow; member: LobbyMemberRow | null }>): DurableLobbyAggregate {
  const [firstRow] = rows
  const members = rows
    .map((row) => row.member)
    .filter((member): member is LobbyMemberRow => member !== null)
    .map((member) => ({
      lobbyId: member.lobbyId,
      playerId: member.playerId,
      role: member.role as DurableLobbyMemberRecord['role'],
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
    }))

  return {
    lobbyId: firstRow.lobby.lobbyId,
    gameId: firstRow.lobby.gameId,
    ownerPlayerId: firstRow.lobby.ownerPlayerId,
    status: firstRow.lobby.status as DurableLobbyRecord['status'],
    visibility: firstRow.lobby.visibility as DurableLobbyRecord['visibility'],
    capacity: firstRow.lobby.capacity,
    minimumPlayers: firstRow.lobby.minimumPlayers,
    configuration: firstRow.lobby.configuration,
    joinCodeHash: firstRow.lobby.joinCodeHash,
    createdAt: firstRow.lobby.createdAt,
    updatedAt: firstRow.lobby.updatedAt,
    closedAt: firstRow.lobby.closedAt,
    expiresAt: firstRow.lobby.expiresAt,
    members,
  }
}

function mapLobbyToInsert(lobby: DurableLobbyRecord) {
  return {
    lobbyId: lobby.lobbyId,
    gameId: lobby.gameId,
    ownerPlayerId: lobby.ownerPlayerId,
    status: lobby.status,
    visibility: lobby.visibility,
    capacity: lobby.capacity,
    minimumPlayers: lobby.minimumPlayers,
    configuration: lobby.configuration,
    joinCodeHash: lobby.joinCodeHash,
    createdAt: lobby.createdAt,
    updatedAt: lobby.updatedAt,
    closedAt: lobby.closedAt,
    expiresAt: lobby.expiresAt,
  }
}

function mapMemberToInsert(member: DurableLobbyMemberRecord) {
  return {
    lobbyId: member.lobbyId,
    playerId: member.playerId,
    role: member.role,
    joinedAt: member.joinedAt,
    leftAt: member.leftAt,
  }
}