import { randomUUID } from 'node:crypto'

type AuthTestSession = {
  playerId: string
  email: string
  sessionCookie: string
}

type RegisterOptions = {
  email?: string
  password?: string
}

const DEFAULT_PASSWORD = 'password-123'

export async function registerTestAccount(baseUrl: string, accountKey: string, options: RegisterOptions = {}): Promise<AuthTestSession> {
  const email = options.email ?? `${accountKey}@example.test`
  const password = options.password ?? DEFAULT_PASSWORD

  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Failed to register test account ${email}: ${response.status}`)
  }

  const body = (await response.json()) as { playerId: string; email: string }
  const setCookie = response.headers.get('set-cookie')

  if (!setCookie) {
    throw new Error(`Missing session cookie for registered test account ${email}`)
  }

  return {
    playerId: body.playerId,
    email: body.email,
    sessionCookie: setCookie.split(';', 1)[0],
  }
}

export function jsonHeaders(sessionCookie?: string) {
  return {
    'content-type': 'application/json',
    'x-request-id': randomUUID(),
    ...(sessionCookie ? { cookie: sessionCookie } : {}),
  }
}