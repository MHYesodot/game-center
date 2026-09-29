export function advanceScore(score: number, delta: number, incrementPerFrame: number) {
  return score + incrementPerFrame * delta
}

export function calculateSpeedMultiplier(score: number, speedDivisor: number, initialMultiplier: number) {
  return initialMultiplier + score / speedDivisor
}

export function resetScoreState(initialMultiplier: number) {
  return {
    score: 0,
    speedMultiplier: initialMultiplier,
  }
}