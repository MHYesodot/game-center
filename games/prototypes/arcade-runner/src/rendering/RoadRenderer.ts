import { gameConfig } from '../game/game.config'

export function renderRoad(context: CanvasRenderingContext2D, canvasHeight: number) {
  context.strokeStyle = gameConfig.rendering.roadStroke
  context.lineWidth = gameConfig.lanes.strokeWidth

  for (let lane = 1; lane <= gameConfig.lanes.laneCount; lane += 1) {
    const x = lane * gameConfig.lanes.laneSpacing
    context.setLineDash([...gameConfig.lanes.dashPattern])
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, canvasHeight)
    context.stroke()
  }

  context.setLineDash([])
}