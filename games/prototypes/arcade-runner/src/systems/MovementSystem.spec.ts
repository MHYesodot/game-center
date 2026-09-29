import { describe, expect, it } from 'vitest'

import { resolvePlayerX } from './MovementSystem'

describe('resolvePlayerX', () => {
  it('moves left and clamps to the minimum bound', () => {
    expect(resolvePlayerX(62, { moveLeft: true, moveRight: false }, 1, 6, 60, 900)).toBe(60)
  })

  it('moves right and clamps to the maximum bound', () => {
    expect(resolvePlayerX(898, { moveLeft: false, moveRight: true }, 1, 6, 60, 900)).toBe(900)
  })
})