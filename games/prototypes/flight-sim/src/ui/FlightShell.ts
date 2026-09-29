type FlightShellCopy = {
  eyebrow: string
  title: string
  description: string
  missionLabel: string
  missionValue: string
  squadLabel: string
  squadValue: string
  telemetryLabel: string
  telemetryValue: string
  environmentLabel: string
  environmentValue: string
}

export type FlightShellElements = {
  canvas: HTMLCanvasElement
  stage: HTMLElement
}

export function createFlightShell(appRoot: HTMLDivElement, copy: FlightShellCopy): FlightShellElements {
  appRoot.replaceChildren()

  const shell = document.createElement('main')
  shell.className = 'sim-shell'

  const header = document.createElement('section')
  header.className = 'sim-header'

  const intro = document.createElement('div')
  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = copy.eyebrow
  const title = document.createElement('h1')
  title.textContent = copy.title
  const description = document.createElement('p')
  description.textContent = copy.description
  intro.append(eyebrow, title, description)

  const stats = document.createElement('div')
  stats.className = 'sim-stats'
  stats.append(
    createStat(copy.missionLabel, copy.missionValue),
    createStat(copy.squadLabel, copy.squadValue),
  )

  header.append(intro, stats)

  const stage = document.createElement('section')
  stage.className = 'sim-stage'

  const canvas = document.createElement('canvas')
  canvas.id = 'sim-canvas'
  stage.appendChild(canvas)

  const overlay = document.createElement('div')
  overlay.className = 'sim-overlay'
  overlay.append(
    createOverlayCard(copy.telemetryLabel, copy.telemetryValue),
    createOverlayCard(copy.environmentLabel, copy.environmentValue),
  )
  stage.appendChild(overlay)

  shell.append(header, stage)
  appRoot.appendChild(shell)

  return {
    canvas,
    stage,
  }
}

function createStat(label: string, value: string) {
  const fragment = document.createDocumentFragment()
  const labelElement = document.createElement('span')
  labelElement.textContent = label
  const valueElement = document.createElement('strong')
  valueElement.textContent = value
  fragment.append(labelElement, valueElement)
  return fragment
}

function createOverlayCard(label: string, value: string) {
  const card = document.createElement('div')
  const labelElement = document.createElement('span')
  labelElement.textContent = label
  const valueElement = document.createElement('strong')
  valueElement.textContent = value
  card.append(labelElement, valueElement)
  return card
}