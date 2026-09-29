import './style.css'

type BoardCell = 0 | 1 | 2

const columns = 7
const rows = 6
const board: BoardCell[][] = Array.from({ length: rows }, () =>
  Array.from({ length: columns }, () => 0 as BoardCell),
)

let activePlayer: 1 | 2 = 1
let winner: 1 | 2 | null = null

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <main class="board-shell">
    <section class="board-hero">
      <div>
        <p class="eyebrow">Board game client</p>
        <h1>Signal Grid</h1>
        <p class="hero-copy">
          A standalone board client for the game center. This preview mirrors the server-side
          lobby logic with a tactical drop-token match surface.
        </p>
      </div>
      <div class="status-card">
        <span>Active turn</span>
        <strong id="turn-indicator">Commander One</strong>
        <p id="status-message">Drop a token to open the round.</p>
      </div>
    </section>

    <section class="board-layout">
      <div class="board-card">
        <div class="board-toolbar">
          <button id="reset-button" type="button">Reset match</button>
          <span>Server-ready ruleset</span>
        </div>
        <div id="board-grid" class="board-grid" aria-label="Signal Grid board"></div>
      </div>

      <aside class="side-panel">
        <article>
          <p class="eyebrow">Lobby stack</p>
          <h2>Purpose-built board surface</h2>
          <ul>
            <li>Canvas-free DOM board for crisp turn controls</li>
            <li>Ready for WebSocket state sync from the Node lobby service</li>
            <li>Authoritative winner detection already modeled server-side</li>
          </ul>
        </article>
        <article>
          <p class="eyebrow">Players</p>
          <div class="player-row">
            <span class="token token-one"></span>
            <strong>Commander One</strong>
          </div>
          <div class="player-row">
            <span class="token token-two"></span>
            <strong>Commander Two</strong>
          </div>
        </article>
      </aside>
    </section>
  </main>
`

const gridElement = document.querySelector<HTMLDivElement>('#board-grid')
const statusMessageElement = document.querySelector<HTMLParagraphElement>('#status-message')
const turnIndicatorElement = document.querySelector<HTMLElement>('#turn-indicator')
const resetButtonElement = document.querySelector<HTMLButtonElement>('#reset-button')

if (!gridElement || !statusMessageElement || !turnIndicatorElement || !resetButtonElement) {
  throw new Error('Board UI did not initialize correctly')
}

const grid = gridElement
const statusMessage = statusMessageElement
const turnIndicator = turnIndicatorElement
const resetButton = resetButtonElement

resetButton.addEventListener('click', () => {
  board.forEach((row) => row.fill(0))
  activePlayer = 1
  winner = null
  statusMessage.textContent = 'Drop a token to open the round.'
  renderBoard()
})

renderBoard()

function renderBoard() {
  grid.innerHTML = ''
  turnIndicator.textContent = winner
    ? winner === 1
      ? 'Commander One wins'
      : 'Commander Two wins'
    : activePlayer === 1
      ? 'Commander One'
      : 'Commander Two'

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cell = document.createElement('button')
      const value = board[rowIndex]![columnIndex]!

      cell.type = 'button'
      cell.className = `board-cell player-${value}`
      cell.setAttribute('aria-label', `Column ${columnIndex + 1}, row ${rowIndex + 1}`)
      cell.addEventListener('click', () => handleMove(columnIndex))
      grid.appendChild(cell)
    }
  }
}

function handleMove(column: number) {
  if (winner) {
    return
  }

  for (let row = rows - 1; row >= 0; row -= 1) {
    if (board[row]![column] === 0) {
      board[row]![column] = activePlayer

      if (hasWinner(row, column, activePlayer)) {
        winner = activePlayer
        statusMessage.textContent =
          activePlayer === 1
            ? 'Commander One sealed the grid with four in a row.'
            : 'Commander Two sealed the grid with four in a row.'
      } else {
        activePlayer = activePlayer === 1 ? 2 : 1
        statusMessage.textContent = `Column ${column + 1} locked. Awaiting next move.`
      }

      renderBoard()
      return
    }
  }

  statusMessage.textContent = `Column ${column + 1} is full. Choose another lane.`
}

function hasWinner(row: number, column: number, token: BoardCell) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]

  return directions.some(([rowDelta, columnDelta]) => {
    let count = 1
    count += countDirection(row, column, rowDelta, columnDelta, token)
    count += countDirection(row, column, -rowDelta, -columnDelta, token)
    return count >= 4
  })
}

function countDirection(
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
    currentRow < rows &&
    currentColumn >= 0 &&
    currentColumn < columns &&
    board[currentRow]![currentColumn] === token
  ) {
    total += 1
    currentRow += rowDelta
    currentColumn += columnDelta
  }

  return total
}
