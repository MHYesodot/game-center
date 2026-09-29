export type Rectangle = {
  x: number
  y: number
  width: number
  height: number
}

export type PlayerState = Rectangle

export type ObstacleState = Rectangle & {
  speed: number
}

export type ControlState = {
  moveLeft: boolean
  moveRight: boolean
}

export type GameState = {
  player: PlayerState
  obstacles: ObstacleState[]
  score: number
  speedMultiplier: number
}