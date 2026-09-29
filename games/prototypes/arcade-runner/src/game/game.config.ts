import type { ObstacleState, PlayerState } from '../types/game.types'

export const gameConfig = {
  canvas: {
    width: 960,
    height: 540,
  },
  movement: {
    speedPerFrame: 6,
    minPlayerX: 60,
    maxPlayerX: 900,
  },
  scoring: {
    baseIncrementPerFrame: 1,
    speedDivisor: 800,
    initialSpeedMultiplier: 1,
  },
  lanes: {
    laneCount: 4,
    laneSpacing: 180,
    startX: 120,
    dashPattern: [24, 24],
    strokeWidth: 6,
  },
  obstacles: {
    count: 10,
    recycleTopY: -120,
    recycleBottomOffset: 80,
    baseSpeed: 2,
    speedStep: 0.18,
    verticalGap: 140,
  },
  rendering: {
    backgroundTop: '#0f172f',
    backgroundBottom: '#04060d',
    playerColor: '#ff9966',
    obstacleColor: '#78d4ff',
    roadStroke: 'rgba(255,255,255,0.16)',
  },
} as const

export function createInitialPlayerState(): PlayerState {
  return {
    x: gameConfig.canvas.width / 2,
    y: gameConfig.canvas.height - 80,
    width: 46,
    height: 72,
  }
}

export function createInitialObstacles(): ObstacleState[] {
  return Array.from({ length: gameConfig.obstacles.count }, (_, index) => ({
    x: gameConfig.lanes.startX + (index % gameConfig.lanes.laneCount) * gameConfig.lanes.laneSpacing,
    y: -index * gameConfig.obstacles.verticalGap,
    width: 48,
    height: 80,
    speed: gameConfig.obstacles.baseSpeed + index * gameConfig.obstacles.speedStep,
  }))
}