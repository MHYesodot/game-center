import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useParams } from 'react-router-dom'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

type GameCategory = 'Board' | 'Arcade' | '3D Simulation'

type Game = {
  slug: string
  name: string
  category: GameCategory
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

const gamesCatalog: Game[] = [
  {
    slug: 'signal-chess',
    name: 'Signal Grid',
    category: 'Board',
    tagline: 'Competitive drop-token matches with authoritative turn resolution.',
    description:
      'A premium board arena for tactical play, tournament lobbies, and server-verified moves. The match layer uses server-side state validation, room readiness, and live table updates.',
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
      'A neon runner designed as a standalone canvas game. The lobby focuses on quick join, challenge timers, and leaderboard staging rather than heavy UI chrome.',
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
      'A high-resolution simulation entry built for a 3D runtime instead of React. The lobby surfaces mission settings, wing composition, and simulation readiness before launch.',
    playerRange: '1 to 4 pilots',
    sessionModes: ['Training sortie', 'Co-op mission', 'Scenario sandbox'],
    techStack: ['Portal lobby in React', 'Gameplay client in Three.js', 'Mission service in Node'],
    lobbyTheme: 'Atmospheric command decks, mission cards, and live telemetry.',
    clientSurface: 'Standalone 3D simulation client',
    launchCommand: 'npm run dev:sim',
    serverFocus: 'Mission presets, squad lobbies, simulation metadata, and live room status.',
  },
]

const categoryOrder: GameCategory[] = ['Board', 'Arcade', '3D Simulation']

function App() {
  return (
    <BrowserRouter>
      <GameCenter />
    </BrowserRouter>
  )
}

function GameCenter() {
  const { games, source } = useGameCatalog()

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">GC</span>
          <span>
            <strong>Game Center</strong>
            <small>Multi-platform lobby hub</small>
          </span>
        </Link>
        <nav className="topnav">
          {categoryOrder.map((category) => (
            <a key={category} href={`#${category.toLowerCase().replace(/\s+/g, '-')}`}>
              {category}
            </a>
          ))}
        </nav>
        <div className="source-pill">Catalog: {source}</div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage games={games} />} />
        <Route path="/game/:slug" element={<GameLobbyPage games={games} />} />
      </Routes>
    </div>
  )
}

function HomePage({ games }: { games: Game[] }) {
  const categories = useMemo(
    () =>
      categoryOrder.map((category) => ({
        category,
        games: games.filter((game) => game.category === category),
      })),
    [games],
  )

  return (
    <main className="page">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Unified platform. Purpose-built game clients.</p>
          <h1>Modern game center with a central lobby and dedicated lobbies for every title.</h1>
          <p className="hero-text">
            Discover board rooms, arcade heats, and 3D simulation bays from one command
            deck. The portal is React, but each game client is intended to run on the stack
            that best fits its gameplay and rendering needs.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" to="/game/signal-chess">
              Enter featured lobby
            </Link>
            <a className="secondary-action" href="#catalog">
              Browse categories
            </a>
          </div>
        </div>

        <div className="hero-stack">
          <article>
            <span>01</span>
            <h2>Main lobby</h2>
            <p>Cross-category discovery, live catalog, and game-specific launch plans.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Game lobbies</h2>
            <p>Each title gets its own room flow, roster controls, and tailored launch data.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Runtime fit</h2>
            <p>React for orchestration, canvas for arcade, and Three.js for simulation.</p>
          </article>
        </div>
      </section>

      <section className="metrics-row">
        <div>
          <strong>{games.length}</strong>
          <span>Launch-ready experiences</span>
        </div>
        <div>
          <strong>{categoryOrder.length}</strong>
          <span>Game categories</span>
        </div>
        <div>
          <strong>Node service</strong>
          <span>Authoritative room and session logic</span>
        </div>
      </section>

      <section className="featured-strip">
        {games.map((game) => (
          <Link key={game.slug} className="featured-card" to={`/game/${game.slug}`}>
            <p>{game.category}</p>
            <h2>{game.name}</h2>
            <span>{game.tagline}</span>
          </Link>
        ))}
      </section>

      <section className="catalog-section" id="catalog">
        {categories.map(({ category, games: categoryGames }) => (
          <div className="category-block" id={category.toLowerCase().replace(/\s+/g, '-')} key={category}>
            <div className="section-heading">
              <p className="eyebrow">{category}</p>
              <h2>{category} lobbies</h2>
            </div>

            <div className="game-grid">
              {categoryGames.map((game) => (
                <article className="game-card" key={game.slug}>
                  <div className="game-card-header">
                    <span>{game.clientSurface}</span>
                    <strong>{game.playerRange}</strong>
                  </div>
                  <h3>{game.name}</h3>
                  <p>{game.description}</p>
                  <ul className="stack-list">
                    {game.techStack.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link className="inline-link" to={`/game/${game.slug}`}>
                    Open lobby
                  </Link>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

function GameLobbyPage({ games }: { games: Game[] }) {
  const { slug } = useParams<{ slug: string }>()
  const game = games.find((entry) => entry.slug === slug)

  if (!game) {
    return (
      <main className="page lobby-page">
        <section className="lobby-layout">
          <div className="lobby-main">
            <p className="eyebrow">Lobby not found</p>
            <h1>This game lobby is not in the active catalog.</h1>
            <Link className="primary-action" to="/">
              Return to main lobby
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page lobby-page">
      <section className="breadcrumb-row">
        <Link to="/">Main lobby</Link>
        <span>/</span>
        <span>{game.name}</span>
      </section>

      <section className="lobby-layout">
        <div className="lobby-main">
          <p className="eyebrow">{game.category} game lobby</p>
          <h1>{game.name}</h1>
          <p className="hero-text">{game.description}</p>

          <div className="hero-actions">
            <Link className="primary-action" to="/">
              Back to catalog
            </Link>
            <NavLink className="secondary-action" to={`/game/${game.slug}`}>
              Lobby overview
            </NavLink>
          </div>

          <div className="command-panel">
            <div>
              <span className="command-label">Client launch</span>
              <strong>{game.launchCommand}</strong>
            </div>
            <div>
              <span className="command-label">Runtime</span>
              <strong>{game.clientSurface}</strong>
            </div>
            <div>
              <span className="command-label">Server focus</span>
              <strong>{game.serverFocus}</strong>
            </div>
          </div>
        </div>

        <aside className="lobby-sidebar">
          <div className="sidebar-card accent-card">
            <p className="eyebrow">Lobby profile</p>
            <h2>{game.lobbyTheme}</h2>
            <p>{game.tagline}</p>
          </div>

          <div className="sidebar-card">
            <h2>Modes</h2>
            <ul className="detail-list">
              {game.sessionModes.map((mode) => (
                <li key={mode}>{mode}</li>
              ))}
            </ul>
          </div>

          <div className="sidebar-card">
            <h2>Stack</h2>
            <ul className="detail-list">
              {game.techStack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  )
}

function useGameCatalog() {
  const [games, setGames] = useState<Game[]>(gamesCatalog)
  const [source, setSource] = useState('local preview')

  useEffect(() => {
    const controller = new AbortController()

    const loadGames = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/games`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as { games?: Game[] } | Game[]
        const remoteGames = Array.isArray(payload) ? payload : payload.games

        if (remoteGames && remoteGames.length > 0) {
          setGames(remoteGames)
          setSource('live service')
        }
      } catch {
        setSource('local preview')
      }
    }

    void loadGames()

    return () => controller.abort()
  }, [])

  return { games, source }
}

export default App
