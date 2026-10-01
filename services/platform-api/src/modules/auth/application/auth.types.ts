import type { AuthSession } from '@game-center/contracts'

export type AuthenticatedPlayerContext = AuthSession & {
  sessionId: string
  requestId: string | null
}

export type AuthSessionResult = {
  session: AuthSession
  token: string
}