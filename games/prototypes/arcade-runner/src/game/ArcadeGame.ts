import { createInitialGameState } from './GameState'
import { gameConfig } from './game.config'
import { intersects } from '../systems/CollisionSystem'
import { resolvePlayerX } from '../systems/MovementSystem'
import { advanceScore, calculateSpeedMultiplier, resetScoreState } from '../systems/ScoreSystem'
import type { ControlState, GameState } from '../types/game.types'

export class ArcadeGame {
  private readonly state: GameState
  private readonly randomInt: (maxExclusive: number) => number

  constructor(randomInt: (maxExclusive: number) => number = Math.random) {
    this.randomInt = randomInt
    this.state = createInitialGameState()
  }

  update(controls: ControlState, delta: number) {
    this.state.player.x = resolvePlayerX(
      this.state.player.x,
      controls,
      delta,
      gameConfig.movement.speedPerFrame,
      gameConfig.movement.minPlayerX,
      gameConfig.movement.maxPlayerX,
    )

    this.state.score = advanceScore(
      this.state.score,
      delta,
      gameConfig.scoring.baseIncrementPerFrame,
    )
    this.state.speedMultiplier = calculateSpeedMultiplier(
      this.state.score,
      gameConfig.scoring.speedDivisor,
      gameConfig.scoring.initialSpeedMultiplier,
    )

    for (const obstacle of this.state.obstacles) {
      obstacle.y += obstacle.speed * this.state.speedMultiplier * delta

      if (obstacle.y > gameConfig.canvas.height + gameConfig.obstacles.recycleBottomOffset) {
        obstacle.y = gameConfig.obstacles.recycleTopY
        obstacle.x = this.getRandomLaneX()
      }

      if (intersects(this.state.player, obstacle)) {
        const resetState = resetScoreState(gameConfig.scoring.initialSpeedMultiplier)
        this.state.score = resetState.score
        this.state.speedMultiplier = resetState.speedMultiplier
        obstacle.y = gameConfig.obstacles.recycleTopY
      }
    }
  }

  getState() {
    return this.state
  }

  private getRandomLaneX() {
    return (
      gameConfig.lanes.startX +
      Math.floor(this.randomInt(gameConfig.lanes.laneCount)) * gameConfig.lanes.laneSpacing
    )
  }
}