import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { afterEach, describe, expect, it } from 'vitest'

import { migrateCatalogDatabase } from './modules/catalog/infrastructure/persistence/catalog.persistence.js'
import { createIsolatedPostgresDatabase } from './testing/isolated-postgres-database.js'

const baseConnectionString = process.env.POSTGRES_URL

if (!baseConnectionString) {
  throw new Error('POSTGRES_URL is required for auth integration tests.')
}

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    if (cleanup) {
      await cleanup()
    }
  }
})

describe('auth http integration', () => {
  it('registers, authenticates, issues a realtime ticket, resolves it for the gateway, and logs out', async () => {
    const testApp = await createAuthTestApplication()
    cleanups.push(testApp.cleanup)

    const registerResponse = await fetch(`${testApp.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'player-one@example.test', password: 'password-123' }),
    })

    expect(registerResponse.status).toBe(201)
    const sessionCookie = expectSessionCookie(registerResponse.headers.get('set-cookie'))
    const registered = (await registerResponse.json()) as { playerId: string; email: string }
    expect(registered.email).toBe('player-one@example.test')

    const currentSession = await fetch(`${testApp.baseUrl}/api/auth/session`, {
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(currentSession.status).toBe(200)
    expect((await currentSession.json()) as { playerId: string }).toMatchObject({ playerId: registered.playerId })

    const ticketResponse = await fetch(`${testApp.baseUrl}/api/auth/realtime-ticket`, {
      method: 'POST',
      headers: {
        ...jsonHeaders(),
        cookie: sessionCookie,
      },
      body: JSON.stringify({
        clientType: 'web',
        clientVersion: '1.0.0',
        platform: 'web',
      }),
    })

    expect(ticketResponse.status).toBe(200)
    const ticketBody = (await ticketResponse.json()) as { ticket: string }
    expect(ticketBody.ticket).toContain('.')

    const resolveResponse = await fetch(`${testApp.baseUrl}/api/internal/realtime/identity/resolve`, {
      method: 'POST',
      headers: {
        ...jsonHeaders(),
        'x-realtime-gateway-secret': testApp.gatewaySecret,
      },
      body: JSON.stringify({ ticket: ticketBody.ticket }),
    })

    expect(resolveResponse.status).toBe(200)
    expect((await resolveResponse.json()) as { playerId: string }).toEqual({ playerId: registered.playerId })

    const logoutResponse = await fetch(`${testApp.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(logoutResponse.status).toBe(204)

    const afterLogout = await fetch(`${testApp.baseUrl}/api/auth/session`, {
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(afterLogout.status).toBe(401)
    expect(await afterLogout.json()).toEqual({ code: 'AUTHENTICATION_REQUIRED' })
  }, 15_000)
})

async function createAuthTestApplication() {
  const database = await createIsolatedPostgresDatabase(baseConnectionString as string, 'auth_http_test')
  const gatewaySecret = 'gateway-secret-test'

  await migrateCatalogDatabase(database.connectionString)

  const app = await createTestApplication(database.connectionString, gatewaySecret)
  const baseUrl = await listenOnRandomPort(app)

  return {
    baseUrl,
    gatewaySecret,
    cleanup: async () => {
      await app.close()
      await database.cleanup()
    },
  }
}

async function createTestApplication(connectionString: string, gatewaySecret: string) {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_URL: process.env.POSTGRES_URL,
    REDIS_URL: process.env.REDIS_URL,
    NATS_URL: process.env.NATS_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    PORT: process.env.PORT,
    AUTH_GATEWAY_SHARED_SECRET: process.env.AUTH_GATEWAY_SHARED_SECRET,
  }

  process.env.NODE_ENV = 'test'
  process.env.POSTGRES_URL = connectionString
  delete process.env.REDIS_URL
  delete process.env.NATS_URL
  delete process.env.CORS_ORIGIN
  delete process.env.PORT
  process.env.AUTH_GATEWAY_SHARED_SECRET = gatewaySecret

  const { AppModule } = await import('./app.module.js')
  const app = await NestFactory.create(AppModule, { logger: false })
  app.enableShutdownHooks()
  app.setGlobalPrefix('api')

  return {
    app,
    async close() {
      await app.close()
      restoreEnvironment(previousEnvironment)
    },
  }
}

async function listenOnRandomPort(testApplication: { app: INestApplication }) {
  await testApplication.app.listen(0, '127.0.0.1')
  return await testApplication.app.getUrl()
}

function jsonHeaders() {
  return {
    'content-type': 'application/json',
  }
}

function expectSessionCookie(setCookieHeader: string | null) {
  expect(setCookieHeader).toBeTruthy()
  return (setCookieHeader as string).split(';', 1)[0]
}

function restoreEnvironment(previousEnvironment: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}