import type { ActivePlayer, BoardCell, BoardState } from '../state/boardState'
import { boardConfig } from '../state/boardState'

export type MoveResult =
  | { kind: 'ignored' }
  | { kind: 'column-full' }
  | { kind: 'placed'; row: number; player: ActivePlayer; winner: ActivePlayer | null }

const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const

export function dropToken(state: BoardState, column: number): MoveResult {
  if (state.winner) {
    return { kind: 'ignored' }
  }

  for (let row = boardConfig.rows - 1; row >= 0; row -= 1) {
    if (state.board[row]![column] === 0) {
      state.board[row]![column] = state.activePlayer
      const winningPlayer = hasWinner(state.board, row, column, state.activePlayer) ? state.activePlayer : null

      if (winningPlayer) {
        state.winner = winningPlayer
      } else {
        state.activePlayer = state.activePlayer === 1 ? 2 : 1
      }

      return {
        kind: 'placed',
        row,
        player: state.board[row]![column] as ActivePlayer,
        winner: winningPlayer,
      }
    }
  }

  return { kind: 'column-full' }
}

export function hasWinner(board: BoardCell[][], row: number, column: number, token: BoardCell) {
  return directions.some(([rowDelta, columnDelta]) => {
    let count = 1
    count += countDirection(board, row, column, rowDelta, columnDelta, token)
    count += countDirection(board, row, column, -rowDelta, -columnDelta, token)
    return count >= 4
  })
}

export function countDirection(
  board: BoardCell[][],
  row: number,
  column: number,
  rowDelta: number,
  columnDelta: number,
  token: BoardCell,
) {
  let total = 0
  let currentRow = row + rowDelta
  let currentColumn = column + columnDelta

  while (
    currentRow >= 0 &&
    currentRow < boardConfig.rows &&
    currentColumn >= 0 &&
    currentColumn < boardConfig.columns &&
    board[currentRow]![currentColumn] === token
  ) {
    total += 1
    currentRow += rowDelta
    currentColumn += columnDelta
  }

  return total
}