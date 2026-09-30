import { applyDocumentLocalization, formatNumber } from '@game-center/game-client-core'

import { ArcadeGame } from '../game/ArcadeGame'
import { KeyboardInput } from '../input/KeyboardInput'
import { getArcadeTranslations, getPrototypeLocale } from '../localization/PrototypeI18n'
import { CanvasRenderer } from '../rendering/CanvasRenderer'
import { createArcadeShell } from '../ui/ArcadeShell'

export function bootstrap() {
  const app = document.querySelector<HTMLDivElement>('#app')

  if (!app) {
    throw new Error('App root not found')
  }

  const locale = getPrototypeLocale()
  const { copy, localization } = getArcadeTranslations(locale)
  applyDocumentLocalization(document.documentElement, locale, localization.direction)
  document.title = copy.documentTitle

  const shell = createArcadeShell(app, copy)
  const renderingContext = shell.canvas.getContext('2d')

  if (!renderingContext) {
    throw new Error('Canvas context unavailable')
  }

  const game = new ArcadeGame(Math.random)
  const input = new KeyboardInput(window)
  const renderer = new CanvasRenderer(renderingContext, shell.canvas)

  let lastFrame = performance.now()

  shell.hud.update({ speed: '1.0x', score: '0' })
  renderer.render(game.getState())

  function loop(timestamp: number) {
    const delta = (timestamp - lastFrame) / 16.67
    lastFrame = timestamp

    game.update(input.getState(), delta)

    const state = game.getState()
    shell.hud.update({
      speed: `${state.speedMultiplier.toFixed(1)}x`,
      score: formatNumber(localization.locale, Math.floor(state.score)),
    })
    renderer.render(state)

    window.requestAnimationFrame(loop)
  }

  window.requestAnimationFrame(loop)
}