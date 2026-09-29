import { gameConfig } from '../game/game.config'
import { ArcadeHud } from './ArcadeHud'

type ArcadeShellCopy = {
  eyebrow: string
  title: string
  description: string
  hudSpeed: string
  hudScore: string
  infoTitle: string
  infoItems: string[]
}

export type ArcadeShellElements = {
  canvas: HTMLCanvasElement
  hud: ArcadeHud
}

export function createArcadeShell(appRoot: HTMLDivElement, copy: ArcadeShellCopy): ArcadeShellElements {
  appRoot.replaceChildren()

  const shell = document.createElement('main')
  shell.className = 'arcade-shell'

  const header = document.createElement('section')
  header.className = 'arcade-header'

  const intro = document.createElement('div')
  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = copy.eyebrow
  const title = document.createElement('h1')
  title.textContent = copy.title
  const description = document.createElement('p')
  description.textContent = copy.description
  intro.append(eyebrow, title, description)

  const hud = new ArcadeHud({
    speed: copy.hudSpeed,
    score: copy.hudScore,
  })

  header.append(intro, hud.element)

  const layout = document.createElement('section')
  layout.className = 'arcade-layout'

  const canvasCard = document.createElement('div')
  canvasCard.className = 'canvas-card'

  const canvas = document.createElement('canvas')
  canvas.width = gameConfig.canvas.width
  canvas.height = gameConfig.canvas.height
  canvasCard.appendChild(canvas)

  const infoCard = document.createElement('aside')
  infoCard.className = 'info-card'

  const infoEyebrow = document.createElement('p')
  infoEyebrow.className = 'eyebrow'
  infoEyebrow.textContent = copy.infoTitle
  const infoList = document.createElement('ul')

  copy.infoItems.forEach((item) => {
    const listItem = document.createElement('li')
    listItem.textContent = item
    infoList.appendChild(listItem)
  })

  infoCard.append(infoEyebrow, infoList)
  layout.append(canvasCard, infoCard)
  shell.append(header, layout)
  appRoot.appendChild(shell)

  return {
    canvas,
    hud,
  }
}