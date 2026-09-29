export class ArcadeHud {
  readonly element: HTMLDivElement
  private readonly speedValue: HTMLElement
  private readonly scoreValue: HTMLElement

  constructor(labels: { speed: string; score: string }) {
    this.element = document.createElement('div')
    this.element.className = 'hud-card'

    this.speedValue = document.createElement('strong')
    this.scoreValue = document.createElement('strong')

    const speedLabel = document.createElement('span')
    speedLabel.textContent = labels.speed
    const scoreLabel = document.createElement('span')
    scoreLabel.textContent = labels.score

    this.element.append(speedLabel, this.speedValue, scoreLabel, this.scoreValue)
  }

  update(values: { speed: string; score: string }) {
    this.speedValue.textContent = values.speed
    this.scoreValue.textContent = values.score
  }
}