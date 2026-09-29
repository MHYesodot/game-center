import { gameConfig } from '../game/game.config'
import { renderRoad } from './RoadRenderer'
import type { GameState } from '../types/game.types'

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D
  private readonly canvas: HTMLCanvasElement

  constructor(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    this.context = context
    this.canvas = canvas
  }

  render(state: GameState) {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const background = this.context.createLinearGradient(0, 0, 0, this.canvas.height)
    background.addColorStop(0, gameConfig.rendering.backgroundTop)
    background.addColorStop(1, gameConfig.rendering.backgroundBottom)
    this.context.fillStyle = background
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height)

    renderRoad(this.context, this.canvas.height)

    this.context.fillStyle = gameConfig.rendering.playerColor
    this.context.fillRect(
      state.player.x - state.player.width / 2,
      state.player.y - state.player.height / 2,
      state.player.width,
      state.player.height,
    )

    this.context.fillStyle = gameConfig.rendering.obstacleColor
    state.obstacles.forEach((obstacle) => {
      this.context.fillRect(obstacle.x - obstacle.width / 2, obstacle.y, obstacle.width, obstacle.height)
    })
  }
}