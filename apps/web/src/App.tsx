import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useParams } from 'react-router-dom'
import { formatNumber, getTextDirection, translate, translateList, type SupportedLocale } from '@game-center/i18n'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

type GameCategory = 'Board' | 'Arcade' | '3D Simulation'
type GameCategoryKey = 'board' | 'arcade' | 'simulation3d'

type GameSeed = {
  gameId: string
  slug: string
  categoryKey: GameCategoryKey
  launchCommand: string
}

type Game = GameSeed & {
  name: string
  category: GameCategory
  tagline: string
  description: string
  playerRange: string
  sessionModes: string[]
  techStack: string[]
  lobbyTheme: string
  clientSurface: string
  serverFocus: string
}

const gameSeeds: GameSeed[] = [
  {
    gameId: 'signal-grid',
    slug: 'signal-grid',
    categoryKey: 'board',
    launchCommand: 'npm run dev:prototype:board',
  },
  {
    gameId: 'rush-lane',
    slug: 'rush-lane',
    categoryKey: 'arcade',
    launchCommand: 'npm run dev:prototype:arcade',
  },
  {
    gameId: 'aether-flight',
    slug: 'aether-flight',
    categoryKey: 'simulation3d',
    launchCommand: 'npm run dev:prototype:sim',
  },
]

const categoryOrder: GameCategory[] = ['Board', 'Arcade', '3D Simulation']
const categoryKeyByLabel: Record<GameCategory, GameCategoryKey> = {
  Board: 'board',
  Arcade: 'arcade',
  '3D Simulation': 'simulation3d',
}

function App({ locale }: { locale: SupportedLocale }) {
  return (
    <BrowserRouter>
      <GameCenter locale={locale} />
    </BrowserRouter>
  )
}

function GameCenter({ locale }: { locale: SupportedLocale }) {
  const { games, source } = useGameCatalog(locale)
  const direction = getTextDirection(locale)

  return (
    <div className="app-shell" dir={direction}>
      <header className="topbar">
        <Link className="brand" to="/">
          <span aria-label={translate(locale, 'common.brand.title')} className="brand-mark">
            {translate(locale, 'common.brand.mark')}
          </span>
          <span>
            <strong>{translate(locale, 'common.brand.title')}</strong>
            <small>{translate(locale, 'common.brand.subtitle')}</small>
          </span>
        </Link>
        <nav className="topnav">
          {categoryOrder.map((category) => (
            <a key={category} href={`#${category.toLowerCase().replace(/\s+/g, '-')}`}>
              {translate(locale, `navigation.categories.${categoryKeyByLabel[category]}`)}
            </a>
          ))}
        </nav>
        <div className="source-pill">
          {translate(locale, 'catalog.source.label', {
            source: translate(locale, source === 'live service' ? 'catalog.source.liveService' : 'catalog.source.localPreview'),
          })}
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage games={games} locale={locale} />} />
        <Route path="/game/:slug" element={<GameLobbyPage games={games} locale={locale} />} />
      </Routes>
    </div>
  )
}

function HomePage({ games, locale }: { games: Game[]; locale: SupportedLocale }) {
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
          <p className="eyebrow">{translate(locale, 'catalog.hero.eyebrow')}</p>
          <h1>{translate(locale, 'catalog.hero.title')}</h1>
          <p className="hero-text">{translate(locale, 'catalog.hero.body')}</p>
          <div className="hero-actions">
            <Link className="primary-action" to="/game/signal-grid">
              {translate(locale, 'catalog.hero.featuredAction')}
            </Link>
            <a className="secondary-action" href="#catalog">
              {translate(locale, 'common.actions.browseCategories')}
            </a>
          </div>
        </div>

        <div className="hero-stack">
          <article>
            <span>{translate(locale, 'catalog.highlights.mainLobby.index')}</span>
            <h2>{translate(locale, 'catalog.highlights.mainLobby.title')}</h2>
            <p>{translate(locale, 'catalog.highlights.mainLobby.body')}</p>
          </article>
          <article>
            <span>{translate(locale, 'catalog.highlights.gameLobbies.index')}</span>
            <h2>{translate(locale, 'catalog.highlights.gameLobbies.title')}</h2>
            <p>{translate(locale, 'catalog.highlights.gameLobbies.body')}</p>
          </article>
          <article>
            <span>{translate(locale, 'catalog.highlights.runtimeFit.index')}</span>
            <h2>{translate(locale, 'catalog.highlights.runtimeFit.title')}</h2>
            <p>{translate(locale, 'catalog.highlights.runtimeFit.body')}</p>
          </article>
        </div>
      </section>

      <section className="metrics-row">
        <div>
          <strong>{formatNumber(locale, games.length)}</strong>
          <span>{translate(locale, 'catalog.metrics.launchReadyExperiences')}</span>
        </div>
        <div>
          <strong>{formatNumber(locale, categoryOrder.length)}</strong>
          <span>{translate(locale, 'catalog.metrics.gameCategories')}</span>
        </div>
        <div>
          <strong>{translate(locale, 'catalog.metrics.platformRuntimeTitle')}</strong>
          <span>{translate(locale, 'catalog.metrics.platformRuntimeBody')}</span>
        </div>
      </section>

      <section className="featured-strip">
        {games.map((game) => (
          <Link key={game.slug} className="featured-card" to={`/game/${game.slug}`}>
            <p>{translate(locale, `navigation.categories.${game.categoryKey}`)}</p>
            <h2>{game.name}</h2>
            <span>{game.tagline}</span>
          </Link>
        ))}
      </section>

      <section className="catalog-section" id="catalog">
        {categories.map(({ category, games: categoryGames }) => (
          <div className="category-block" id={category.toLowerCase().replace(/\s+/g, '-')} key={category}>
            <div className="section-heading">
              <p className="eyebrow">{translate(locale, `navigation.categories.${categoryKeyByLabel[category]}`)}</p>
              <h2>
                {translate(locale, 'common.formats.categoryLobbies', {
                  category: translate(locale, `navigation.categories.${categoryKeyByLabel[category]}`),
                })}
              </h2>
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
                    {translate(locale, 'common.actions.openLobby')}
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

function GameLobbyPage({ games, locale }: { games: Game[]; locale: SupportedLocale }) {
  const { slug } = useParams<{ slug: string }>()
  const game = games.find((entry) => entry.slug === slug)

  if (!game) {
    return (
      <main className="page lobby-page">
        <section className="lobby-layout">
          <div className="lobby-main">
            <p className="eyebrow">{translate(locale, 'lobby.notFound.eyebrow')}</p>
            <h1>{translate(locale, 'lobby.notFound.title')}</h1>
            <Link className="primary-action" to="/">
              {translate(locale, 'common.actions.returnToMainLobby')}
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page lobby-page">
      <section className="breadcrumb-row">
        <Link to="/">{translate(locale, 'common.surfaces.mainLobby')}</Link>
        <span>{translate(locale, 'navigation.breadcrumbs.separator')}</span>
        <span>{game.name}</span>
      </section>

      <section className="lobby-layout">
        <div className="lobby-main">
          <p className="eyebrow">
            {translate(locale, 'lobby.detail.eyebrow', {
              category: translate(locale, `navigation.categories.${game.categoryKey}`),
            })}
          </p>
          <h1>{game.name}</h1>
          <p className="hero-text">{game.description}</p>

          <div className="hero-actions">
            <Link className="primary-action" to="/">
              {translate(locale, 'common.actions.backToCatalog')}
            </Link>
            <NavLink className="secondary-action" to={`/game/${game.slug}`}>
              {translate(locale, 'lobby.detail.overview')}
            </NavLink>
          </div>

          <div className="command-panel">
            <div>
              <span className="command-label">{translate(locale, 'lobby.detail.clientLaunch')}</span>
              <strong>{game.launchCommand}</strong>
            </div>
            <div>
              <span className="command-label">{translate(locale, 'lobby.detail.runtime')}</span>
              <strong>{game.clientSurface}</strong>
            </div>
            <div>
              <span className="command-label">{translate(locale, 'lobby.detail.serverFocus')}</span>
              <strong>{game.serverFocus}</strong>
            </div>
          </div>
        </div>

        <aside className="lobby-sidebar">
          <div className="sidebar-card accent-card">
            <p className="eyebrow">{translate(locale, 'lobby.detail.profile')}</p>
            <h2>{game.lobbyTheme}</h2>
            <p>{game.tagline}</p>
          </div>

          <div className="sidebar-card">
            <h2>{translate(locale, 'lobby.detail.modes')}</h2>
            <ul className="detail-list">
              {game.sessionModes.map((mode) => (
                <li key={mode}>{mode}</li>
              ))}
            </ul>
          </div>

          <div className="sidebar-card">
            <h2>{translate(locale, 'lobby.detail.stack')}</h2>
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

type RemoteCatalogGame = {
  gameId: string
  slug?: string
  name: string
  summary?: string
  category?: string
  manifest?: {
    category?: string
  }
}

const categoryLabels: Record<string, GameCategory> = {
  board: 'Board',
  arcade: 'Arcade',
  simulation: '3D Simulation',
  '3d': '3D Simulation',
}

const categoryKeyByCatalogCategory: Record<string, GameCategoryKey> = {
  board: 'board',
  arcade: 'arcade',
  simulation: 'simulation3d',
  '3d': 'simulation3d',
}

function localizeGame(seed: GameSeed, locale: SupportedLocale): Game {
  const category = categoryLabels[seed.categoryKey === 'simulation3d' ? 'simulation' : seed.categoryKey]

  return {
    ...seed,
    name: translate(locale, `catalog.gameMeta.names.${seed.gameId}`),
    category,
    tagline: translate(locale, `catalog.gameMeta.tagline.${seed.gameId}`),
    description: translate(locale, `catalog.gameMeta.descriptions.${seed.gameId}`),
    playerRange: translate(
      locale,
      `catalog.gameMeta.playerRange.${seed.categoryKey === 'simulation3d' ? 'simulation' : seed.categoryKey}`,
    ),
    sessionModes: translateList(locale, `catalog.gameMeta.sessionModes.${seed.gameId}`),
    techStack: translateList(locale, `catalog.gameMeta.techStack.${seed.gameId}`),
    lobbyTheme: translate(locale, `catalog.gameMeta.lobbyTheme.${seed.gameId}`),
    clientSurface: translate(locale, `catalog.gameMeta.clientSurface.${seed.gameId}`),
    serverFocus: translate(locale, `catalog.gameMeta.serverFocus.${seed.gameId}`),
  }
}

function mergeRemoteCatalogGameWithLocale(
  remoteGame: RemoteCatalogGame,
  locale: SupportedLocale,
): Game | null {
  const fallbackSeed =
    gameSeeds.find((game) => game.gameId === remoteGame.gameId) ??
    gameSeeds.find((game) => game.slug === remoteGame.slug)

  if (!fallbackSeed) {
    return null
  }

  const fallbackGame = localizeGame(fallbackSeed, locale)
  const category = remoteGame.manifest?.category ?? remoteGame.category

  return {
    ...fallbackGame,
    slug: remoteGame.slug ?? fallbackGame.slug,
    category: category ? categoryLabels[category] ?? fallbackGame.category : fallbackGame.category,
    categoryKey: category ? categoryKeyByCatalogCategory[category] ?? fallbackGame.categoryKey : fallbackGame.categoryKey,
  }
}

function useGameCatalog(locale: SupportedLocale) {
  const [games, setGames] = useState<Game[]>(() => gameSeeds.map((game) => localizeGame(game, locale)))
  const [source, setSource] = useState('local preview')

  useEffect(() => {
    setGames(gameSeeds.map((game) => localizeGame(game, locale)))
  }, [locale])

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

        const payload = (await response.json()) as { games?: RemoteCatalogGame[] } | RemoteCatalogGame[]
        const remoteGames = Array.isArray(payload) ? payload : payload.games

        if (remoteGames && remoteGames.length > 0) {
          const mergedGames = remoteGames
            .map((game) => mergeRemoteCatalogGameWithLocale(game, locale))
            .filter((game): game is Game => game !== null)

          if (mergedGames.length > 0) {
            setGames(mergedGames)
            setSource('live service')
          }
        }
      } catch {
        setSource('local preview')
      }
    }

    void loadGames()

    return () => controller.abort()
  }, [locale])

  return { games, source }
}

export default App
