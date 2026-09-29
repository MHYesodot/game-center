import './style.css'
import * as THREE from 'three'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <main class="sim-shell">
    <section class="sim-header">
      <div>
        <p class="eyebrow">3D simulation client</p>
        <h1>Aether Flight</h1>
        <p>
          A dedicated Three.js mission bay for high-resolution simulation previews. This is
          separate from React so the rendering loop and scene graph stay focused on 3D runtime needs.
        </p>
      </div>
      <div class="sim-stats">
        <span>Mission</span>
        <strong>Low Orbit Survey</strong>
        <span>Squad status</span>
        <strong>3 pilots linked</strong>
      </div>
    </section>

    <section class="sim-stage">
      <canvas id="sim-canvas"></canvas>
      <div class="sim-overlay">
        <div>
          <span>Telemetry</span>
          <strong>Stable vector lock</strong>
        </div>
        <div>
          <span>Environment</span>
          <strong>Upper atmosphere</strong>
        </div>
      </div>
    </section>
  </main>
`

const canvasElement = document.querySelector<HTMLCanvasElement>('#sim-canvas')

if (!canvasElement) {
  throw new Error('Simulation canvas not found')
}

const canvas = canvasElement

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100)
camera.position.set(0, 2.2, 8)

const ambient = new THREE.AmbientLight(0xa9d8ff, 1.2)
scene.add(ambient)

const keyLight = new THREE.DirectionalLight(0xffcc88, 1.8)
keyLight.position.set(4, 6, 3)
scene.add(keyLight)

const ship = new THREE.Group()

const hull = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.7, 2.8, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0xd4e7ff, metalness: 0.5, roughness: 0.25 }),
)
hull.rotation.z = Math.PI / 2
ship.add(hull)

const wingGeometry = new THREE.BoxGeometry(2.2, 0.08, 0.8)
const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x6bd6ff, emissive: 0x0c3d55 })
const leftWing = new THREE.Mesh(wingGeometry, wingMaterial)
leftWing.position.set(0, 0.25, -0.85)
ship.add(leftWing)

const rightWing = leftWing.clone()
rightWing.position.z = 0.85
ship.add(rightWing)

const canopy = new THREE.Mesh(
  new THREE.SphereGeometry(0.45, 20, 20),
  new THREE.MeshStandardMaterial({ color: 0x9de6ff, transparent: true, opacity: 0.65 }),
)
canopy.position.set(0.5, 0.38, 0)
ship.add(canopy)

scene.add(ship)

const stars = new THREE.Points(
  new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      Array.from({ length: 450 }, () => (Math.random() - 0.5) * 40),
      3,
    ),
  ),
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.04 }),
)
scene.add(stars)

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.8, 0.05, 12, 80),
  new THREE.MeshBasicMaterial({ color: 0x6bd6ff, transparent: true, opacity: 0.55 }),
)
ring.rotation.x = Math.PI / 2
scene.add(ring)

const clock = new THREE.Clock()

window.addEventListener('resize', resize)
resize()
renderer.setAnimationLoop(render)

function resize() {
  const stage = canvas.parentElement

  if (!stage) {
    return
  }

  const width = stage.clientWidth
  const height = Math.max(420, Math.min(720, Math.floor(width * 0.58)))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function render() {
  const elapsed = clock.getElapsedTime()
  ship.rotation.y = elapsed * 0.6
  ship.rotation.x = Math.sin(elapsed * 0.8) * 0.16
  ship.position.y = Math.sin(elapsed * 1.2) * 0.18
  ring.rotation.z = elapsed * 0.24
  stars.rotation.y = elapsed * 0.03

  renderer.render(scene, camera)
}
