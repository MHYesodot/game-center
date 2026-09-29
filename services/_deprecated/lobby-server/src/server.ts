import { randomUUID } from 'crypto'
import { createServer } from 'http'

import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { WebSocketServer, type WebSocket } from 'ws'

type GameSlug = 'signal-chess' | 'rush-lane' | 'aether-flight'

type GameDefinition = {
  slug: GameSlug
  name: string
  category: 'Board' | 'Arcade' | '3D Simulation'
  tagline: string
  description: string
  playerRange: string
  sessionModes: string[]
  techStack: string[]
  lobbyTheme: string
  clientSurface: string
  launchCommand: string
  serverFocus: string
}

type LobbyStatus = 'staging' | 'ready' | 'running' | 'finished'

type LobbyPlayer = {
  id: string
  name: string
  ready: boolean
}

type BoardCell = 0 | 1 | 2

type BoardState = {
  rows: number
  columns: number
  grid: BoardCell[][]
  nextPlayerId: string | null
  winnerId: string | null
  lastMove: {
    column: number
    row: number
    playerId: string
  } | null
}

type Lobby = {
  id: string
  gameSlug: GameSlug
  status: LobbyStatus
  createdAt: string
  maxPlayers: number
  players: LobbyPlayer[]
  boardState?: BoardState
}

const games: GameDefinition[] = [
  {
    slug: 'signal-chess',
    name: 'Signal Grid',
    category: 'Board',
    tagline: 'Competitive drop-token matches with authoritative turn resolution.',
    description:
      'A premium board arena for tactical play, tournament lobbies, and server-verified moves.',
    playerRange: '2 players + spectators',
    sessionModes: ['Ranked duel', 'Private table', 'Tournament bracket'],
    techStack: ['Portal lobby in React', 'Gameplay client in TypeScript', 'Server logic in Node + WebSocket'],
    lobbyTheme: 'Warm brass, tactical grid overlays, and watch-table controls.',
    clientSurface: 'Standalone board client',
    launchCommand: 'npm run dev:board',
    serverFocus: 'Authoritative board state, move validation, ready checks, and room updates.',
  },
  {
    slug: 'rush-lane',
    name: 'Rush Lane',
    category: 'Arcade',
    tagline: 'Fast reflex racing with a lightweight client loop and session hooks.',
    description:
      'A neon runner designed as a standalone canvas game with queue and leaderboard orchestration.',
    playerRange: '1 to 8 players',
    sessionModes: ['Solo sprint', 'Async challenge', 'Party heat'],
    techStack: ['Portal lobby in React', 'Gameplay client in TypeScript Canvas', 'Telemetry endpoints in Node'],
    lobbyTheme: 'High contrast HUD, queue timers, and speed-focused panels.',
    clientSurface: 'Standalone arcade client',
    launchCommand: 'npm run dev:arcade',
    serverFocus: 'Session provisioning, leaderboard ingestion, and tournament scheduling.',
  },
  {
    slug: 'aether-flight',
    name: 'Aether Flight',
    category: '3D Simulation',
    tagline: 'A cinematic 3D mission bay with room-based simulation sessions.',
    description:
      'A high-resolution simulation entry for Three.js-based mission staging and flight scenarios.',
    playerRange: '1 to 4 pilots',
    sessionModes: ['Training sortie', 'Co-op mission', 'Scenario sandbox'],
    techStack: ['Portal lobby in React', 'Gameplay client in Three.js', 'Mission service in Node'],
    lobbyTheme: 'Atmospheric command decks, mission cards, and live telemetry.',
    clientSurface: 'Standalone 3D simulation client',
    launchCommand: 'npm run dev:sim',
    serverFocus: 'Mission presets, squad lobbies, simulation metadata, and live room status.',
  },
]

const maxPlayersByGame: Record<GameSlug, number> = {
  'signal-chess': 2,
  'rush-lane': 8,
  'aether-flight': 4,
}

const app = express()
const server = createServer(app)
const socketServer = new WebSocketServer({ server, path: '/ws' })

const lobbies = new Map<string, Lobby>()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()) ?? true,
  }),
)
app.use(express.json())

seedLobbies()

app.get('/health/live', (_request: Request, response: Response) => {
  response.json({ ok: true, service: 'lobby-server', status: 'live' })
})

app.get('/health/ready', (_request: Request, response: Response) => {
  response.json({ ok: true, service: 'lobby-server', status: 'ready' })
})

app.get('/api/health', (_request: Request, response: Response) => {
  response.json({ ok: true })
})

app.get('/api/games', (_request: Request, response: Response) => {
  response.json({ games })
})

app.get('/api/games/:slug', (request: Request, response: Response) => {
  const game = games.find((entry) => entry.slug === request.params.slug)

  if (!game) {
    response.status(404).json({ error: 'Game not found' })
    return
  }

  response.json({
    game,
    activeLobbies: getLobbiesForGame(game.slug),
  })
})

app.get('/api/lobbies', (_request: Request, response: Response) => {
  response.json({ lobbies: Array.from(lobbies.values()) })
})

app.post('/api/lobbies', (request: Request, response: Response) => {
  const gameSlug = request.body?.gameSlug as GameSlug | undefined
  const hostName = request.body?.hostName as string | undefined

  if (!gameSlug || !games.some((game) => game.slug === gameSlug)) {
    response.status(400).json({ error: 'A valid gameSlug is required' })
    return
  }

  const host: LobbyPlayer = {
    id: randomUUID(),
    name: hostName?.trim() || 'Host',
    ready: false,
  }

  const lobby: Lobby = {
    id: randomUUID(),
    gameSlug,
    status: 'staging',
    createdAt: new Date().toISOString(),
    maxPlayers: maxPlayersByGame[gameSlug],
    players: [host],
    boardState: gameSlug === 'signal-chess' ? createBoardState([]) : undefined,
  }

  lobbies.set(lobby.id, lobby)
  broadcast('lobby-created', lobby)
  response.status(201).json(lobby)
})

app.post('/api/lobbies/:id/join', (request: Request, response: Response) => {
  const lobbyId = normalizeParam(request.params.id)
  const lobby = lobbyId ? lobbies.get(lobbyId) : undefined

  if (!lobby) {
    response.status(404).json({ error: 'Lobby not found' })
    return
  }

  if (lobby.players.length >= lobby.maxPlayers) {
    response.status(409).json({ error: 'Lobby is full' })
    return
  }

  const player: LobbyPlayer = {
    id: randomUUID(),
    name: request.body?.name?.trim() || `Player ${lobby.players.length + 1}`,
    ready: false,
  }

  lobby.players.push(player)

  if (lobby.boardState && !lobby.boardState.nextPlayerId && lobby.players.length >= 2) {
    lobby.boardState.nextPlayerId = lobby.players[0].id
  }

  broadcast('lobby-updated', lobby)
  response.json(lobby)
})

app.post('/api/lobbies/:id/ready', (request: Request, response: Response) => {
  const lobbyId = normalizeParam(request.params.id)
  const lobby = lobbyId ? lobbies.get(lobbyId) : undefined
  const playerId = request.body?.playerId as string | undefined

  if (!lobby || !playerId) {
    response.status(400).json({ error: 'Lobby and playerId are required' })
    return
  }

  const player = lobby.players.find((entry) => entry.id === playerId)

  if (!player) {
    response.status(404).json({ error: 'Player not found' })
    return
  }

  player.ready = typeof request.body?.ready === 'boolean' ? request.body.ready : !player.ready
  lobby.status = lobby.players.every((entry) => entry.ready) ? 'ready' : 'staging'
  broadcast('lobby-updated', lobby)
  response.json(lobby)
})

app.post('/api/lobbies/:id/board/move', (request: Request, response: Response) => {
  const lobbyId = normalizeParam(request.params.id)
  const lobby = lobbyId ? lobbies.get(lobbyId) : undefined
  const playerId = request.body?.playerId as string | undefined
  const column = Number(request.body?.column)

  if (!lobby || lobby.gameSlug !== 'signal-chess' || !lobby.boardState) {
    response.status(404).json({ error: 'Board lobby not found' })
    return
  }

  if (!playerId || Number.isNaN(column)) {
    response.status(400).json({ error: 'playerId and column are required' })
    return
  }

  if (lobby.players.length < 2) {
    response.status(409).json({ error: 'Board game requires two players' })
    return
  }

  if (lobby.boardState.winnerId) {
    response.status(409).json({ error: 'Match already finished' })
    return
  }

  if (lobby.boardState.nextPlayerId !== playerId) {
    response.status(409).json({ error: 'Not this player\'s turn' })
    return
  }

  if (column < 0 || column >= lobby.boardState.columns) {
    response.status(400).json({ error: 'Invalid column' })
    return
  }

  const activePlayers = lobby.players.slice(0, 2)
  const playerIndex = activePlayers.findIndex((entry) => entry.id === playerId)

  if (playerIndex === -1) {
    response.status(404).json({ error: 'Player is not seated for this match' })
    return
  }

  const row = findDropRow(lobby.boardState.grid, column)

  if (row === -1) {
    response.status(409).json({ error: 'Column is full' })
    return
  }

  const token = (playerIndex + 1) as BoardCell
  lobby.boardState.grid[row][column] = token
  lobby.boardState.lastMove = { column, row, playerId }
  lobby.status = 'running'

  if (hasWinner(lobby.boardState.grid, row, column, token)) {
    lobby.boardState.winnerId = playerId
    lobby.boardState.nextPlayerId = null
    lobby.status = 'finished'
  } else {
    const nextPlayer = activePlayers[(playerIndex + 1) % activePlayers.length]
    lobby.boardState.nextPlayerId = nextPlayer.id
  }

  broadcast('board-state', lobby)
  response.json(lobby)
})

socketServer.on('connection', (socket: WebSocket) => {
  socket.send(
    JSON.stringify({
      type: 'snapshot',
      payload: {
        games,
        lobbies: Array.from(lobbies.values()),
      },
    }),
  )
})

const port = Number(process.env.PORT ?? '4000')

server.listen(port, () => {
  console.log(`Lobby server listening on http://localhost:${port}`)
})

function seedLobbies() {
  const boardLobby = createSeedLobby('signal-chess', ['Commander Vega', 'Analyst Noor'])
  boardLobby.players.forEach((player, index) => {
    player.ready = true
    if (index === 0) {
      boardLobby.boardState!.nextPlayerId = player.id
    }
  })
  boardLobby.status = 'ready'

  const arcadeLobby = createSeedLobby('rush-lane', ['Nova', 'Kite', 'Lumen'])
  arcadeLobby.players[0]!.ready = true

  const simLobby = createSeedLobby('aether-flight', ['Wing Lead', 'Echo Two'])
  simLobby.players.forEach((player) => {
    player.ready = true
  })
  simLobby.status = 'ready'

  lobbies.set(boardLobby.id, boardLobby)
  lobbies.set(arcadeLobby.id, arcadeLobby)
  lobbies.set(simLobby.id, simLobby)
}

function createSeedLobby(gameSlug: GameSlug, playerNames: string[]): Lobby {
  const players = playerNames.map<LobbyPlayer>((name) => ({
    id: randomUUID(),
    name,
    ready: false,
  }))

  return {
    id: randomUUID(),
    gameSlug,
    status: 'staging',
    createdAt: new Date().toISOString(),
    maxPlayers: maxPlayersByGame[gameSlug],
    players,
    boardState: gameSlug === 'signal-chess' ? createBoardState(players.map((player) => player.id)) : undefined,
  }
}

function createBoardState(playerIds: string[]): BoardState {
  return {
    rows: 6,
    columns: 7,
    grid: Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0 as BoardCell)),
    nextPlayerId: playerIds[0] ?? null,
    winnerId: null,
    lastMove: null,
  }
}

function getLobbiesForGame(gameSlug: GameSlug) {
  return Array.from(lobbies.values()).filter((lobby) => lobby.gameSlug === gameSlug)
}

function findDropRow(grid: BoardCell[][], column: number) {
  for (let row = grid.length - 1; row >= 0; row -= 1) {
    if (grid[row]![column] === 0) {
      return row
    }
  }

  return -1
}

function hasWinner(grid: BoardCell[][], row: number, column: number, token: BoardCell) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]

  return directions.some(([rowDelta, columnDelta]) => {
    let count = 1
    count += countDirection(grid, row, column, rowDelta, columnDelta, token)
    count += countDirection(grid, row, column, -rowDelta, -columnDelta, token)
    return count >= 4
  })
}

function countDirection(
  grid: BoardCell[][],
  row: number,
  column: number,
  rowDelta: number,
  columnDelta: number,
  token: BoardCell,
) {
  let matches = 0
  let currentRow = row + rowDelta
  let currentColumn = column + columnDelta

  while (
    currentRow >= 0 &&
    currentRow < grid.length &&
    currentColumn >= 0 &&
    currentColumn < grid[0]!.length &&
    grid[currentRow]![currentColumn] === token
  ) {
    matches += 1
    currentRow += rowDelta
    currentColumn += columnDelta
  }

  return matches
}

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function broadcast(type: string, payload: unknown) {
  const message = JSON.stringify({ type, payload })

  socketServer.clients.forEach((client: WebSocket) => {
    if (client.readyState === client.OPEN) {
      client.send(message)
    }
  })
}