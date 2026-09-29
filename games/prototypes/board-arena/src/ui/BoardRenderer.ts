import { boardConfig, type BoardState } from '../state/boardState'

type BoardRendererOptions = {
  grid: HTMLDivElement
  getCellLabel: (column: number, row: number) => string
  onColumnSelected: (column: number) => void
}

export class BoardRenderer {
  private readonly grid: HTMLDivElement
  private readonly getCellLabel: (column: number, row: number) => string
  private readonly onColumnSelected: (column: number) => void

  constructor(options: BoardRendererOptions) {
    this.grid = options.grid
    this.getCellLabel = options.getCellLabel
    this.onColumnSelected = options.onColumnSelected
  }

  render(state: BoardState) {
    const cells: HTMLButtonElement[] = []

    for (let rowIndex = 0; rowIndex < boardConfig.rows; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < boardConfig.columns; columnIndex += 1) {
        const cell = document.createElement('button')
        const value = state.board[rowIndex]![columnIndex]!

        cell.type = 'button'
        cell.className = `board-cell player-${value}`
        cell.setAttribute('aria-label', this.getCellLabel(columnIndex + 1, rowIndex + 1))
        cell.addEventListener('click', () => {
          this.onColumnSelected(columnIndex)
        })
        cells.push(cell)
      }
    }

    this.grid.replaceChildren(...cells)
  }
}