import { describe, expect, it } from 'vitest'

import { calculateSpeedMultiplier, resetScoreState } from './ScoreSystem'

describe('score systems', () => {
  it('resets score and speed after a collision', () => {
    expect(resetScoreState(1)).toEqual({ score: 0, speedMultiplier: 1 })
  })

  it('scales speed from score', () => {
    expect(calculateSpeedMultiplier(400, 800, 1)).toBe(1.5)
  })
})