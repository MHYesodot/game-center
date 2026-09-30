export type DependencyName = 'postgres' | 'redis' | 'nats'

export type DependencyState = 'up' | 'down'

export type DependencyStatuses = Record<DependencyName, DependencyState>

type ErrorLike = {
  code?: string
  message?: string
  cause?: unknown
}

const postgresAvailabilityErrorCodes = new Set([
  '57P01',
  '57P02',
  '57P03',
  '53300',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'ETIMEDOUT',
])

const redisAvailabilityErrorCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', 'ETIMEDOUT'])

export function isPostgresDependencyError(error: unknown): boolean {
  if (!(error instanceof Error) && (!error || typeof error !== 'object')) {
    return false
  }

  const candidate = error as ErrorLike

  if (candidate.code && postgresAvailabilityErrorCodes.has(candidate.code)) {
    return true
  }

  const message = candidate.message?.toLowerCase() ?? ''

  if (
    message.includes('terminating connection') ||
    message.includes('connection terminated unexpectedly') ||
    message.includes('connection refused') ||
    message.includes('the database system is shutting down') ||
    message.includes('failed to connect') ||
    message.includes('connect econnrefused')
  ) {
    return true
  }

  return candidate.cause ? isPostgresDependencyError(candidate.cause) : false
}

export function logDependencyDown(dependency: DependencyName, error: unknown, context: string) {
  const candidate = error instanceof Error || (error && typeof error === 'object') ? (error as ErrorLike) : undefined
  const payload = {
    timestamp: new Date().toISOString(),
    level: 'error',
    context,
    dependency,
    state: 'down',
    message: candidate?.message ?? 'Dependency unavailable',
    code: candidate?.code,
  }

  console.error(JSON.stringify(payload))
}

export function isRedisDependencyError(error: unknown): boolean {
  if (!(error instanceof Error) && (!error || typeof error !== 'object')) {
    return false
  }

  const candidate = error as ErrorLike

  if (candidate.code && redisAvailabilityErrorCodes.has(candidate.code)) {
    return true
  }

  const message = candidate.message?.toLowerCase() ?? ''

  if (
    message.includes('connect econnrefused') ||
    message.includes('socket closed unexpectedly') ||
    message.includes('connection timeout') ||
    message.includes('the client is closed') ||
    message.includes('connection is closed')
  ) {
    return true
  }

  return candidate.cause ? isRedisDependencyError(candidate.cause) : false
}