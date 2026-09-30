import { applyDocumentLocalization } from '@game-center/game-client-core'
import { Timer } from 'three'

import { ViewportInput } from '../input/ViewportInput'
import { getFlightTranslations, getPrototypeLocale } from '../localization/PrototypeI18n'
import { ThreeSceneRenderer } from '../rendering/ThreeSceneRenderer'
import { createFlightScene } from '../scene/createScene'
import { sceneTokens } from '../scene/scene.tokens'
import { animateScene } from '../simulation/SceneAnimator'
import { calculateStageHeight } from '../simulation/simulationMath'
import { createFlightShell } from '../ui/FlightShell'

export function bootstrap() {
  const app = document.querySelector<HTMLDivElement>('#app')

  if (!app) {
    throw new Error('App root not found')
  }

  const locale = getPrototypeLocale()
  const { copy, localization } = getFlightTranslations(locale)

  applyDocumentLocalization(document.documentElement, locale, localization.direction)
  document.title = copy.documentTitle

  const shell = createFlightShell(app, copy)
  const sceneGraph = createFlightScene()
  const renderer = new ThreeSceneRenderer(shell.canvas)
  const timer = new Timer()
  timer.connect(document)

  const resize = () => {
    const width = shell.stage.clientWidth
    const height = calculateStageHeight(
      width,
      sceneTokens.resize.minHeight,
      sceneTokens.resize.maxHeight,
      sceneTokens.resize.aspectRatio,
    )

    renderer.setSize(width, height)
    sceneGraph.camera.aspect = width / height
    sceneGraph.camera.updateProjectionMatrix()
  }

  new ViewportInput(window, resize)
  resize()

  renderer.setAnimationLoop(() => {
    timer.update()
    const elapsed = timer.getElapsed()
    animateScene(sceneGraph, elapsed)
    renderer.render(sceneGraph.scene, sceneGraph.camera)
  })
}