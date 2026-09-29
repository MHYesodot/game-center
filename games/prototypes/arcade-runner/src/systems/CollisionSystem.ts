import type { Rectangle } from '../types/game.types'

export function intersects(first: Rectangle, second: Rectangle) {
  return (
    first.x - first.width / 2 < second.x + second.width / 2 &&
    first.x + first.width / 2 > second.x - second.width / 2 &&
    first.y - first.height / 2 < second.y + second.height &&
    first.y + first.height / 2 > second.y
  )
}