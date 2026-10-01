import type { Request } from 'express'

import { AUTH_SESSION_COOKIE_NAME } from '../domain/auth-records.js'

export function readSessionCookie(request: Request, cookieName = AUTH_SESSION_COOKIE_NAME) {
  const cookieHeader = request.header('cookie')

  if (!cookieHeader) {
    return null
  }

  for (const segment of cookieHeader.split(';')) {
    const [name, ...valueParts] = segment.trim().split('=')
    if (name === cookieName) {
      return decodeURIComponent(valueParts.join('='))
    }
  }

  return null
}

export function buildSessionCookie(token: string, maxAgeMs: number, secure: boolean, cookieName = AUTH_SESSION_COOKIE_NAME) {
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(Math.floor(maxAgeMs / 1000), 1)}`,
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function clearSessionCookie(secure: boolean, cookieName = AUTH_SESSION_COOKIE_NAME) {
  const parts = [
    `${cookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}