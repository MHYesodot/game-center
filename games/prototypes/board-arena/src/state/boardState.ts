export type BoardCell = 0 | 1 | 2
export type ActivePlayer = 1 | 2

export type BoardState = {
  board: BoardCell[][]
  activePlayer: ActivePlayer
  winner: ActivePlayer | null
}

export const boardConfig = {
  columns: 7,
  rows: 6,
} as const

export function createEmptyBoard() {
  return Array.from({ length: boardConfig.rows }, () =>
    Array.from({ length: boardConfig.columns }, () => 0 as BoardCell),
  )
}

export function createInitialBoardState(): BoardState {
  return {
    board: createEmptyBoard(),
    activePlayer: 1,
    winner: null,
  }
}

export function resetBoardState(state: BoardState) {
  state.board.forEach((row) => row.fill(0))
  state.activePlayer = 1
  state.winner = null
}