import { BoardGame } from '../game/BoardGame'
import { createBoardTranslator, getPrototypeLocale, getPrototypeTextDirection } from '../localization/PrototypeI18n'
import { createBoardShell } from '../ui/BoardShell'
import { BoardRenderer } from '../ui/BoardRenderer'

export function bootstrap() {
  const app = document.querySelector<HTMLDivElement>('#app')

  if (!app) {
    throw new Error('App root not found')
  }

  const locale = getPrototypeLocale()
  const translator = createBoardTranslator(locale)
  const { copy, t } = translator

  document.documentElement.lang = locale
  document.documentElement.dir = getPrototypeTextDirection(locale)
  document.title = copy.documentTitle

  const shell = createBoardShell(app, {
    heroEyebrow: copy.heroEyebrow,
    title: copy.title,
    description: copy.description,
    activeTurn: copy.activeTurn,
    resetMatch: copy.resetMatch,
    ruleset: copy.ruleset,
    boardLabel: copy.boardLabel,
    lobbyTitle: copy.lobbyTitle,
    sideTitle: copy.sideTitle,
    sideItems: copy.sideItems,
    playersTitle: copy.playersTitle,
    playerOne: copy['player.one'],
    playerTwo: copy['player.two'],
  })

  const game = new BoardGame()
  const renderer = new BoardRenderer({
    grid: shell.grid,
    getCellLabel: (column, row) => t('board.cellLabel', { column, row }),
    onColumnSelected: (column) => {
      const messageKey = game.playColumn(column)
      const values = game.getStatusMessageValues(column)
      updateStatus(messageKey, values)
      render()
    },
  })

  shell.resetButton.addEventListener('click', () => {
    const messageKey = game.reset()
    updateStatus(messageKey)
    render()
  })

  function updateStatus(
    messageKey:
      | 'status.ready'
      | 'status.turnLocked'
      | 'status.columnFull'
      | 'status.playerOneWon'
      | 'status.playerTwoWon',
    values?: { column: number },
  ) {
    shell.statusMessage.textContent = t(messageKey, values)
    shell.turnIndicator.textContent = t(game.getTurnLabelKey())
  }

  function render() {
    renderer.render(game.getState())
  }

  updateStatus('status.ready')
  render()
}