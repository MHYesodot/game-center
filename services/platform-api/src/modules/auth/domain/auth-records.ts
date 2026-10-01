export const AUTH_SESSION_COOKIE_NAME = 'gc_session'
export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const AUTH_REALTIME_TICKET_TTL_MS = 60 * 1000
export const REALTIME_GATEWAY_SECRET_HEADER = 'x-realtime-gateway-secret'

export type DurablePlayerAccount = {
  playerId: string
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export type DurableAuthSession = {
  sessionId: string
  playerId: string
  secretHash: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  revokedAt: string | null
}

export type DurableRealtimeTicket = {
  ticketId: string
  sessionId: string
  playerId: string
  secretHash: string
  clientType: string
  clientVersion: string
  platform: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
}

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isExpired(expiresAt: string, now: string) {
  return new Date(expiresAt).getTime() <= new Date(now).getTime()
}

export function composeOpaqueToken(recordId: string, secret: string) {
  return `${recordId}.${secret}`
}

export function parseOpaqueToken(token: string) {
  const trimmed = token.trim()
  const separatorIndex = trimmed.indexOf('.')

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return null
  }

  return {
    recordId: trimmed.slice(0, separatorIndex),
    secret: trimmed.slice(separatorIndex + 1),
  }
}