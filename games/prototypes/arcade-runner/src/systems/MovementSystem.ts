import type { ControlState } from '../types/game.types'

export function resolvePlayerX(
  currentX: number,
  controls: ControlState,
  delta: number,
  speedPerFrame: number,
  minX: number,
  maxX: number,
) {
  let nextX = currentX
  const distance = speedPerFrame * delta

  if (controls.moveLeft) {
    nextX -= distance
  }

  if (controls.moveRight) {
    nextX += distance
  }

  return Math.max(minX, Math.min(maxX, nextX))
}