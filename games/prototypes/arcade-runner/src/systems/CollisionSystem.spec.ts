import { describe, expect, it } from 'vitest'

import { intersects } from './CollisionSystem'

describe('intersects', () => {
  it('returns true when player and obstacle overlap', () => {
    expect(
      intersects(
        { x: 200, y: 460, width: 46, height: 72 },
        { x: 200, y: 430, width: 48, height: 80 },
      ),
    ).toBe(true)
  })

  it('returns false when bounds are separated', () => {
    expect(
      intersects(
        { x: 200, y: 460, width: 46, height: 72 },
        { x: 500, y: 120, width: 48, height: 80 },
      ),
    ).toBe(false)
  })
})