import { dropToken } from '../rules/boardRules'
import {
  createInitialBoardState,
  resetBoardState,
  type ActivePlayer,
  type BoardState,
} from '../state/boardState'

export type BoardGameMessageKey =
  | 'status.ready'
  | 'status.turnLocked'
  | 'status.columnFull'
  | 'status.playerOneWon'
  | 'status.playerTwoWon'

export class BoardGame {
  private readonly state: BoardState

  constructor() {
    this.state = createInitialBoardState()
  }

  getState() {
    return this.state
  }

  reset() {
    resetBoardState(this.state)
    return 'status.ready' as BoardGameMessageKey
  }

  playColumn(column: number): BoardGameMessageKey {
    const result = dropToken(this.state, column)

    if (result.kind === 'ignored') {
      return this.state.winner === 1 ? 'status.playerOneWon' : 'status.playerTwoWon'
    }

    if (result.kind === 'column-full') {
      return 'status.columnFull'
    }

    if (result.winner) {
      return result.winner === 1 ? 'status.playerOneWon' : 'status.playerTwoWon'
    }

    return 'status.turnLocked'
  }

  getTurnLabelKey() {
    if (this.state.winner) {
      return this.state.winner === 1 ? 'player.oneWins' : 'player.twoWins'
    }

    return this.state.activePlayer === 1 ? 'player.one' : 'player.two'
  }

  getStatusMessageValues(previousColumn: number) {
    return {
      column: previousColumn + 1,
    }
  }

  getWinner(): ActivePlayer | null {
    return this.state.winner
  }
}