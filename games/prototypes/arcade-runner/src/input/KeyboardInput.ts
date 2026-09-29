import type { ControlState } from '../types/game.types'

export class KeyboardInput {
  private readonly activeKeys = new Set<string>()

  constructor(target: Window) {
    target.addEventListener('keydown', this.handleKeyDown)
    target.addEventListener('keyup', this.handleKeyUp)
  }

  getState(): ControlState {
    return {
      moveLeft: this.activeKeys.has('ArrowLeft'),
      moveRight: this.activeKeys.has('ArrowRight'),
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    this.activeKeys.add(event.key)
  }

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.activeKeys.delete(event.key)
  }
}