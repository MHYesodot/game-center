import * as THREE from 'three'

import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointsMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { sceneTokens } from './scene.tokens'

export function createFlightScene() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    sceneTokens.camera.fov,
    1,
    sceneTokens.camera.near,
    sceneTokens.camera.far,
  )
  camera.position.set(
    sceneTokens.camera.position.x,
    sceneTokens.camera.position.y,
    sceneTokens.camera.position.z,
  )

  const ambient = new AmbientLight(
    sceneTokens.colors.ambient,
    sceneTokens.lighting.ambientIntensity,
  )
  scene.add(ambient)

  const keyLight = new DirectionalLight(
    sceneTokens.colors.keyLight,
    sceneTokens.lighting.keyIntensity,
  )
  keyLight.position.set(
    sceneTokens.lighting.keyPosition.x,
    sceneTokens.lighting.keyPosition.y,
    sceneTokens.lighting.keyPosition.z,
  )
  scene.add(keyLight)

  const ship = new THREE.Group()

  const hull = new THREE.Mesh(
    new CapsuleGeometry(sceneTokens.ship.hullRadius, sceneTokens.ship.hullLength, 8, 16),
    new MeshStandardMaterial({
      color: sceneTokens.colors.hull,
      metalness: 0.5,
      roughness: 0.25,
    }),
  )
  hull.rotation.z = Math.PI / 2
  ship.add(hull)

  const wingGeometry = new BoxGeometry(
    sceneTokens.ship.wingWidth,
    sceneTokens.ship.wingHeight,
    sceneTokens.ship.wingDepth,
  )
  const wingMaterial = new MeshStandardMaterial({
    color: sceneTokens.colors.wing,
    emissive: sceneTokens.colors.wingEmissive,
  })
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial)
  leftWing.position.set(
    sceneTokens.ship.leftWingPosition.x,
    sceneTokens.ship.leftWingPosition.y,
    sceneTokens.ship.leftWingPosition.z,
  )
  ship.add(leftWing)

  const rightWing = leftWing.clone()
  rightWing.position.z = sceneTokens.ship.rightWingZ
  ship.add(rightWing)

  const canopy = new THREE.Mesh(
    new SphereGeometry(sceneTokens.ship.canopyRadius, 20, 20),
    new MeshStandardMaterial({
      color: sceneTokens.colors.canopy,
      transparent: true,
      opacity: 0.65,
    }),
  )
  canopy.position.set(
    sceneTokens.ship.canopyPosition.x,
    sceneTokens.ship.canopyPosition.y,
    sceneTokens.ship.canopyPosition.z,
  )
  ship.add(canopy)
  scene.add(ship)

  const starPositions = Array.from(
    { length: sceneTokens.stars.count * 3 },
    () => (Math.random() - 0.5) * sceneTokens.stars.spread,
  )
  const stars = new THREE.Points(
    new BufferGeometry().setAttribute(
      'position',
      new Float32BufferAttribute(starPositions, 3),
    ),
    new PointsMaterial({
      color: sceneTokens.colors.stars,
      size: sceneTokens.stars.size,
    }),
  )
  scene.add(stars)

  const ring = new THREE.Mesh(
    new TorusGeometry(
      sceneTokens.ring.radius,
      sceneTokens.ring.tube,
      sceneTokens.ring.radialSegments,
      sceneTokens.ring.tubularSegments,
    ),
    new MeshBasicMaterial({
      color: sceneTokens.colors.ring,
      transparent: true,
      opacity: sceneTokens.ring.opacity,
    }),
  )
  ring.rotation.x = Math.PI / 2
  scene.add(ring)

  return {
    scene,
    camera,
    ship,
    ring,
    stars,
  }
}

export type FlightSceneGraph = ReturnType<typeof createFlightScene>