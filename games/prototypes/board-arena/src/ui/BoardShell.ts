type BoardShellCopy = {
  heroEyebrow: string
  title: string
  description: string
  activeTurn: string
  resetMatch: string
  ruleset: string
  boardLabel: string
  lobbyTitle: string
  sideTitle: string
  sideItems: string[]
  playersTitle: string
  playerOne: string
  playerTwo: string
}

export type BoardShellElements = {
  grid: HTMLDivElement
  statusMessage: HTMLParagraphElement
  turnIndicator: HTMLElement
  resetButton: HTMLButtonElement
}

export function createBoardShell(appRoot: HTMLDivElement, copy: BoardShellCopy): BoardShellElements {
  appRoot.replaceChildren()

  const shell = document.createElement('main')
  shell.className = 'board-shell'

  const hero = document.createElement('section')
  hero.className = 'board-hero'

  const intro = document.createElement('div')
  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = copy.heroEyebrow
  const title = document.createElement('h1')
  title.textContent = copy.title
  const description = document.createElement('p')
  description.className = 'hero-copy'
  description.textContent = copy.description
  intro.append(eyebrow, title, description)

  const statusCard = document.createElement('div')
  statusCard.className = 'status-card'
  const statusLabel = document.createElement('span')
  statusLabel.textContent = copy.activeTurn
  const turnIndicator = document.createElement('strong')
  const statusMessage = document.createElement('p')
  statusCard.append(statusLabel, turnIndicator, statusMessage)

  hero.append(intro, statusCard)

  const layout = document.createElement('section')
  layout.className = 'board-layout'

  const boardCard = document.createElement('div')
  boardCard.className = 'board-card'
  const toolbar = document.createElement('div')
  toolbar.className = 'board-toolbar'
  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.textContent = copy.resetMatch
  const rulesetLabel = document.createElement('span')
  rulesetLabel.textContent = copy.ruleset
  toolbar.append(resetButton, rulesetLabel)

  const grid = document.createElement('div')
  grid.className = 'board-grid'
  grid.setAttribute('aria-label', copy.boardLabel)
  boardCard.append(toolbar, grid)

  const sidePanel = document.createElement('aside')
  sidePanel.className = 'side-panel'

  const overview = document.createElement('article')
  const overviewEyebrow = document.createElement('p')
  overviewEyebrow.className = 'eyebrow'
  overviewEyebrow.textContent = copy.lobbyTitle
  const overviewTitle = document.createElement('h2')
  overviewTitle.textContent = copy.sideTitle
  const overviewList = document.createElement('ul')
  copy.sideItems.forEach((item) => {
    const listItem = document.createElement('li')
    listItem.textContent = item
    overviewList.appendChild(listItem)
  })
  overview.append(overviewEyebrow, overviewTitle, overviewList)

  const players = document.createElement('article')
  const playersEyebrow = document.createElement('p')
  playersEyebrow.className = 'eyebrow'
  playersEyebrow.textContent = copy.playersTitle
  players.append(playersEyebrow, createPlayerRow('token-one', copy.playerOne), createPlayerRow('token-two', copy.playerTwo))

  sidePanel.append(overview, players)
  layout.append(boardCard, sidePanel)
  shell.append(hero, layout)
  appRoot.appendChild(shell)

  return {
    grid,
    statusMessage,
    turnIndicator,
    resetButton,
  }
}

function createPlayerRow(tokenClassName: string, label: string) {
  const row = document.createElement('div')
  row.className = 'player-row'

  const token = document.createElement('span')
  token.className = `token ${tokenClassName}`
  const name = document.createElement('strong')
  name.textContent = label

  row.append(token, name)
  return row
}