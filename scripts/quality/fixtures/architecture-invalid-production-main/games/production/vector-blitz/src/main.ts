const app = document.querySelector('#app')

if (!app) {
  throw new Error('missing app')
}

const state = { score: 0 }
const renderer = new WebGLRenderer()
const canvas = document.createElement('canvas')
app.appendChild(canvas)

window.addEventListener('keydown', () => {
  state.score += 1
})

function update() {
  state.score += 1
}

function render() {
  renderer.render(scene, camera)
}

function loop() {
  update()
  render()
  requestAnimationFrame(loop)
}

const extra01 = 1
const extra02 = 2
const extra03 = 3
const extra04 = 4
const extra05 = 5
const extra06 = 6
const extra07 = 7
const extra08 = 8
const extra09 = 9
const extra10 = 10
const extra11 = 11
const extra12 = 12
const extra13 = 13
const extra14 = 14
const extra15 = 15
const extra16 = 16
const extra17 = 17
const extra18 = 18
const extra19 = 19
const extra20 = 20
const extra21 = 21
void extra01
void extra02
void extra03
void extra04
void extra05
void extra06
void extra07
void extra08
void extra09
void extra10
void extra11
void extra12
void extra13
void extra14
void extra15
void extra16
void extra17
void extra18
void extra19
void extra20
void extra21

loop()