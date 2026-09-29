import { describe, expect, it } from 'vitest'

import { dropToken, hasWinner } from './boardRules'
import { createInitialBoardState, createEmptyBoard } from '../state/boardState'

describe('board rules', () => {
  it('drops a token to the lowest open row in a column', () => {
    const state = createInitialBoardState()

    const result = dropToken(state, 2)

    expect(result).toEqual({ kind: 'placed', row: 5, player: 1, winner: null })
    expect(state.board[5]?.[2]).toBe(1)
  })

  it('detects a horizontal winner', () => {
    const board = createEmptyBoard()
    board[5]![0] = 1
    board[5]![1] = 1
    board[5]![2] = 1
    board[5]![3] = 1

    expect(hasWinner(board, 5, 3, 1)).toBe(true)
  })

  it('returns column-full when a column has no open cells', () => {
    const state = createInitialBoardState()

    for (let row = 0; row < 6; row += 1) {
      state.board[row]![0] = row % 2 === 0 ? 1 : 2
    }

    expect(dropToken(state, 0)).toEqual({ kind: 'column-full' })
  })
})