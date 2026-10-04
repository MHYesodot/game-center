import { describe, expect, it } from 'vitest'

import type { AuthHasher, AuthRepository, AuthRepositoryTransaction, AuthSecretGenerator, AuthSettings, RealtimeTicketRecord, SessionAccountRecord } from './auth.ports.js'
import { AuthService } from './auth.service.js'
import type { Clock } from '../../../boundaries/clock.js'
import type { IdGenerator } from '../../../boundaries/id-generator.js'
import type { DurableAuthSession, DurablePlayerAccount, DurableRealtimeTicket } from '../domain/auth-records.js'

describe('AuthService', () => {
  it('registers a new player account and creates a session token', async () => {
    const harness = createHarness()

    const result = await harness.service.register({ email: 'Player@One.test', password: 'password-123' })

    expect(result.session.playerId).toBe('id-1')
    expect(result.session.email).toBe('player@one.test')
    expect(result.token).toContain('id-2.')
  })

  it('rejects duplicate registration by normalized email', async () => {
    const harness = createHarness({
      accounts: [
        {
          playerId: 'player-1',
          email: 'player@one.test',
          passwordHash: 'hash:password-123',
          createdAt: harnessNow,
          updatedAt: harnessNow,
        },
      ],
    })

    await expect(harness.service.register({ email: 'PLAYER@one.test', password: 'password-123' })).rejects.toMatchObject({
      response: { code: 'ACCOUNT_ALREADY_EXISTS' },
    })
  })

  it('maps a concurrent unique constraint race to account already exists', async () => {
    const harness = createHarness({ createAccountFailure: Object.assign(new Error('duplicate email'), { code: '23505' }) })

    await expect(harness.service.register({ email: 'player@one.test', password: 'password-123' })).rejects.toMatchObject({
      response: { code: 'ACCOUNT_ALREADY_EXISTS' },
    })
  })

  it('logs in an existing account and resolves an authenticated session', async () => {
    const harness = createHarness({
      accounts: [
        {
          playerId: 'player-1',
          email: 'player@one.test',
          passwordHash: 'hash:password-123',
          createdAt: harnessNow,
          updatedAt: harnessNow,
        },
      ],
    })

    const result = await harness.service.login({ email: 'player@one.test', password: 'password-123' })
    const identity = await harness.service.requireAuthenticatedSession(result.token, 'request-1')

    expect(identity).toMatchObject({
      playerId: 'player-1',
      email: 'player@one.test',
      requestId: 'request-1',
    })
  })

  it('issues a one-time realtime ticket and resolves it once', async () => {
    const harness = createHarness({
      accounts: [
        {
          playerId: 'player-1',
          email: 'player@one.test',
          passwordHash: 'hash:password-123',
          createdAt: harnessNow,
          updatedAt: harnessNow,
        },
      ],
    })

    const login = await harness.service.login({ email: 'player@one.test', password: 'password-123' })
    const identity = await harness.service.requireAuthenticatedSession(login.token, null)
    const ticket = await harness.service.issueRealtimeTicket(identity, {
      clientType: 'web',
      clientVersion: '1.0.0',
      platform: 'web',
    })

    await expect(harness.service.resolveRealtimeIdentity(ticket.ticket)).resolves.toBe('player-1')
    await expect(harness.service.resolveRealtimeIdentity(ticket.ticket)).rejects.toMatchObject({
      response: { code: 'INVALID_REALTIME_TICKET' },
    })
  })

  it('revokes a session on logout', async () => {
    const harness = createHarness({
      accounts: [
        {
          playerId: 'player-1',
          email: 'player@one.test',
          passwordHash: 'hash:password-123',
          createdAt: harnessNow,
          updatedAt: harnessNow,
        },
      ],
    })

    const login = await harness.service.login({ email: 'player@one.test', password: 'password-123' })
    await harness.service.logout(login.token)

    await expect(harness.service.requireAuthenticatedSession(login.token, null)).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_REQUIRED' },
    })
  })

  it('rejects expired sessions', async () => {
    const harness = createHarness({
      accounts: [
        {
          playerId: 'player-1',
          email: 'player@one.test',
          passwordHash: 'hash:password-123',
          createdAt: harnessNow,
          updatedAt: harnessNow,
        },
      ],
    })

    const login = await harness.service.login({ email: 'player@one.test', password: 'password-123' })
    harness.setNow('2026-11-02T12:00:00.000Z')

    await expect(harness.service.requireAuthenticatedSession(login.token, null)).rejects.toMatchObject({
      response: { code: 'AUTHENTICATION_REQUIRED' },
    })
  })

  it('rejects realtime tickets after session expiry', async () => {
    const harness = createHarness({
      accounts: [
        {
          playerId: 'player-1',
          email: 'player@one.test',
          passwordHash: 'hash:password-123',
          createdAt: harnessNow,
          updatedAt: harnessNow,
        },
      ],
    })

    const login = await harness.service.login({ email: 'player@one.test', password: 'password-123' })
    const identity = await harness.service.requireAuthenticatedSession(login.token, null)
    const ticket = await harness.service.issueRealtimeTicket(identity, {
      clientType: 'web',
      clientVersion: '1.0.0',
      platform: 'web',
    })

    harness.setNow('2026-11-02T12:00:00.000Z')

    await expect(harness.service.resolveRealtimeIdentity(ticket.ticket)).rejects.toMatchObject({
      response: { code: 'INVALID_REALTIME_TICKET' },
    })
  })
})

const harnessNow = '2026-10-01T12:00:00.000Z'

function createHarness(options: { accounts?: DurablePlayerAccount[]; createAccountFailure?: Error; now?: string } = {}) {
  const repository = new InMemoryAuthRepository(options.accounts ?? [])
  repository.createAccountFailure = options.createAccountFailure ?? null
  const hasher: AuthHasher = {
    async hash(value: string) {
      return `hash:${value}`
    },
    async verify(value: string, storedHash: string) {
      return storedHash === `hash:${value}`
    },
  }
  const secretGenerator: AuthSecretGenerator = {
    nextSecret() {
      return 'opaque-secret'
    },
  }
  const settings: AuthSettings = {
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    realtimeTicketTtlMs: 60_000,
  }
  let currentNow = options.now ?? harnessNow
  const clock: Clock = {
    now: () => new Date(currentNow),
  }
  let currentId = 0
  const idGenerator: IdGenerator = {
    nextId: () => {
      currentId += 1
      return `id-${currentId}`
    },
  }

  return {
    repository,
    service: new AuthService(repository, hasher, secretGenerator, settings, clock, idGenerator),
    setNow(now: string) {
      currentNow = now
    },
  }
}

class InMemoryAuthRepository implements AuthRepository {
  private readonly accounts = new Map<string, DurablePlayerAccount>()
  private readonly sessions = new Map<string, DurableAuthSession>()
  private readonly tickets = new Map<string, DurableRealtimeTicket>()
  createAccountFailure: Error | null = null

  constructor(accounts: DurablePlayerAccount[]) {
    for (const account of accounts) {
      this.accounts.set(account.playerId, structuredClone(account))
    }
  }

  async getAccountByEmail(email: string): Promise<DurablePlayerAccount | null> {
    for (const account of this.accounts.values()) {
      if (account.email === email) {
        return structuredClone(account)
      }
    }

    return null
  }

  async getSessionAccountById(sessionId: string): Promise<SessionAccountRecord | null> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    const account = this.accounts.get(session.playerId)
    if (!account) {
      return null
    }

    return {
      ...structuredClone(session),
      email: account.email,
    }
  }

  async getRealtimeTicketById(ticketId: string): Promise<RealtimeTicketRecord | null> {
    const ticket = this.tickets.get(ticketId)
    if (!ticket) {
      return null
    }

    const session = this.sessions.get(ticket.sessionId)
    if (!session) {
      return null
    }

    return {
      ...structuredClone(ticket),
      sessionExpiresAt: session.expiresAt,
      sessionRevokedAt: session.revokedAt,
    }
  }

  async withTransaction<T>(callback: (transaction: AuthRepositoryTransaction) => Promise<T>): Promise<T> {
    return callback({
      createAccount: async (account) => {
        if (this.createAccountFailure) {
          throw this.createAccountFailure
        }
        this.accounts.set(account.playerId, structuredClone(account))
      },
      createSession: async (session) => {
        this.sessions.set(session.sessionId, structuredClone(session))
      },
      createRealtimeTicket: async (ticket) => {
        this.tickets.set(ticket.ticketId, structuredClone(ticket))
      },
      revokeSession: async (sessionId, revokedAt) => {
        const session = this.sessions.get(sessionId)
        if (session) {
          session.revokedAt = revokedAt
        }
      },
      touchSession: async (sessionId, lastSeenAt) => {
        const session = this.sessions.get(sessionId)
        if (session) {
          session.lastSeenAt = lastSeenAt
        }
      },
      markRealtimeTicketUsed: async (ticketId, usedAt) => {
        const ticket = this.tickets.get(ticketId)
        if (!ticket || ticket.usedAt !== null) {
          return false
        }
        ticket.usedAt = usedAt
        return true
      },
    })
  }
}