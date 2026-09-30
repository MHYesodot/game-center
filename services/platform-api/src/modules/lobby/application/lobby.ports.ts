import type { LobbyConfiguration, LobbyMemberRuntimeState, LobbyRuntimeState } from '@game-center/contracts'

import type { DurableLobbyAggregate, DurableLobbyMemberRecord, DurableLobbyRecord } from '../domain/lobby-record.js'

export const LOBBY_REPOSITORY = Symbol('LOBBY_REPOSITORY')
export const LOBBY_RUNTIME_STORE = Symbol('LOBBY_RUNTIME_STORE')

export type CreateLobbyRecordInput = DurableLobbyRecord & {
  ownerMembership: DurableLobbyMemberRecord
}

export interface LobbyRepositoryTransaction {
  getById(lobbyId: string): Promise<DurableLobbyAggregate | null>
  getByIdForUpdate(lobbyId: string): Promise<DurableLobbyAggregate | null>
  createLobby(input: CreateLobbyRecordInput): Promise<void>
  addMember(member: DurableLobbyMemberRecord): Promise<void>
  markMemberLeft(lobbyId: string, playerId: string, leftAt: string): Promise<void>
  updateMemberRole(lobbyId: string, playerId: string, role: DurableLobbyMemberRecord['role']): Promise<void>
  updateLobby(lobby: DurableLobbyRecord): Promise<void>
}

export interface LobbyRepository {
  getById(lobbyId: string): Promise<DurableLobbyAggregate | null>
  withTransaction<T>(callback: (transaction: LobbyRepositoryTransaction) => Promise<T>): Promise<T>
}

export interface LobbyRuntimeStore {
  getRuntimeState(lobbyId: string, activePlayerIds: string[]): Promise<LobbyRuntimeState>
  markConnected(lobbyId: string, playerId: string, at: string): Promise<void>
  markDisconnected(lobbyId: string, playerId: string, at: string, reconnectDeadlineAt: string): Promise<void>
  setReadyState(lobbyId: string, playerId: string, ready: boolean, at: string): Promise<void>
  removeMember(lobbyId: string, playerId: string): Promise<void>
  clearReadyState(lobbyId: string): Promise<void>
  clearLobbyRuntime(lobbyId: string): Promise<void>
}

export function buildUnavailableRuntimeState(activePlayerIds: string[]): LobbyRuntimeState {
  const members: LobbyMemberRuntimeState[] = activePlayerIds.map((playerId) => ({
    playerId,
    connectionState: 'disconnected',
    ready: false,
    lastSeenAt: null,
    reconnectDeadlineAt: null,
  }))

  return {
    available: false,
    connectedMemberCount: 0,
    allMembersReady: false,
    readyMemberIds: [],
    members,
  }
}

export function isOpaqueLobbyConfiguration(value: LobbyConfiguration): boolean {
  return Object.keys(value.settings).length <= 32 && JSON.stringify(value).length <= 2_048
}