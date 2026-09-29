import type { FlightSceneGraph } from '../scene/createScene'

import {
  calculateRingRotationZ,
  calculateShipOffsetY,
  calculateShipRotationX,
  calculateShipRotationY,
  calculateStarsRotationY,
} from './simulationMath'

export type AnimatedScene = Pick<FlightSceneGraph, 'ship' | 'ring' | 'stars'>

export function animateScene(scene: AnimatedScene, elapsed: number) {
  scene.ship.rotation.y = calculateShipRotationY(elapsed)
  scene.ship.rotation.x = calculateShipRotationX(elapsed)
  scene.ship.position.y = calculateShipOffsetY(elapsed)
  scene.ring.rotation.z = calculateRingRotationZ(elapsed)
  scene.stars.rotation.y = calculateStarsRotationY(elapsed)
}