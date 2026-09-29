export class ViewportInput {
  constructor(target: Window, onResize: () => void) {
    target.addEventListener('resize', onResize)
  }
}