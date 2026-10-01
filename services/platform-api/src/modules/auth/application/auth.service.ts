import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import type { AuthSession, IssueRealtimeTicketRequest, IssueRealtimeTicketResponse, LoginRequest, RegisterRequest } from '@game-center/contracts'

import { CLOCK, type Clock } from '../../../boundaries/clock.js'
import { ID_GENERATOR, type IdGenerator } from '../../../boundaries/id-generator.js'
import {
  AUTH_HASHER,
  AUTH_REPOSITORY,
  AUTH_SECRET_GENERATOR,
  AUTH_SETTINGS,
  type AuthHasher,
  type AuthRepository,
  type AuthSecretGenerator,
  type AuthSettings,
} from './auth.ports.js'
import type { AuthenticatedPlayerContext, AuthSessionResult } from './auth.types.js'
import {
  composeOpaqueToken,
  isExpired,
  normalizeAuthEmail,
  parseOpaqueToken,
  type DurableAuthSession,
  type DurablePlayerAccount,
  type DurableRealtimeTicket,
} from '../domain/auth-records.js'

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    @Inject(AUTH_HASHER) private readonly authHasher: AuthHasher,
    @Inject(AUTH_SECRET_GENERATOR) private readonly authSecretGenerator: AuthSecretGenerator,
    @Inject(AUTH_SETTINGS) private readonly authSettings: AuthSettings,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  status() {
    return { module: 'auth', status: 'ready' as const }
  }

  async register(request: RegisterRequest): Promise<AuthSessionResult> {
    const email = normalizeAuthEmail(request.email)
    const existing = await this.authRepository.getAccountByEmail(email)

    if (existing) {
      this.throwAuthError('ACCOUNT_ALREADY_EXISTS', HttpStatus.CONFLICT)
    }

    const now = this.clock.now().toISOString()
    const passwordHash = await this.authHasher.hash(request.password)
    const account: DurablePlayerAccount = {
      playerId: this.idGenerator.nextId(),
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    }

    return this.authRepository.withTransaction(async (transaction) => {
      await transaction.createAccount(account)
      return this.createSessionResult(transaction.createSession.bind(transaction), account.playerId, email, now)
    })
  }

  async login(request: LoginRequest): Promise<AuthSessionResult> {
    const email = normalizeAuthEmail(request.email)
    const account = await this.authRepository.getAccountByEmail(email)

    if (!account || !(await this.authHasher.verify(request.password, account.passwordHash))) {
      this.throwAuthError('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED)
    }

    return this.authRepository.withTransaction(async (transaction) =>
      this.createSessionResult(transaction.createSession.bind(transaction), account.playerId, account.email, this.clock.now().toISOString()),
    )
  }

  async requireAuthenticatedSession(sessionToken: string | null, requestId: string | null): Promise<AuthenticatedPlayerContext> {
    if (!sessionToken) {
      this.throwAuthError('AUTHENTICATION_REQUIRED', HttpStatus.UNAUTHORIZED)
    }

    const parsedToken = parseOpaqueToken(sessionToken)
    if (!parsedToken) {
      this.throwAuthError('AUTHENTICATION_REQUIRED', HttpStatus.UNAUTHORIZED)
    }

    const session = await this.authRepository.getSessionAccountById(parsedToken.recordId)
    const now = this.clock.now().toISOString()

    if (
      !session ||
      session.revokedAt !== null ||
      isExpired(session.expiresAt, now) ||
      !(await this.authHasher.verify(parsedToken.secret, session.secretHash))
    ) {
      this.throwAuthError('AUTHENTICATION_REQUIRED', HttpStatus.UNAUTHORIZED)
    }

    await this.authRepository.withTransaction(async (transaction) => {
      await transaction.touchSession(session.sessionId, now)
    })

    return {
      playerId: session.playerId,
      email: session.email,
      expiresAt: session.expiresAt,
      sessionId: session.sessionId,
      requestId,
    }
  }

  async logout(sessionToken: string | null): Promise<void> {
    if (!sessionToken) {
      return
    }

    const parsedToken = parseOpaqueToken(sessionToken)
    if (!parsedToken) {
      return
    }

    const session = await this.authRepository.getSessionAccountById(parsedToken.recordId)
    if (!session || !(await this.authHasher.verify(parsedToken.secret, session.secretHash))) {
      return
    }

    await this.authRepository.withTransaction(async (transaction) => {
      await transaction.revokeSession(session.sessionId, this.clock.now().toISOString())
    })
  }

  async issueRealtimeTicket(
    identity: AuthenticatedPlayerContext,
    request: IssueRealtimeTicketRequest,
  ): Promise<IssueRealtimeTicketResponse> {
    const now = this.clock.now()
    const ticketId = this.idGenerator.nextId()
    const ticketSecret = this.authSecretGenerator.nextSecret()
    const expiresAt = new Date(now.getTime() + this.authSettings.realtimeTicketTtlMs).toISOString()

    const ticket: DurableRealtimeTicket = {
      ticketId,
      sessionId: identity.sessionId,
      playerId: identity.playerId,
      secretHash: await this.authHasher.hash(ticketSecret),
      clientType: request.clientType,
      clientVersion: request.clientVersion.trim(),
      platform: request.platform,
      createdAt: now.toISOString(),
      expiresAt,
      usedAt: null,
    }

    await this.authRepository.withTransaction(async (transaction) => {
      await transaction.createRealtimeTicket(ticket)
    })

    return {
      ticket: composeOpaqueToken(ticketId, ticketSecret),
      expiresAt,
    }
  }

  async resolveRealtimeIdentity(ticketToken: string): Promise<string> {
    const parsedToken = parseOpaqueToken(ticketToken)
    if (!parsedToken) {
      this.throwAuthError('INVALID_REALTIME_TICKET', HttpStatus.UNAUTHORIZED)
    }

    const ticket = await this.authRepository.getRealtimeTicketById(parsedToken.recordId)
    const now = this.clock.now().toISOString()

    if (
      !ticket ||
      ticket.usedAt !== null ||
      ticket.sessionRevokedAt !== null ||
      isExpired(ticket.expiresAt, now) ||
      isExpired(ticket.sessionExpiresAt, now) ||
      !(await this.authHasher.verify(parsedToken.secret, ticket.secretHash))
    ) {
      this.throwAuthError('INVALID_REALTIME_TICKET', HttpStatus.UNAUTHORIZED)
    }

    const markedUsed = await this.authRepository.withTransaction(async (transaction) => transaction.markRealtimeTicketUsed(ticket.ticketId, now))
    if (!markedUsed) {
      this.throwAuthError('INVALID_REALTIME_TICKET', HttpStatus.UNAUTHORIZED)
    }

    return ticket.playerId
  }

  toAuthSession(identity: AuthenticatedPlayerContext): AuthSession {
    return {
      playerId: identity.playerId,
      email: identity.email,
      expiresAt: identity.expiresAt,
    }
  }

  private async createSessionResult(
    createSession: (session: DurableAuthSession) => Promise<void>,
    playerId: string,
    email: string,
    now: string,
  ): Promise<AuthSessionResult> {
    const sessionId = this.idGenerator.nextId()
    const sessionSecret = this.authSecretGenerator.nextSecret()
    const expiresAt = new Date(new Date(now).getTime() + this.authSettings.sessionTtlMs).toISOString()
    await createSession({
      sessionId,
      playerId,
      secretHash: await this.authHasher.hash(sessionSecret),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      revokedAt: null,
    })

    return {
      session: {
        playerId,
        email,
        expiresAt,
      },
      token: composeOpaqueToken(sessionId, sessionSecret),
    }
  }

  private throwAuthError(code: 'ACCOUNT_ALREADY_EXISTS' | 'INVALID_CREDENTIALS' | 'AUTHENTICATION_REQUIRED' | 'INVALID_REALTIME_TICKET', status: HttpStatus): never {
    throw new HttpException({ code }, status)
  }
}