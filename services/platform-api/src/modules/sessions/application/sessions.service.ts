import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import type {
  CreateSessionRequest,
  GameSession,
  GameServerAllocation,
  MatchReadyPayload,
  SessionErrorCode,
  SessionFailureCode,
} from '@game-center/contracts'

import { MATCH_READY_QUERY, type MatchReadyQuery } from '../../../boundaries/match-ready-query.js'
import { SessionAllocationError } from '../../../boundaries/session-allocation-orchestrator.js'
import { type SessionMatchReadyHandler } from '../../../boundaries/session-match-ready-handler.js'
import { type Clock, CLOCK } from '../../../boundaries/clock.js'
import { type IdGenerator, ID_GENERATOR } from '../../../boundaries/id-generator.js'
import { isPostgresDependencyError, logDependencyDown } from '../../../infrastructure/dependency-health.js'
import {
  canCancelSession,
  canTransitionSession,
  isSessionExpired,
  isSessionParticipant,
  isSessionTerminal,
  materializeSessionStatus,
  SESSION_EXPIRY_WINDOW_MS,
  type DurableGameSession,
  type DurableGameSessionAggregate,
} from '../domain/game-session.js'
import { SESSION_ALLOCATION_PORT, SESSION_REPOSITORY, type SessionAllocationPort, type SessionRepository } from './sessions.ports.js'
import type { SessionRequestIdentity } from './sessions.identity.js'

@Injectable()
export class SessionsService implements SessionMatchReadyHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepository,
    @Inject(SESSION_ALLOCATION_PORT) private readonly sessionAllocationPort: SessionAllocationPort,
    @Inject(MATCH_READY_QUERY) private readonly matchReadyQuery: MatchReadyQuery,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async createSession(identity: SessionRequestIdentity, request: CreateSessionRequest): Promise<GameSession> {
    const existing = await this.sessionRepository.getByMatchId(request.matchId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (existing) {
      this.requireParticipant(existing, identity.playerId)
      const session = await this.ensureAllocationRequested(existing, identity.requestId)
      return this.composeSession(session)
    }

    const match = await this.matchReadyQuery.getMatchReady(request.matchId)

    if (!match || !match.participants.some((participant) => participant.playerId === identity.playerId)) {
      this.throwSessionError('MATCH_NOT_READY', HttpStatus.CONFLICT)
    }

    const session = await this.createOrReuseFromMatchReady(match, identity.requestId)
    return this.composeSession(this.requireParticipant(session, identity.playerId))
  }

  async getSession(sessionId: string, identity: SessionRequestIdentity): Promise<GameSession> {
    const session = await this.requireSession(sessionId)
    const authorized = this.requireParticipant(session, identity.playerId)
    return this.composeSession(authorized)
  }

  async requestAllocation(sessionId: string, identity: SessionRequestIdentity): Promise<GameServerAllocation> {
    const session = await this.requireSession(sessionId)
    const authorized = this.requireParticipant(session, identity.playerId)

    try {
      return await this.requestAllocationForSession(authorized, identity.requestId)
    } catch (error) {
      this.handleAllocationError(error)
      throw error
    }
  }

  async getAllocation(sessionId: string, identity: SessionRequestIdentity): Promise<GameServerAllocation> {
    const session = await this.requireSession(sessionId)
    this.requireParticipant(session, identity.playerId)

    try {
      const allocation = await this.sessionAllocationPort.getAllocation(sessionId)

      if (!allocation) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      return allocation
    } catch (error) {
      this.handleAllocationError(error)
      throw error
    }
  }

  async releaseAllocation(sessionId: string, identity: SessionRequestIdentity): Promise<GameServerAllocation> {
    const session = await this.requireSession(sessionId)
    this.requireParticipant(session, identity.playerId)

    try {
      const allocation = await this.sessionAllocationPort.releaseAllocation(sessionId)

      if (!allocation) {
        throw new SessionAllocationError('ALLOCATION_NOT_FOUND')
      }

      return allocation
    } catch (error) {
      this.handleAllocationError(error)
      throw error
    }
  }

  async cancelSession(sessionId: string, identity: SessionRequestIdentity): Promise<GameSession> {
    const now = this.clock.now().toISOString()
    const result = await this.sessionRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(sessionId)

      if (!current) {
        this.throwSessionError('SESSION_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      this.requireParticipant(current, identity.playerId)

      const materialized = materializeSessionStatus(current, now)
      if (materialized === 'expired') {
        const expired = this.expireSession(current, now)
        await transaction.updateSession(expired)
        this.logSessionEvent('session_expired', identity, { sessionId: expired.sessionId, matchId: expired.matchId })
        this.throwSessionError('SESSION_EXPIRED', HttpStatus.CONFLICT)
      }

      if (!canCancelSession(current.status)) {
        this.throwSessionError('SESSION_INVALID_STATE', HttpStatus.CONFLICT)
      }

      const cancelled = {
        ...current,
        status: 'cancelled' as const,
        cancelledAt: now,
        updatedAt: now,
      }
      await transaction.updateSession(cancelled)
      return {
        ...cancelled,
        participants: current.participants,
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    this.logSessionEvent('session_cancelled', identity, { sessionId: result.sessionId, matchId: result.matchId })
    return this.composeSession(result)
  }

  async onMatchReady(match: MatchReadyPayload): Promise<void> {
    await this.createOrReuseFromMatchReady(match, null)
  }

  private async createOrReuseFromMatchReady(match: MatchReadyPayload, requestId: string | null) {
    const now = this.clock.now().toISOString()
    const session = await this.insertOrReuseSession(match, now)
    const allocated = await this.ensureAllocationRequested(session, requestId)
    return this.toDurableAggregate(allocated)
  }

  private async insertOrReuseSession(match: MatchReadyPayload, now: string) {
    const created: DurableGameSessionAggregate = {
      sessionId: this.idGenerator.nextId(),
      sourceKind: 'matchmaking',
      matchId: match.matchId,
      proposalId: match.proposalId,
      gameId: match.gameId,
      queueType: match.queueType,
      platform: match.platform,
      region: match.region,
      gameVersion: match.gameVersion,
      protocolVersion: match.protocolVersion,
      status: 'created',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      expiresAt: new Date(new Date(now).getTime() + SESSION_EXPIRY_WINDOW_MS).toISOString(),
      failureCode: null,
      participants: match.participants.map((participant) => ({
        sessionId: '',
        playerId: participant.playerId,
        sourceRequestId: participant.requestId,
        sourceLobbyId: participant.sourceLobbyId,
        joinedAt: now,
      })),
    }

    created.participants = created.participants.map((participant) => ({
      ...participant,
      sessionId: created.sessionId,
    }))

    try {
      await this.sessionRepository.withTransaction(async (transaction) => {
        const existing = await transaction.getByMatchIdForUpdate(match.matchId)

        if (existing) {
          throw new ReusedSessionError(existing)
        }

        await transaction.createSession(created)
      })
      this.logSessionEvent('session_created', null, { sessionId: created.sessionId, matchId: created.matchId })
      return created
    } catch (error) {
      if (error instanceof ReusedSessionError) {
        return error.session
      }

      if (this.isUniqueViolation(error)) {
        const existing = await this.sessionRepository.getByMatchId(match.matchId).catch((lookupError) => {
          this.handlePostgresError(lookupError)
          throw lookupError
        })

        if (existing) {
          return existing
        }
      }

      this.handlePostgresError(error)
      throw error
    }
  }

  private async ensureAllocationRequested(session: DurableGameSessionAggregate, requestId: string | null) {
    const current = await this.materializeExpiryOnAccess(session)

    const claimed = await this.claimAllocationRequest(current.sessionId)

    if (claimed.claimed) {
      try {
        const allocation = await this.requestAllocationForSession(claimed.session, requestId)

        if (allocation.status === 'ready') {
          const ready = await this.transitionSessionToReady(claimed.session.sessionId)
          return ready
        }
      } catch (error) {
        if (error instanceof SessionAllocationError && error.code === 'ALLOCATION_UNAVAILABLE') {
          this.throwSessionError('SESSION_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
        }

        await this.failSession(claimed.session.sessionId, 'ALLOCATION_REQUEST_FAILED', requestId)
        this.throwSessionError('SESSION_CREATION_FAILED', HttpStatus.CONFLICT)
      }

      this.logSessionEvent('session_transitioned', { playerId: null, requestId }, {
        sessionId: claimed.session.sessionId,
        matchId: claimed.session.matchId,
        status: claimed.session.status,
      })
    }

    return claimed.session
  }

  private async requestAllocationForSession(session: DurableGameSessionAggregate, requestId: string | null): Promise<GameServerAllocation> {
    return this.sessionAllocationPort.requestAllocation(this.toSessionAllocationRequest(session, requestId))
  }

  private toSessionAllocationRequest(session: DurableGameSessionAggregate, requestId: string | null) {
    return {
      sessionId: session.sessionId,
      matchId: session.matchId,
      proposalId: session.proposalId,
      gameId: session.gameId,
      queueType: session.queueType,
      platform: session.platform,
      region: session.region,
      gameVersion: session.gameVersion,
      protocolVersion: session.protocolVersion,
      playerIds: session.participants.map((participant) => participant.playerId),
      participantCapacity: session.participants.length,
      requestedAt: requestId ? this.clock.now().toISOString() : session.updatedAt,
      expiresAt: session.expiresAt,
    }
  }

  private async claimAllocationRequest(sessionId: string): Promise<{ session: DurableGameSessionAggregate; claimed: boolean }> {
    const now = this.clock.now().toISOString()

    return this.sessionRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(sessionId)

      if (!current) {
        this.throwSessionError('SESSION_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      if (current.status === 'allocating') {
        return { session: current, claimed: false }
      }

      if (current.status !== 'created') {
        return { session: current, claimed: false }
      }

      const updated: DurableGameSession = {
        ...current,
        status: 'allocating',
        updatedAt: now,
      }

      await transaction.updateSession(updated)
      return {
        session: {
          ...updated,
          participants: current.participants,
        },
        claimed: true,
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })
  }

  private async failSession(sessionId: string, failureCode: SessionFailureCode, requestId: string | null) {
    const now = this.clock.now().toISOString()

    const failed = await this.sessionRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(sessionId)

      if (!current) {
        this.throwSessionError('SESSION_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      if (current.status === 'failed') {
        return current
      }

      if (isSessionTerminal(current.status)) {
        return current
      }

      const updated: DurableGameSession = {
        ...current,
        status: 'failed',
        failedAt: now,
        updatedAt: now,
        failureCode,
      }

      await transaction.updateSession(updated)
      return {
        ...updated,
        participants: current.participants,
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    this.logSessionEvent('session_failed', { playerId: null as never, requestId }, {
      sessionId: failed.sessionId,
      matchId: failed.matchId,
      failureCode,
    })

    return failed
  }

  private async transitionSessionToReady(sessionId: string) {
    const now = this.clock.now().toISOString()

    return this.sessionRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(sessionId)

      if (!current) {
        this.throwSessionError('SESSION_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      if (current.status === 'ready') {
        return current
      }

      if (!canTransitionSession(current.status, 'ready')) {
        return current
      }

      const updated: DurableGameSession = {
        ...current,
        status: 'ready',
        updatedAt: now,
      }

      await transaction.updateSession(updated)
      return {
        ...updated,
        participants: current.participants,
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })
  }

  private async requireSession(sessionId: string) {
    const session = await this.sessionRepository.getById(sessionId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!session) {
      this.throwSessionError('SESSION_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    return this.materializeExpiryOnAccess(session)
  }

  private async materializeExpiryOnAccess(session: DurableGameSessionAggregate) {
    const now = this.clock.now().toISOString()
    if (!isSessionExpired(session, now)) {
      return session
    }

    const expired = await this.sessionRepository.withTransaction(async (transaction) => {
      const current = await transaction.getByIdForUpdate(session.sessionId)

      if (!current) {
        this.throwSessionError('SESSION_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      if (materializeSessionStatus(current, now) !== 'expired') {
        return current
      }

      const updated = this.expireSession(current, now)
      await transaction.updateSession(updated)
      return {
        ...updated,
        participants: current.participants,
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    this.logSessionEvent('session_expired', null, { sessionId: expired.sessionId, matchId: expired.matchId })
    return expired
  }

  private expireSession(session: DurableGameSessionAggregate, now: string): DurableGameSession {
    return {
      ...session,
      status: 'expired',
      updatedAt: now,
    }
  }

  private requireParticipant(session: DurableGameSessionAggregate, playerId: string) {
    if (!isSessionParticipant(session, playerId)) {
      this.throwSessionError('SESSION_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    return session
  }

  private toDurableAggregate(session: DurableGameSessionAggregate | GameSession): DurableGameSessionAggregate {
    if ('sourceKind' in session) {
      return session
    }

    return {
      sessionId: session.sessionId,
      sourceKind: session.source.kind,
      matchId: session.source.matchId,
      proposalId: session.source.proposalId,
      gameId: session.gameId,
      queueType: session.queueType,
      platform: session.platform,
      region: session.region,
      gameVersion: session.gameVersion,
      protocolVersion: session.protocolVersion,
      status: session.status,
      participants: session.participants.map((participant) => ({
        sessionId: session.sessionId,
        playerId: participant.playerId,
        sourceRequestId: participant.sourceRequestId,
        sourceLobbyId: participant.sourceLobbyId,
        joinedAt: participant.joinedAt,
      })),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      failedAt: session.failedAt,
      cancelledAt: session.cancelledAt,
      expiresAt: session.expiresAt,
      failureCode: session.failureCode,
    }
  }

  private composeSession(session: DurableGameSessionAggregate): GameSession {
    return {
      sessionId: session.sessionId,
      source: {
        kind: session.sourceKind,
        matchId: session.matchId,
        proposalId: session.proposalId,
      },
      gameId: session.gameId,
      queueType: session.queueType,
      platform: session.platform,
      region: session.region,
      gameVersion: session.gameVersion,
      protocolVersion: session.protocolVersion,
      status: session.status,
      participants: session.participants.map((participant) => ({
        playerId: participant.playerId,
        sourceRequestId: participant.sourceRequestId,
        sourceLobbyId: participant.sourceLobbyId,
        joinedAt: participant.joinedAt,
      })),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      failedAt: session.failedAt,
      cancelledAt: session.cancelledAt,
      expiresAt: session.expiresAt,
      failureCode: session.failureCode,
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

  private handlePostgresError(error: unknown) {
    if (isPostgresDependencyError(error)) {
      logDependencyDown('postgres', error, 'SessionsService')
      this.throwSessionError('SESSION_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
    }
  }

  private handleAllocationError(error: unknown): never | void {
    if (!(error instanceof SessionAllocationError)) {
      return
    }

    if (error.code === 'ALLOCATION_NOT_FOUND') {
      throw new HttpException({ code: 'ALLOCATION_NOT_FOUND' }, HttpStatus.NOT_FOUND)
    }

    if (error.code === 'ALLOCATION_UNAVAILABLE') {
      throw new HttpException({ code: 'ALLOCATION_UNAVAILABLE' }, HttpStatus.SERVICE_UNAVAILABLE)
    }

    if (error.code === 'ALLOCATION_ALREADY_RELEASED') {
      throw new HttpException({ code: 'ALLOCATION_ALREADY_RELEASED' }, HttpStatus.OK)
    }

    if (error.code === 'ALLOCATION_INVALID_STATE') {
      throw new HttpException({ code: 'ALLOCATION_INVALID_STATE' }, HttpStatus.CONFLICT)
    }

    if (error.code === 'ALLOCATION_FAILED') {
      throw new HttpException({ code: 'ALLOCATION_FAILED' }, HttpStatus.CONFLICT)
    }
  }

  private throwSessionError(code: SessionErrorCode, status: HttpStatus): never {
    throw new HttpException({ code }, status)
  }

  private logSessionEvent(
    event: string,
    identity: { playerId: string | null; requestId: string | null } | null,
    details: Record<string, unknown>,
  ) {
    console.log(
      JSON.stringify({
        timestamp: this.clock.now().toISOString(),
        level: 'log',
        context: 'SessionsService',
        event,
        requestId: identity?.requestId ?? null,
        playerId: identity?.playerId ?? null,
        ...details,
      }),
    )
  }
}

class ReusedSessionError extends Error {
  constructor(readonly session: DurableGameSessionAggregate) {
    super('Session already exists for match')
  }
}