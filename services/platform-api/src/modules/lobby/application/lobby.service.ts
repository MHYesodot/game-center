import { createHash } from 'node:crypto'

import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import type {
  CreateLobbyRequest,
  JoinLobbyRequest,
  LobbyDetails,
  LobbyErrorCode,
  LobbyRuntimeState,
  SetLobbyReadyRequest,
} from '@game-center/contracts'

import { type CatalogQueryService, CATALOG_QUERY_SERVICE } from '../../../boundaries/catalog-query.js'
import { type Clock, CLOCK } from '../../../boundaries/clock.js'
import { type IdGenerator, ID_GENERATOR } from '../../../boundaries/id-generator.js'
import { isPostgresDependencyError, isRedisDependencyError, logDependencyDown } from '../../../infrastructure/dependency-health.js'
import {
  buildUnavailableRuntimeState,
  isOpaqueLobbyConfiguration,
  LOBBY_REPOSITORY,
  LOBBY_RUNTIME_STORE,
  type LobbyRepository,
  type LobbyRepositoryTransaction,
  type LobbyRuntimeStore,
} from './lobby.ports.js'
import {
  getActiveLobbyMembers,
  getActiveMember,
  getActiveMemberCount,
  getAvailableSeats,
  getDeterministicOwnerSuccessor,
  isLobbyExpired,
  isReadyCapableState,
  LOBBY_EXPIRY_WINDOW_MS,
  materializeLobbyStatus,
  MAX_LOBBY_CAPACITY,
  type DurableLobbyAggregate,
  type DurableLobbyMemberRecord,
  type DurableLobbyRecord,
} from '../domain/lobby-record.js'
import type { LobbyRequestIdentity } from './lobby.identity.js'

@Injectable()
export class LobbyService {
  constructor(
    @Inject(LOBBY_REPOSITORY) private readonly lobbyRepository: LobbyRepository,
    @Inject(LOBBY_RUNTIME_STORE) private readonly lobbyRuntimeStore: LobbyRuntimeStore,
    @Inject(CATALOG_QUERY_SERVICE) private readonly catalogQueryService: CatalogQueryService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async createLobby(identity: LobbyRequestIdentity, request: CreateLobbyRequest): Promise<LobbyDetails> {
    const now = this.clock.now().toISOString()

    if (request.minimumPlayers > request.capacity) {
      this.throwLobbyError('INVALID_GAME_CONFIGURATION', HttpStatus.BAD_REQUEST)
    }

    if (request.capacity > MAX_LOBBY_CAPACITY || !isOpaqueLobbyConfiguration(request.configuration)) {
      this.throwLobbyError('INVALID_GAME_CONFIGURATION', HttpStatus.BAD_REQUEST)
    }

    if (request.visibility === 'private' && !request.joinCode) {
      this.throwLobbyError('INVALID_JOIN_CODE', HttpStatus.BAD_REQUEST)
    }

    const game = await this.getCompatibleGameOrThrow(request.gameId, request.visibility)
    const lobbyId = this.idGenerator.nextId()
    const lobby: DurableLobbyRecord = {
      lobbyId,
      gameId: game.gameId,
      ownerPlayerId: identity.playerId,
      status: 'open',
      visibility: request.visibility,
      capacity: request.capacity,
      minimumPlayers: request.minimumPlayers,
      configuration: request.configuration,
      joinCodeHash: request.joinCode ? this.hashJoinCode(request.joinCode) : null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      expiresAt: this.extendExpiry(now),
    }
    const ownerMembership: DurableLobbyMemberRecord = {
      lobbyId,
      playerId: identity.playerId,
      role: 'owner',
      joinedAt: now,
      leftAt: null,
    }

    try {
      await this.lobbyRepository.withTransaction(async (transaction) => {
        await transaction.createLobby({
          ...lobby,
          ownerMembership,
        })
      })
    } catch (error) {
      this.handlePostgresError(error)
      throw error
    }

    const aggregate = await this.requireLobby(lobbyId)
    await this.tryMarkConnected(aggregate.lobbyId, identity.playerId, now)
    this.logLobbyEvent('lobby_created', identity, { lobbyId, gameId: game.gameId })

    return this.composeLobbyDetails(aggregate, { allowUnavailableRuntime: true })
  }

  async getLobby(lobbyId: string): Promise<LobbyDetails> {
    const aggregate = await this.requireLobby(lobbyId)
    return this.composeLobbyDetails(aggregate, { allowUnavailableRuntime: true })
  }

  async joinLobby(lobbyId: string, identity: LobbyRequestIdentity, request: JoinLobbyRequest): Promise<LobbyDetails> {
    const now = this.clock.now().toISOString()

    const result = await this.lobbyRepository.withTransaction(async (transaction) => {
      const lobby = await this.requireLobbyForUpdate(transaction, lobbyId)
      const activeLobby = await this.expireIfNeeded(transaction, lobby, now)

      if (activeLobby.status === 'closed' || activeLobby.status === 'expired') {
        this.throwLobbyError(activeLobby.status === 'closed' ? 'LOBBY_CLOSED' : 'INVALID_LOBBY_STATE', HttpStatus.CONFLICT)
      }

      if (activeLobby.status !== 'open') {
        this.throwLobbyError('INVALID_LOBBY_STATE', HttpStatus.CONFLICT)
      }

      const existingMember = getActiveMember(activeLobby, identity.playerId)

      if (existingMember) {
        return {
          aggregate: activeLobby,
          joined: false,
        }
      }

      if (activeLobby.visibility === 'private') {
        if (!request.joinCode || activeLobby.joinCodeHash !== this.hashJoinCode(request.joinCode)) {
          this.throwLobbyError('PRIVATE_LOBBY_ACCESS_DENIED', HttpStatus.FORBIDDEN)
        }
      }

      if (getActiveMemberCount(activeLobby) >= activeLobby.capacity) {
        this.throwLobbyError('LOBBY_FULL', HttpStatus.CONFLICT)
      }

      await transaction.addMember({
        lobbyId,
        playerId: identity.playerId,
        role: 'member',
        joinedAt: now,
        leftAt: null,
      })

      await transaction.updateLobby({
        ...activeLobby,
        updatedAt: now,
        expiresAt: this.extendExpiry(now),
      })

      const updated = await transaction.getById(lobbyId)

      if (!updated) {
        this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      return {
        aggregate: updated,
        joined: true,
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    await this.tryMarkConnected(lobbyId, identity.playerId, now)

    if (result.joined) {
      await this.tryClearReadyState(lobbyId)
      this.logLobbyEvent('member_joined', identity, { lobbyId, playerId: identity.playerId })
    }

    return this.composeLobbyDetails(result.aggregate, { allowUnavailableRuntime: true })
  }

  async leaveLobby(lobbyId: string, identity: LobbyRequestIdentity): Promise<LobbyDetails> {
    const now = this.clock.now().toISOString()
    let ownershipTransferredTo: string | null = null
    let closed = false

    const aggregate = await this.lobbyRepository.withTransaction(async (transaction) => {
      const lobby = await this.requireLobbyForUpdate(transaction, lobbyId)
      const activeLobby = await this.expireIfNeeded(transaction, lobby, now)

      if (activeLobby.status !== 'open') {
        this.throwLobbyError('INVALID_LOBBY_STATE', HttpStatus.CONFLICT)
      }

      const activeMember = getActiveMember(activeLobby, identity.playerId)

      if (!activeMember) {
        this.throwLobbyError('NOT_LOBBY_MEMBER', HttpStatus.CONFLICT)
      }

      await transaction.markMemberLeft(lobbyId, identity.playerId, now)

      const intermediate = await transaction.getById(lobbyId)

      if (!intermediate) {
        this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      if (activeMember.role === 'owner') {
        const successor = getDeterministicOwnerSuccessor(intermediate, identity.playerId)

        if (!successor) {
          closed = true
          await transaction.updateLobby({
            ...intermediate,
            status: 'closed',
            updatedAt: now,
            closedAt: now,
          })
        } else {
          ownershipTransferredTo = successor.playerId
          await transaction.updateMemberRole(lobbyId, successor.playerId, 'owner')
          await transaction.updateLobby({
            ...intermediate,
            ownerPlayerId: successor.playerId,
            updatedAt: now,
            expiresAt: this.extendExpiry(now),
          })
        }
      } else {
        await transaction.updateLobby({
          ...intermediate,
          updatedAt: now,
          expiresAt: this.extendExpiry(now),
        })
      }

      const updated = await transaction.getById(lobbyId)

      if (!updated) {
        this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      return updated
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    await this.tryRemoveMemberRuntime(lobbyId, identity.playerId)
    await this.tryClearReadyState(lobbyId)

    if (closed) {
      await this.tryClearLobbyRuntime(lobbyId)
      this.logLobbyEvent('lobby_closed', identity, { lobbyId, reason: 'owner_left_last_member' })
    }

    if (ownershipTransferredTo) {
      this.logLobbyEvent('ownership_transferred', identity, { lobbyId, ownerPlayerId: ownershipTransferredTo })
    }

    this.logLobbyEvent('member_left', identity, { lobbyId, playerId: identity.playerId })

    return this.composeLobbyDetails(aggregate, { allowUnavailableRuntime: true })
  }

  async setReady(lobbyId: string, identity: LobbyRequestIdentity, request: SetLobbyReadyRequest): Promise<LobbyDetails> {
    const now = this.clock.now().toISOString()
    const aggregate = await this.requireLobby(lobbyId)
    const status = materializeLobbyStatus(aggregate, now)

    if (status !== 'open') {
      this.throwLobbyError('INVALID_LOBBY_STATE', HttpStatus.CONFLICT)
    }

    if (!getActiveMember(aggregate, identity.playerId)) {
      this.throwLobbyError('NOT_LOBBY_MEMBER', HttpStatus.CONFLICT)
    }

    await this.requireRuntimeOperation(() => this.lobbyRuntimeStore.setReadyState(lobbyId, identity.playerId, request.ready, now))
    return this.composeLobbyDetails(aggregate, { allowUnavailableRuntime: false })
  }

  async startLobby(lobbyId: string, identity: LobbyRequestIdentity): Promise<LobbyDetails> {
    const now = this.clock.now().toISOString()

    const aggregate = await this.lobbyRepository.withTransaction(async (transaction) => {
      const lobby = await this.requireLobbyForUpdate(transaction, lobbyId)
      const activeLobby = await this.expireIfNeeded(transaction, lobby, now)

      if (activeLobby.ownerPlayerId !== identity.playerId) {
        this.throwLobbyError('NOT_LOBBY_OWNER', HttpStatus.FORBIDDEN)
      }

      if (activeLobby.status === 'starting' || activeLobby.status === 'started') {
        return activeLobby
      }

      if (activeLobby.status !== 'open') {
        this.throwLobbyError('INVALID_LOBBY_STATE', HttpStatus.CONFLICT)
      }

      const activeMembers = getActiveLobbyMembers(activeLobby)

      if (activeMembers.length < activeLobby.minimumPlayers) {
        this.throwLobbyError('LOBBY_NOT_READY', HttpStatus.CONFLICT)
      }

      const runtime = await this.requireRuntimeOperation(() =>
        this.lobbyRuntimeStore.getRuntimeState(
          activeLobby.lobbyId,
          activeMembers.map((member) => member.playerId),
        ),
      )

      if (!runtime.allMembersReady) {
        this.throwLobbyError('PLAYER_NOT_READY', HttpStatus.CONFLICT)
      }

      await transaction.updateLobby({
        ...activeLobby,
        status: 'starting',
        updatedAt: now,
      })

      const updated = await transaction.getById(lobbyId)

      if (!updated) {
        this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      return updated
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    await this.tryClearLobbyRuntime(lobbyId)
    this.logLobbyEvent('lobby_starting', identity, { lobbyId })

    return this.composeLobbyDetails(aggregate, { allowUnavailableRuntime: true })
  }

  async closeLobby(lobbyId: string, identity: LobbyRequestIdentity): Promise<LobbyDetails> {
    const now = this.clock.now().toISOString()

    const aggregate = await this.lobbyRepository.withTransaction(async (transaction) => {
      const lobby = await this.requireLobbyForUpdate(transaction, lobbyId)
      const activeLobby = await this.expireIfNeeded(transaction, lobby, now)

      if (activeLobby.ownerPlayerId !== identity.playerId) {
        this.throwLobbyError('NOT_LOBBY_OWNER', HttpStatus.FORBIDDEN)
      }

      if (activeLobby.status === 'closed') {
        return activeLobby
      }

      if (activeLobby.status === 'expired' || activeLobby.status === 'started') {
        this.throwLobbyError('INVALID_LOBBY_STATE', HttpStatus.CONFLICT)
      }

      await transaction.updateLobby({
        ...activeLobby,
        status: 'closed',
        updatedAt: now,
        closedAt: now,
      })

      const updated = await transaction.getById(lobbyId)

      if (!updated) {
        this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      return updated
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    await this.tryClearLobbyRuntime(lobbyId)
    this.logLobbyEvent('lobby_closed', identity, { lobbyId, reason: 'owner_closed' })

    return this.composeLobbyDetails(aggregate, { allowUnavailableRuntime: true })
  }

  private async requireLobby(lobbyId: string) {
    try {
      const aggregate = await this.lobbyRepository.getById(lobbyId)

      if (!aggregate) {
        this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      return aggregate
    } catch (error) {
      this.handlePostgresError(error)
      throw error
    }
  }

  private async requireLobbyForUpdate(transaction: LobbyRepositoryTransaction, lobbyId: string) {
    const aggregate = await transaction.getByIdForUpdate(lobbyId)

    if (!aggregate) {
      this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    return aggregate
  }

  private async expireIfNeeded(transaction: LobbyRepositoryTransaction, lobby: DurableLobbyAggregate, now: string) {
    if (!isLobbyExpired(lobby, now)) {
      return lobby
    }

    await transaction.updateLobby({
      ...lobby,
      status: 'expired',
      updatedAt: now,
    })

    await this.tryClearLobbyRuntime(lobby.lobbyId)
    this.logLobbyEvent('lobby_expired', null, { lobbyId: lobby.lobbyId })

    const updated = await transaction.getById(lobby.lobbyId)

    if (!updated) {
      this.throwLobbyError('LOBBY_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    return updated
  }

  private async composeLobbyDetails(
    aggregate: DurableLobbyAggregate,
    options: { allowUnavailableRuntime: boolean },
  ): Promise<LobbyDetails> {
    const now = this.clock.now().toISOString()
    const activeMembers = getActiveLobbyMembers(aggregate)
    const runtime = await this.getRuntimeProjection(aggregate, options.allowUnavailableRuntime)

    return {
      lobbyId: aggregate.lobbyId,
      gameId: aggregate.gameId,
      ownerPlayerId: aggregate.ownerPlayerId,
      status: materializeLobbyStatus(aggregate, now),
      visibility: aggregate.visibility,
      capacity: aggregate.capacity,
      minimumPlayers: aggregate.minimumPlayers,
      configuration: aggregate.configuration,
      members: [...aggregate.members].sort((left, right) => {
        if (new Date(left.joinedAt).getTime() === new Date(right.joinedAt).getTime()) {
          return left.playerId.localeCompare(right.playerId)
        }

        return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime()
      }).map((member) => ({
        playerId: member.playerId,
        role: member.role,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
      })),
      runtime,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      closedAt: aggregate.closedAt,
      expiresAt: aggregate.expiresAt,
    }
  }

  private async getRuntimeProjection(aggregate: DurableLobbyAggregate, allowUnavailableRuntime: boolean) {
    const activePlayerIds = getActiveLobbyMembers(aggregate).map((member) => member.playerId)

    try {
      return await this.lobbyRuntimeStore.getRuntimeState(aggregate.lobbyId, activePlayerIds)
    } catch (error) {
      if (isRedisDependencyError(error) && allowUnavailableRuntime) {
        return buildUnavailableRuntimeState(activePlayerIds)
      }

      if (isRedisDependencyError(error)) {
        this.throwLobbyError('LOBBY_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
      }

      throw error
    }
  }

  private async getCompatibleGameOrThrow(gameId: string, visibility: CreateLobbyRequest['visibility']) {
    const game = await this.catalogQueryService.getGameById(gameId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!game) {
      this.throwLobbyError('GAME_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    if (game.status !== 'active' || !game.multiplayer || !game.platforms.web) {
      this.throwLobbyError('INVALID_GAME_CONFIGURATION', HttpStatus.CONFLICT)
    }

    if (visibility === 'private' && !game.privateRooms) {
      this.throwLobbyError('INVALID_GAME_CONFIGURATION', HttpStatus.CONFLICT)
    }

    return game
  }

  private async requireRuntimeOperation<T>(operation: () => Promise<T>) {
    try {
      return await operation()
    } catch (error) {
      if (isRedisDependencyError(error)) {
        this.throwLobbyError('LOBBY_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
      }

      throw error
    }
  }

  private async tryMarkConnected(lobbyId: string, playerId: string, at: string) {
    try {
      await this.lobbyRuntimeStore.markConnected(lobbyId, playerId, at)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async tryRemoveMemberRuntime(lobbyId: string, playerId: string) {
    try {
      await this.lobbyRuntimeStore.removeMember(lobbyId, playerId)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async tryClearReadyState(lobbyId: string) {
    try {
      await this.lobbyRuntimeStore.clearReadyState(lobbyId)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async tryClearLobbyRuntime(lobbyId: string) {
    try {
      await this.lobbyRuntimeStore.clearLobbyRuntime(lobbyId)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private extendExpiry(now: string) {
    return new Date(new Date(now).getTime() + LOBBY_EXPIRY_WINDOW_MS).toISOString()
  }

  private hashJoinCode(joinCode: string) {
    return createHash('sha256').update(joinCode.trim()).digest('hex')
  }

  private handlePostgresError(error: unknown) {
    if (isPostgresDependencyError(error)) {
      logDependencyDown('postgres', error, 'LobbyService')
      this.throwLobbyError('LOBBY_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
    }
  }

  private throwLobbyError(code: LobbyErrorCode, status: HttpStatus): never {
    throw new HttpException({ code }, status)
  }

  private logLobbyEvent(event: string, identity: LobbyRequestIdentity | null, details: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        timestamp: this.clock.now().toISOString(),
        level: 'log',
        context: 'LobbyService',
        event,
        requestId: identity?.requestId ?? null,
        playerId: identity?.playerId ?? null,
        ...details,
      }),
    )
  }
}