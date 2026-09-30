import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import type {
  CreateMatchmakingRequest,
  MatchProposalDetails,
  MatchmakingErrorCode,
  MatchmakingQueueIdentity,
  MatchmakingRequestDetails,
  MatchmakingRequester,
  MatchReadyPayload,
} from '@game-center/contracts'

import { MATCH_READY_QUERY, type MatchReadyQuery } from '../../../boundaries/match-ready-query.js'
import { type CatalogQueryService, CATALOG_QUERY_SERVICE } from '../../../boundaries/catalog-query.js'
import { type Clock, CLOCK } from '../../../boundaries/clock.js'
import { type IdGenerator, ID_GENERATOR } from '../../../boundaries/id-generator.js'
import { isPostgresDependencyError, isRedisDependencyError, logDependencyDown } from '../../../infrastructure/dependency-health.js'
import { MATCHMAKING_STRATEGY, type MatchmakingStrategy } from '../domain/matchmaking-strategy.js'
import {
  allProposalMembersAccepted,
  buildQueueKey,
  getPendingProposalMembers,
  getQueuePolicy,
  hasSameQueueIdentity,
  isActiveRequestStatus,
  isProposalExpired,
  isProposalTerminal,
  isQueuedRequest,
  materializeRequestStatus,
  MATCH_QUEUE_LOCK_TTL_SECONDS,
  MATCH_REQUEST_EXPIRY_WINDOW_MS,
  type DurableMatchProposal,
  type DurableMatchProposalAggregate,
  type DurableMatchmakingRequest,
  toQueueIdentity,
} from '../domain/queue-ticket.js'
import type { MatchmakingRequestIdentity } from './matchmaking.identity.js'
import {
  buildUnavailableRuntimeState,
  MATCHMAKING_QUEUE_STORE,
  MATCHMAKING_REPOSITORY,
  MATCH_READY_SINK,
  type MatchmakingQueueStore,
  type MatchmakingRepository,
  type MatchmakingRepositoryTransaction,
  type MatchReadySink,
} from './matchmaking.ports.js'

@Injectable()
export class MatchmakingService {
  constructor(
    @Inject(MATCHMAKING_REPOSITORY) private readonly matchmakingRepository: MatchmakingRepository,
    @Inject(MATCHMAKING_QUEUE_STORE) private readonly queueStore: MatchmakingQueueStore,
    @Inject(MATCHMAKING_STRATEGY) private readonly matchmakingStrategy: MatchmakingStrategy,
    @Inject(MATCH_READY_SINK) private readonly matchReadySink: MatchReadySink,
    @Inject(CATALOG_QUERY_SERVICE) private readonly catalogQueryService: CatalogQueryService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async enqueue(identity: MatchmakingRequestIdentity, request: CreateMatchmakingRequest): Promise<MatchmakingRequestDetails> {
    const requester = this.toRequester(identity)
    const now = this.clock.now().toISOString()
    const game = await this.getCompatibleGameOrThrow(request)
    const queue: MatchmakingQueueIdentity = {
      gameId: game.gameId,
      queueType: request.queueType,
      platform: request.platform,
      region: request.region?.trim() || null,
      gameVersion: game.gameVersion,
      protocolVersion: request.protocolVersion ?? game.protocolVersion,
    }

    const persisted = await this.createOrReuseActiveRequest(requester, queue, request, now)

    await this.tryEnsureQueuedRuntime(persisted)
    await this.triggerQueueCycle(persisted.queueKey)
    this.logMatchmakingEvent('matchmaking_enqueued', identity, { requestId: persisted.requestId, queueKey: persisted.queueKey })

    const refreshed = await this.requireRequest(persisted.requestId)
    return this.composeRequestDetails(refreshed, { allowUnavailableRuntime: true })
  }

  async getRequest(requestId: string, identity: MatchmakingRequestIdentity): Promise<MatchmakingRequestDetails> {
    const request = await this.requireOwnedRequest(requestId, identity)
    await this.tryEnsureQueuedRuntime(request)
    return this.composeRequestDetails(request, { allowUnavailableRuntime: true })
  }

  async cancelRequest(requestId: string, identity: MatchmakingRequestIdentity): Promise<MatchmakingRequestDetails> {
    const now = this.clock.now().toISOString()
    const requester = this.toRequester(identity)

    const result = await this.matchmakingRepository.withTransaction(async (transaction) => {
      const current = await transaction.getRequestByIdForUpdate(requestId)

      if (!current || current.requesterType !== requester.type || current.requesterId !== requester.id) {
        this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      const status = materializeRequestStatus(current, now)

      if (status === 'cancelled') {
        return {
          request: current,
          cancelledProposalId: null,
          requeueRequestIds: [],
        }
      }

      if (status === 'matched' || status === 'expired' || status === 'failed') {
        this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_ACTIVE', HttpStatus.CONFLICT)
      }

      if (current.status === 'proposed' && current.activeProposalId) {
        return this.cancelProposedRequest(transaction, current, now)
      }

      const cancelled = {
        ...current,
        status: 'cancelled' as const,
        cancelledAt: now,
        terminalOutcome: 'cancelled' as const,
      }
      await transaction.updateRequest(cancelled)
      return {
        request: cancelled,
        cancelledProposalId: null,
        requeueRequestIds: [],
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (result.cancelledProposalId) {
      await this.tryClearProposalRuntime(result.cancelledProposalId)
      await this.requeueRequestsById(result.requeueRequestIds)
    }

    await this.tryRemoveQueuedRuntime(result.request.queueKey, [result.request.requestId])
    this.logMatchmakingEvent('matchmaking_cancelled', identity, { requestId })

    return this.composeRequestDetails(result.request, { allowUnavailableRuntime: true })
  }

  async getProposal(proposalId: string, identity: MatchmakingRequestIdentity): Promise<MatchProposalDetails> {
    const proposal = await this.requireParticipantProposal(proposalId, identity)
    const now = this.clock.now().toISOString()

    if (proposal.status === 'pending' && isProposalExpired(proposal, now)) {
      await this.expireProposal(proposalId, now)
      const expired = await this.requireParticipantProposal(proposalId, identity)
      return this.composeProposalDetails(expired)
    }

    return this.composeProposalDetails(proposal)
  }

  async getMatchReady(matchId: string): Promise<MatchReadyPayload | null> {
    const proposal = await this.matchmakingRepository.getProposalByMatchId(matchId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!proposal || proposal.status !== 'matched' || !proposal.matchId) {
      return null
    }

    const participants = await Promise.all(
      proposal.members.map(async (member) => {
        const request = await this.matchmakingRepository.getRequestById(member.requestId).catch((error) => {
          this.handlePostgresError(error)
          throw error
        })

        if (!request) {
          this.throwMatchmakingError('MATCHMAKING_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
        }

        return {
          playerId: member.playerId,
          requestId: member.requestId,
          sourceLobbyId: request.sourceLobbyId,
        }
      }),
    )

    return this.toMatchReadyPayload(proposal, participants, proposal.matchId)
  }

  async acceptProposal(proposalId: string, identity: MatchmakingRequestIdentity): Promise<MatchProposalDetails> {
    const now = this.clock.now().toISOString()

    const result = await this.matchmakingRepository.withTransaction(async (transaction) => {
      const proposal = await this.requireProposalForUpdate(transaction, proposalId)
      const participant = this.requireProposalParticipant(proposal, identity.playerId)

      if (proposal.status === 'pending' && isProposalExpired(proposal, now)) {
        await this.expireProposalInTransaction(transaction, proposal, now)
        return {
          proposal: await this.requireProposalForUpdate(transaction, proposalId),
          payload: null,
          requeueRequestIds: proposal.members.map((member) => member.requestId),
        }
      }

      if (proposal.status === 'matched') {
        return {
          proposal,
          payload: null,
          requeueRequestIds: [],
        }
      }

      if (isProposalTerminal(proposal.status)) {
        this.throwMatchmakingError('MATCH_PROPOSAL_ALREADY_RESOLVED', HttpStatus.CONFLICT)
      }

      if (participant.acceptanceStatus === 'accepted') {
        return {
          proposal,
          payload: null,
          requeueRequestIds: [],
        }
      }

      await transaction.updateProposalMember({
        ...participant,
        acceptanceStatus: 'accepted',
        respondedAt: now,
      })

      const updated = await this.requireProposalForUpdate(transaction, proposalId)

      if (!allProposalMembersAccepted(updated)) {
        return {
          proposal: updated,
          payload: null,
          requeueRequestIds: [],
        }
      }

      const matchId = this.idGenerator.nextId()
      const matchedRequests: DurableMatchmakingRequest[] = []
      await transaction.updateProposal({
        ...updated,
        status: 'matched',
        matchId,
        matchedAt: now,
        resolvedAt: now,
      })

      for (const member of updated.members) {
        const request = await transaction.getRequestByIdForUpdate(member.requestId)

        if (!request) {
          this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND)
        }

        await transaction.updateRequest({
          ...request,
          status: 'matched',
          matchedAt: now,
          terminalOutcome: 'matched',
          activeProposalId: null,
        })
        matchedRequests.push(request)
      }

      const matchedProposal = await this.requireProposalForUpdate(transaction, proposalId)
      return {
        proposal: matchedProposal,
        payload: this.toMatchReadyPayload(
          matchedProposal,
          matchedRequests.map((request) => ({
            playerId: request.requesterId,
            requestId: request.requestId,
            sourceLobbyId: request.sourceLobbyId,
          })),
          matchId,
        ),
        requeueRequestIds: [],
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    await this.tryClearProposalRuntime(proposalId)

    if (result.proposal.status === 'expired') {
      await this.requeueRequestsById(result.requeueRequestIds)
    }

    if (result.payload) {
      await this.publishMatchReadyOrFail(result.proposal, result.payload)
    }

    this.logMatchmakingEvent('match_proposal_accepted', identity, { proposalId })
    return this.composeProposalDetails(result.proposal)
  }

  async rejectProposal(proposalId: string, identity: MatchmakingRequestIdentity): Promise<MatchProposalDetails> {
    const now = this.clock.now().toISOString()

    const proposal = await this.matchmakingRepository.withTransaction(async (transaction) => {
      const current = await this.requireProposalForUpdate(transaction, proposalId)
      const participant = this.requireProposalParticipant(current, identity.playerId)

      if (current.status === 'pending' && isProposalExpired(current, now)) {
        await this.expireProposalInTransaction(transaction, current, now)
        return {
          proposal: await this.requireProposalForUpdate(transaction, proposalId),
          requeueRequestIds: current.members.map((member) => member.requestId),
        }
      }

      if (current.status === 'rejected') {
        return {
          proposal: current,
          requeueRequestIds: [],
        }
      }

      if (isProposalTerminal(current.status)) {
        this.throwMatchmakingError('MATCH_PROPOSAL_ALREADY_RESOLVED', HttpStatus.CONFLICT)
      }

      await transaction.updateProposalMember({
        ...participant,
        acceptanceStatus: 'rejected',
        respondedAt: now,
      })
      await transaction.updateProposal({
        ...current,
        status: 'rejected',
        resolvedAt: now,
      })

      for (const member of current.members) {
        const request = await transaction.getRequestByIdForUpdate(member.requestId)

        if (!request) {
          this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND)
        }

        if (member.playerId === identity.playerId) {
          await transaction.updateRequest({
            ...request,
            status: 'cancelled',
            cancelledAt: now,
            terminalOutcome: 'cancelled',
            activeProposalId: null,
          })
        } else {
          await transaction.updateRequest({
            ...request,
            status: 'queued',
            activeProposalId: null,
          })
        }
      }

      return {
        proposal: await this.requireProposalForUpdate(transaction, proposalId),
        requeueRequestIds: current.members.filter((member) => member.playerId !== identity.playerId).map((member) => member.requestId),
      }
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    await this.tryClearProposalRuntime(proposalId)

    if (proposal.proposal.status === 'expired') {
      await this.requeueRequestsById(proposal.requeueRequestIds)
      this.logMatchmakingEvent('match_proposal_expired', identity, { proposalId })
      return this.composeProposalDetails(proposal.proposal)
    }

    await this.requeueRequestsById(proposal.requeueRequestIds)
    this.logMatchmakingEvent('match_proposal_rejected', identity, { proposalId })
    return this.composeProposalDetails(proposal.proposal)
  }

  async runQueueCycle(queueKey: string): Promise<MatchProposalDetails | null> {
    const lockOwner = this.idGenerator.nextId()
    const acquired = await this.requireRuntimeOperation(() => this.queueStore.acquireQueueLock(queueKey, lockOwner, MATCH_QUEUE_LOCK_TTL_SECONDS))

    if (!acquired) {
      return null
    }

    try {
      const candidateIds = await this.requireRuntimeOperation(() => this.queueStore.getCandidateRequestIds(queueKey, 8))

      if (candidateIds.length === 0) {
        return null
      }

      const proposal = await this.matchmakingRepository.withTransaction(async (transaction) => {
        const requests = await transaction.getRequestsByIdsForUpdate(candidateIds)
        const queued = requests.filter((request) => request.queueKey === queueKey && request.status === 'queued')

        if (queued.length === 0) {
          return null
        }

        const selection = this.matchmakingStrategy.selectMatch(queued, getQueuePolicy(queued[0].queueType))

        if (!selection) {
          return null
        }

        const selectedRequests = queued.filter((request) => selection.requestIds.includes(request.requestId))
        const now = this.clock.now().toISOString()
        const proposalId = this.idGenerator.nextId()
        const created: DurableMatchProposal = {
          proposalId,
          matchId: null,
          queueKey,
          gameId: selection.queue.gameId,
          queueType: selection.queue.queueType,
          platform: selection.queue.platform,
          region: selection.queue.region,
          gameVersion: selection.queue.gameVersion,
          protocolVersion: selection.queue.protocolVersion,
          status: 'pending',
          createdAt: now,
          expiresAt: new Date(new Date(now).getTime() + getQueuePolicy(selection.queue.queueType).proposalTimeoutMs).toISOString(),
          matchedAt: null,
          resolvedAt: null,
        }

        await transaction.createProposal({
          ...created,
          members: selectedRequests.map((request) => ({
            proposalId,
            requestId: request.requestId,
            playerId: request.requesterId,
            acceptanceStatus: 'pending',
            respondedAt: null,
          })),
        })

        for (const request of selectedRequests) {
          await transaction.updateRequest({
            ...request,
            status: 'proposed',
            activeProposalId: proposalId,
          })
        }

        return this.requireProposalForUpdate(transaction, proposalId)
      }).catch((error) => {
        this.handlePostgresError(error)
        throw error
      })

      if (!proposal) {
        return null
      }

      await this.tryRemoveQueuedRuntime(queueKey, proposal.members.map((member) => member.requestId))
      await this.tryTouchProposalRuntime(proposal.proposalId, proposal.expiresAt)
      this.logMatchmakingEvent('match_proposal_created', null, { proposalId: proposal.proposalId })
      return this.composeProposalDetails(proposal)
    } finally {
      await this.tryReleaseQueueLock(queueKey, lockOwner)
    }
  }

  private async requireOwnedRequest(requestId: string, identity: MatchmakingRequestIdentity) {
    const request = await this.requireRequest(requestId)

    if (request.requesterType !== 'player' || request.requesterId !== identity.playerId) {
      this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    return request
  }

  private async requireRequest(requestId: string) {
    const request = await this.matchmakingRepository.getRequestById(requestId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!request) {
      this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    return request
  }

  private async requireParticipantProposal(proposalId: string, identity: MatchmakingRequestIdentity) {
    const proposal = await this.matchmakingRepository.getProposalById(proposalId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!proposal) {
      this.throwMatchmakingError('MATCH_PROPOSAL_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    this.requireProposalParticipant(proposal, identity.playerId)
    return proposal
  }

  private async requireProposalForUpdate(transaction: MatchmakingRepositoryTransaction, proposalId: string) {
    const proposal = await transaction.getProposalByIdForUpdate(proposalId)

    if (!proposal) {
      this.throwMatchmakingError('MATCH_PROPOSAL_NOT_FOUND', HttpStatus.NOT_FOUND)
    }

    return proposal
  }

  private requireProposalParticipant(proposal: DurableMatchProposalAggregate, playerId: string) {
    const member = proposal.members.find((entry) => entry.playerId === playerId)

    if (!member) {
      this.throwMatchmakingError('MATCH_PROPOSAL_NOT_PARTICIPANT', HttpStatus.FORBIDDEN)
    }

    return member
  }

  private async cancelProposedRequest(
    transaction: MatchmakingRepositoryTransaction,
    request: DurableMatchmakingRequest,
    now: string,
  ) {
    const proposal = await this.requireProposalForUpdate(transaction, request.activeProposalId as string)
    await transaction.updateProposal({
      ...proposal,
      status: 'cancelled',
      resolvedAt: now,
    })

    for (const member of proposal.members) {
      const current = await transaction.getRequestByIdForUpdate(member.requestId)

      if (!current) {
        this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      if (current.requestId === request.requestId) {
        await transaction.updateRequest({
          ...current,
          status: 'cancelled',
          cancelledAt: now,
          terminalOutcome: 'cancelled',
          activeProposalId: null,
        })
      } else {
        await transaction.updateRequest({
          ...current,
          status: 'queued',
          activeProposalId: null,
        })
      }
    }

    return {
      request: {
        ...request,
        status: 'cancelled' as const,
        cancelledAt: now,
        terminalOutcome: 'cancelled' as const,
        activeProposalId: null,
      },
      cancelledProposalId: proposal.proposalId,
      requeueRequestIds: proposal.members.filter((member) => member.requestId !== request.requestId).map((member) => member.requestId),
    }
  }

  private async expireProposal(proposalId: string, now: string) {
    const expired = await this.matchmakingRepository.withTransaction(async (transaction) => {
      const proposal = await this.requireProposalForUpdate(transaction, proposalId)
      await this.expireProposalInTransaction(transaction, proposal, now)
      return this.requireProposalForUpdate(transaction, proposalId)
    }).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    await this.tryClearProposalRuntime(proposalId)
    await this.requeueRequestsById(expired.members.map((member) => member.requestId))
  }

  private async expireProposalInTransaction(
    transaction: MatchmakingRepositoryTransaction,
    proposal: DurableMatchProposalAggregate,
    now: string,
  ) {
    if (proposal.status !== 'pending') {
      return
    }

    for (const member of getPendingProposalMembers(proposal)) {
      await transaction.updateProposalMember({
        ...member,
        acceptanceStatus: 'timed_out',
        respondedAt: now,
      })
    }

    await transaction.updateProposal({
      ...proposal,
      status: 'expired',
      resolvedAt: now,
    })

    for (const member of proposal.members) {
      const request = await transaction.getRequestByIdForUpdate(member.requestId)

      if (!request) {
        this.throwMatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND', HttpStatus.NOT_FOUND)
      }

      await transaction.updateRequest({
        ...request,
        status: 'queued',
        activeProposalId: null,
      })
    }
  }

  private async getCompatibleGameOrThrow(request: CreateMatchmakingRequest) {
    const game = await this.catalogQueryService.getGameById(request.gameId).catch((error) => {
      this.handlePostgresError(error)
      throw error
    })

    if (!game || game.status !== 'active' || !game.multiplayer || !game.platforms[request.platform]) {
      this.throwMatchmakingError('INCOMPATIBLE_GAME', HttpStatus.CONFLICT)
    }

    if (request.protocolVersion && request.protocolVersion !== game.protocolVersion) {
      this.throwMatchmakingError('INCOMPATIBLE_GAME', HttpStatus.CONFLICT)
    }

    return game
  }

  private async composeRequestDetails(
    request: DurableMatchmakingRequest,
    options: { allowUnavailableRuntime: boolean },
  ): Promise<MatchmakingRequestDetails> {
    const runtime = await this.getRuntimeProjection(request, options.allowUnavailableRuntime)

    return {
      requestId: request.requestId,
      requester: {
        type: request.requesterType,
        id: request.requesterId,
      },
      status: materializeRequestStatus(request, this.clock.now().toISOString()),
      queue: toQueueIdentity(request),
      requestedAt: request.requestedAt,
      cancelledAt: request.cancelledAt,
      matchedAt: request.matchedAt,
      expiresAt: request.expiresAt,
      terminalOutcome: request.terminalOutcome,
      sourceLobbyId: request.sourceLobbyId,
      activeProposalId: request.activeProposalId,
      runtime,
    }
  }

  private composeProposalDetails(proposal: DurableMatchProposalAggregate): MatchProposalDetails {
    return {
      proposalId: proposal.proposalId,
      status: proposal.status,
      queue: {
        gameId: proposal.gameId,
        queueType: proposal.queueType,
        platform: proposal.platform,
        region: proposal.region,
        gameVersion: proposal.gameVersion,
        protocolVersion: proposal.protocolVersion,
      },
      createdAt: proposal.createdAt,
      expiresAt: proposal.expiresAt,
      matchedAt: proposal.matchedAt,
      resolvedAt: proposal.resolvedAt,
      members: proposal.members.map((member) => ({
        requestId: member.requestId,
        playerId: member.playerId,
        acceptanceStatus: member.acceptanceStatus,
        respondedAt: member.respondedAt,
      })),
    }
  }

  private async getRuntimeProjection(request: DurableMatchmakingRequest, allowUnavailableRuntime: boolean) {
    try {
      return await this.queueStore.getRuntimeState(request.queueKey, request.requestId)
    } catch (error) {
      if (isRedisDependencyError(error) && allowUnavailableRuntime) {
        return buildUnavailableRuntimeState()
      }

      if (isRedisDependencyError(error)) {
        this.throwMatchmakingError('MATCHMAKING_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
      }

      throw error
    }
  }

  private async requireRuntimeOperation<T>(operation: () => Promise<T>) {
    try {
      return await operation()
    } catch (error) {
      if (isRedisDependencyError(error)) {
        this.throwMatchmakingError('MATCHMAKING_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
      }

      throw error
    }
  }

  private async triggerQueueCycle(queueKey: string) {
    try {
      await this.runQueueCycle(queueKey)
    } catch (error) {
      if (!(error instanceof HttpException) || error.getStatus() !== HttpStatus.SERVICE_UNAVAILABLE) {
        throw error
      }
    }
  }

  private async tryEnsureQueuedRuntime(request: DurableMatchmakingRequest) {
    if (!isActiveRequestStatus(request.status) || !isQueuedRequest(request)) {
      return
    }

    try {
      await this.queueStore.enqueue(request)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async tryRemoveQueuedRuntime(queueKey: string, requestIds: string[]) {
    try {
      await this.queueStore.removeMany(queueKey, requestIds)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async tryTouchProposalRuntime(proposalId: string, expiresAt: string) {
    try {
      await this.queueStore.touchProposalLease(proposalId, expiresAt)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async tryClearProposalRuntime(proposalId: string) {
    try {
      await this.queueStore.clearProposalLease(proposalId)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async tryReleaseQueueLock(queueKey: string, ownerToken: string) {
    try {
      await this.queueStore.releaseQueueLock(queueKey, ownerToken)
    } catch (error) {
      if (!isRedisDependencyError(error)) {
        throw error
      }
    }
  }

  private async publishMatchReadyOrFail(proposal: DurableMatchProposalAggregate, payload: MatchReadyPayload) {
    try {
      await this.matchReadySink.onMatchReady(payload)
      this.logMatchmakingEvent('match_ready', null, { proposalId: proposal.proposalId, matchId: payload.matchId })
    } catch (error) {
      const now = this.clock.now().toISOString()
      await this.matchmakingRepository.withTransaction(async (transaction) => {
        const current = await this.requireProposalForUpdate(transaction, proposal.proposalId)
        await transaction.updateProposal({
          ...current,
          status: 'failed',
          resolvedAt: now,
        })

        for (const member of current.members) {
          const request = await transaction.getRequestByIdForUpdate(member.requestId)

          if (request) {
            await transaction.updateRequest({
              ...request,
              status: 'failed',
              terminalOutcome: 'failed',
              activeProposalId: null,
            })
          }
        }
      }).catch((persistenceError) => {
        this.handlePostgresError(persistenceError)
        throw persistenceError
      })

      throw error
    }
  }

  private async createOrReuseActiveRequest(
    requester: MatchmakingRequester,
    queue: MatchmakingQueueIdentity,
    request: CreateMatchmakingRequest,
    now: string,
  ) {
    try {
      return await this.matchmakingRepository.withTransaction(async (transaction) => {
        const existing = await transaction.getActiveRequestByRequesterForUpdate(requester)

        if (existing) {
          if (!hasSameQueueIdentity(existing, queue)) {
            this.throwMatchmakingError('ALREADY_QUEUED', HttpStatus.CONFLICT)
          }

          return existing
        }

        const created: DurableMatchmakingRequest = {
          requestId: this.idGenerator.nextId(),
          requesterType: requester.type,
          requesterId: requester.id,
          gameId: queue.gameId,
          queueKey: buildQueueKey(queue),
          queueType: queue.queueType,
          platform: queue.platform,
          region: queue.region,
          gameVersion: queue.gameVersion,
          protocolVersion: queue.protocolVersion,
          status: 'queued',
          requestedAt: now,
          cancelledAt: null,
          matchedAt: null,
          expiresAt: this.extendRequestExpiry(now),
          terminalOutcome: null,
          sourceLobbyId: request.sourceLobbyId?.trim() || null,
          activeProposalId: null,
        }

        await transaction.createRequest(created)
        return created
      })
    } catch (error) {
      if (!(error instanceof HttpException)) {
        const existing = await this.matchmakingRepository.getActiveRequestByRequester(requester).catch((lookupError) => {
          this.handlePostgresError(lookupError)
          throw lookupError
        })

        if (existing) {
          if (!hasSameQueueIdentity(existing, queue)) {
            this.throwMatchmakingError('ALREADY_QUEUED', HttpStatus.CONFLICT)
          }

          return existing
        }

        if (this.isUniqueViolation(error)) {
          this.throwMatchmakingError('MATCHMAKING_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
        }
      }

      this.handlePostgresError(error)
      throw error
    }
  }

  private async requeueRequestsById(requestIds: string[]) {
    for (const requestId of requestIds) {
      const request = await this.matchmakingRepository.getRequestById(requestId).catch((error) => {
        this.handlePostgresError(error)
        throw error
      })

      if (!request || request.status !== 'queued') {
        continue
      }

      await this.tryEnsureQueuedRuntime(request)
      await this.triggerQueueCycle(request.queueKey)
    }
  }

  private isUniqueViolation(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
  }

  private toMatchReadyPayload(
    proposal: DurableMatchProposalAggregate,
    participants: MatchReadyPayload['participants'],
    matchId: string,
  ): MatchReadyPayload {
    return {
      matchId,
      proposalId: proposal.proposalId,
      gameId: proposal.gameId,
      queueType: proposal.queueType,
      region: proposal.region,
      gameVersion: proposal.gameVersion,
      protocolVersion: proposal.protocolVersion,
      platform: proposal.platform,
      participants,
    }
  }

  private toRequester(identity: MatchmakingRequestIdentity): MatchmakingRequester {
    return {
      type: 'player',
      id: identity.playerId,
    }
  }

  private extendRequestExpiry(now: string) {
    return new Date(new Date(now).getTime() + MATCH_REQUEST_EXPIRY_WINDOW_MS).toISOString()
  }

  private handlePostgresError(error: unknown) {
    if (isPostgresDependencyError(error)) {
      logDependencyDown('postgres', error, 'MatchmakingService')
      this.throwMatchmakingError('MATCHMAKING_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE)
    }
  }

  private throwMatchmakingError(code: MatchmakingErrorCode, status: HttpStatus): never {
    throw new HttpException({ code }, status)
  }

  private logMatchmakingEvent(event: string, identity: MatchmakingRequestIdentity | null, details: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        timestamp: this.clock.now().toISOString(),
        level: 'log',
        context: 'MatchmakingService',
        event,
        requestId: identity?.requestId ?? null,
        playerId: identity?.playerId ?? null,
        ...details,
      }),
    )
  }
}