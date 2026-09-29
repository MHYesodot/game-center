import { describe, expect, it } from 'vitest'

import {
  calculateRingRotationZ,
  calculateShipOffsetY,
  calculateShipRotationX,
  calculateShipRotationY,
  calculateStageHeight,
  calculateStarsRotationY,
} from './simulationMath'

describe('simulationMath', () => {
  it('keeps stage height within bounds', () => {
    expect(calculateStageHeight(500, 420, 720, 0.58)).toBe(420)
    expect(calculateStageHeight(2000, 420, 720, 0.58)).toBe(720)
  })

  it('calculates ship animation values deterministically', () => {
    expect(calculateShipRotationY(2)).toBe(1.2)
    expect(calculateShipRotationX(0)).toBe(0)
    expect(calculateShipOffsetY(0)).toBe(0)
    expect(calculateRingRotationZ(2)).toBe(0.48)
    expect(calculateStarsRotationY(2)).toBe(0.06)
  })
})