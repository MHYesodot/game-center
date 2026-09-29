import { describe, expect, it } from 'vitest'
import { buildGameServerAllocation, buildGameSession } from '@game-center/testing'

import { getAllocatingSessions, getReadyAllocations, getReadySessions, type SessionSnapshot } from './game-session.js'

describe('session domain helpers', () => {
  it('returns allocating sessions separately from ready ones', () => {
    const snapshot: SessionSnapshot = {
      sessions: [buildGameSession({ state: 'allocating' }), buildGameSession({ sessionId: 'session-2', state: 'ready' })],
      allocations: [buildGameServerAllocation()],
    }

    expect(getAllocatingSessions(snapshot)).toHaveLength(1)
    expect(getReadySessions(snapshot)).toHaveLength(1)
  })

  it('returns allocations that are ready to connect', () => {
    const snapshot: SessionSnapshot = {
      sessions: [buildGameSession()],
      allocations: [
        buildGameServerAllocation(),
        buildGameServerAllocation({ allocationId: 'alloc-pending', state: 'allocating' }),
      ],
    }

    expect(getReadyAllocations(snapshot)).toHaveLength(1)
  })
})