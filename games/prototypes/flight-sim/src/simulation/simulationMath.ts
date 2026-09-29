export function calculateShipRotationY(elapsed: number) {
  return elapsed * 0.6
}

export function calculateShipRotationX(elapsed: number) {
  return Math.sin(elapsed * 0.8) * 0.16
}

export function calculateShipOffsetY(elapsed: number) {
  return Math.sin(elapsed * 1.2) * 0.18
}

export function calculateRingRotationZ(elapsed: number) {
  return elapsed * 0.24
}

export function calculateStarsRotationY(elapsed: number) {
  return elapsed * 0.03
}

export function calculateStageHeight(width: number, minHeight: number, maxHeight: number, ratio: number) {
  return Math.max(minHeight, Math.min(maxHeight, Math.floor(width * ratio)))
}