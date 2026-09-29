import { createInitialObstacles, createInitialPlayerState, gameConfig } from './game.config'
import type { GameState } from '../types/game.types'

export function createInitialGameState(): GameState {
  return {
    player: createInitialPlayerState(),
    obstacles: createInitialObstacles(),
    score: 0,
    speedMultiplier: gameConfig.scoring.initialSpeedMultiplier,
  }
}