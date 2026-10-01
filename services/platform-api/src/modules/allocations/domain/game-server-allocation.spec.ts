import { describe, expect, it } from 'vitest'

import {
  canReleaseAllocation,
  canTransitionAllocation,
  hasUsableConnection,
  isActiveAllocationStatus,
  isAllocationTerminal,
  materializeAllocationStatus,
  type DurableGameServerAllocation,
} from './game-server-allocation.js'

describe('game server allocation domain', () => {
  it('accepts only legal state transitions', () => {
    expect(canTransitionAllocation('requested', 'provisioning')).toBe(true)
    expect(canTransitionAllocation('requested', 'ready')).toBe(true)
    expect(canTransitionAllocation('ready', 'released')).toBe(false)
    expect(canTransitionAllocation('released', 'ready')).toBe(false)
  })

  it('materializes requested and provisioning allocations to expired on access', () => {
    expect(materializeAllocationStatus(buildAllocation({ status: 'requested' }), '2026-10-01T10:06:00.000Z')).toBe('expired')
    expect(materializeAllocationStatus(buildAllocation({ status: 'provisioning' }), '2026-10-01T10:06:00.000Z')).toBe('expired')
    expect(materializeAllocationStatus(buildAllocation({ status: 'ready' }), '2026-10-01T10:06:00.000Z')).toBe('ready')
  })

  it('exposes usable connection data only for ready allocations', () => {
    expect(hasUsableConnection(buildAllocation({ status: 'ready' }))).toBe(true)
    expect(hasUsableConnection(buildAllocation({ status: 'provisioning', connection: null }))).toBe(false)
  })

  it('keeps release idempotency and terminal checks explicit', () => {
    expect(canReleaseAllocation('ready')).toBe(true)
    expect(canReleaseAllocation('released')).toBe(true)
    expect(canReleaseAllocation('requested')).toBe(false)
    expect(isActiveAllocationStatus('releasing')).toBe(true)
    expect(isAllocationTerminal('released')).toBe(true)
    expect(isAllocationTerminal('releasing')).toBe(false)
  })
})

function buildAllocation(overrides: Partial<DurableGameServerAllocation> = {}): DurableGameServerAllocation {
  return {
    allocationId: 'allocation-1',
    sessionId: 'session-1',
    provider: 'test',
    providerReference: 'provider-ref-1',
    status: 'ready',
    gameId: 'signal-grid',
    gameVersion: '0.1.0-prototype',
    protocolVersion: 'v1',
    buildVersion: 'prototype',
    serverType: 'dedicated',
    runtimeType: 'container',
    runtimeProfile: 'dedicated-server',
    region: null,
    participantCapacity: 2,
    requestedAt: '2026-10-01T10:00:00.000Z',
    provisioningAt: '2026-10-01T10:00:05.000Z',
    readyAt: '2026-10-01T10:00:30.000Z',
    failedAt: null,
    releasingAt: null,
    releasedAt: null,
    expiresAt: '2026-10-01T10:05:00.000Z',
    failureCode: null,
    connection: {
      transport: 'websocket',
      host: 'signal-grid.dev',
      port: 443,
      secure: true,
      protocolVersion: 'v1',
      tokenReference: 'token-ref-1',
      expiresAt: '2026-10-01T10:15:00.000Z',
    },
    ...overrides,
  }
}