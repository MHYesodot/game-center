import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <main class="arcade-shell">
    <section class="arcade-header">
      <div>
        <p class="eyebrow">Arcade client</p>
        <h1>Rush Lane</h1>
        <p>
          A standalone TypeScript arcade surface built around a canvas loop rather than React.
          Use the arrow keys to dodge traffic and chase score multipliers.
        </p>
      </div>
      <div class="hud-card">
        <span>Speed</span>
        <strong id="speed-value">1.0x</strong>
        <span>Score</span>
        <strong id="score-value">0</strong>
      </div>
    </section>

    <section class="arcade-layout">
      <div class="canvas-card">
        <canvas id="game-canvas" width="960" height="540"></canvas>
      </div>
      <aside class="info-card">
        <p class="eyebrow">Loop design</p>
        <ul>
          <li>Low-overhead canvas renderer for twitch input</li>
          <li>Separate from the portal so the gameplay loop stays lean</li>
          <li>Ready for score submission to the Node service</li>
        </ul>
      </aside>
    </section>
  </main>
`

const canvasElement = document.querySelector<HTMLCanvasElement>('#game-canvas')
const speedValueElement = document.querySelector<HTMLElement>('#speed-value')
const scoreValueElement = document.querySelector<HTMLElement>('#score-value')

if (!canvasElement || !speedValueElement || !scoreValueElement) {
  throw new Error('Arcade UI did not initialize correctly')
}

const canvas = canvasElement
const speedValue = speedValueElement
const scoreValue = scoreValueElement

const renderingContext = canvas.getContext('2d')

if (!renderingContext) {
  throw new Error('Canvas context unavailable')
}

const context = renderingContext

const player = { x: canvas.width / 2, y: canvas.height - 80, width: 46, height: 72 }
const keys = new Set<string>()
const obstacles = Array.from({ length: 10 }, (_, index) => ({
  x: 120 + (index % 4) * 180,
  y: -index * 140,
  width: 48,
  height: 80,
  speed: 2 + index * 0.18,
}))

let score = 0
let speedMultiplier = 1
let lastFrame = performance.now()

window.addEventListener('keydown', (event) => {
  keys.add(event.key)
})

window.addEventListener('keyup', (event) => {
  keys.delete(event.key)
})

requestAnimationFrame(loop)

function loop(timestamp: number) {
  const delta = (timestamp - lastFrame) / 16.67
  lastFrame = timestamp

  update(delta)
  render()

  requestAnimationFrame(loop)
}

function update(delta: number) {
  const moveSpeed = 6 * delta

  if (keys.has('ArrowLeft')) {
    player.x -= moveSpeed
  }

  if (keys.has('ArrowRight')) {
    player.x += moveSpeed
  }

  player.x = Math.max(60, Math.min(canvas.width - 60, player.x))

  score += 1 * delta
  speedMultiplier = 1 + score / 800

  obstacles.forEach((obstacle) => {
    obstacle.y += obstacle.speed * speedMultiplier * delta

    if (obstacle.y > canvas.height + 80) {
      obstacle.y = -120
      obstacle.x = 120 + Math.floor(Math.random() * 4) * 180
    }

    if (intersects(player, obstacle)) {
      score = 0
      speedMultiplier = 1
      obstacle.y = -120
    }
  })

  speedValue.textContent = `${speedMultiplier.toFixed(1)}x`
  scoreValue.textContent = Math.floor(score).toString()
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height)

  const background = context.createLinearGradient(0, 0, 0, canvas.height)
  background.addColorStop(0, '#0f172f')
  background.addColorStop(1, '#04060d')
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)

  renderRoad()

  context.fillStyle = '#ff9966'
  context.fillRect(player.x - player.width / 2, player.y - player.height / 2, player.width, player.height)

  context.fillStyle = '#78d4ff'
  obstacles.forEach((obstacle) => {
    context.fillRect(obstacle.x - obstacle.width / 2, obstacle.y, obstacle.width, obstacle.height)
  })
}

function renderRoad() {
  context.strokeStyle = 'rgba(255,255,255,0.16)'
  context.lineWidth = 6

  for (let lane = 1; lane <= 4; lane += 1) {
    const x = lane * 180
    context.setLineDash([24, 24])
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, canvas.height)
    context.stroke()
  }

  context.setLineDash([])
}

function intersects(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return (
    first.x - first.width / 2 < second.x + second.width / 2 &&
    first.x + first.width / 2 > second.x - second.width / 2 &&
    first.y - first.height / 2 < second.y + second.height &&
    first.y + first.height / 2 > second.y
  )
}
