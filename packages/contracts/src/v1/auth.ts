import type { RealtimeClientType, RealtimePlatform } from './realtime.js'

export type AuthSession = {
  playerId: string
  email: string
  expiresAt: string
}

export type RegisterRequest = {
  email: string
  password: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type IssueRealtimeTicketRequest = {
  clientType: RealtimeClientType
  clientVersion: string
  platform: RealtimePlatform
}

export type IssueRealtimeTicketResponse = {
  ticket: string
  expiresAt: string
}

export type AuthErrorCode =
  | 'ACCOUNT_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_REALTIME_TICKET'

export type AuthErrorResponse = {
  code: AuthErrorCode
}