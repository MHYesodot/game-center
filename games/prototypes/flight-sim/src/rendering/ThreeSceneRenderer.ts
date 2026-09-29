import { WebGLRenderer } from 'three'

type RenderableScene = object
type RenderableCamera = object

type RendererLike = {
  setSize(width: number, height: number, updateStyle?: boolean): void
  setAnimationLoop(callback: () => void): void
  render(scene: RenderableScene, camera: RenderableCamera): void
}

export class ThreeSceneRenderer {
  private readonly renderer: RendererLike

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false)
  }

  setAnimationLoop(callback: () => void) {
    this.renderer.setAnimationLoop(callback)
  }

  render(scene: RenderableScene, camera: RenderableCamera) {
    this.renderer.render(scene, camera)
  }
}