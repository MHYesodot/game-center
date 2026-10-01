import type { DurableAuthSession, DurablePlayerAccount, DurableRealtimeTicket } from '../domain/auth-records.js'

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY')
export const AUTH_HASHER = Symbol('AUTH_HASHER')
export const AUTH_SECRET_GENERATOR = Symbol('AUTH_SECRET_GENERATOR')
export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS')

export type AuthSettings = {
  sessionTtlMs: number
  realtimeTicketTtlMs: number
}

export type SessionAccountRecord = DurableAuthSession & {
  email: string
}

export type RealtimeTicketRecord = DurableRealtimeTicket & {
  sessionExpiresAt: string
  sessionRevokedAt: string | null
}

export interface AuthRepositoryTransaction {
  createAccount(account: DurablePlayerAccount): Promise<void>
  createSession(session: DurableAuthSession): Promise<void>
  createRealtimeTicket(ticket: DurableRealtimeTicket): Promise<void>
  revokeSession(sessionId: string, revokedAt: string): Promise<void>
  touchSession(sessionId: string, lastSeenAt: string): Promise<void>
  markRealtimeTicketUsed(ticketId: string, usedAt: string): Promise<boolean>
}

export interface AuthRepository {
  getAccountByEmail(email: string): Promise<DurablePlayerAccount | null>
  getSessionAccountById(sessionId: string): Promise<SessionAccountRecord | null>
  getRealtimeTicketById(ticketId: string): Promise<RealtimeTicketRecord | null>
  withTransaction<T>(callback: (transaction: AuthRepositoryTransaction) => Promise<T>): Promise<T>
}

export interface AuthHasher {
  hash(value: string): Promise<string>
  verify(value: string, storedHash: string): Promise<boolean>
}

export interface AuthSecretGenerator {
  nextSecret(): string
}