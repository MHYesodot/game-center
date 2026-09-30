import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useParams } from 'react-router-dom'
import type { CatalogErrorResponse, CatalogListResponse, GameDefinition } from '@game-center/contracts'
import { formatNumber, getTextDirection, translate, translateList, type SupportedLocale } from '@game-center/i18n'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

type GameCategoryKey = 'board' | 'arcade' | 'simulation3d'
type CatalogSource = 'liveService'
type RemoteCatalogState = {
  locale: SupportedLocale
  games: Game[]
}

type GameDetailState =
  | { status: 'loading'; game: null; errorKey: null }
  | { status: 'ready'; game: Game; errorKey: null }
  | { status: 'notFound'; game: null; errorKey: 'errors.catalog.gameNotFound' }
  | { status: 'error'; game: null; errorKey: 'errors.catalog.loadFailed' | 'errors.common.unknown' }

type GameSeed = {
  gameId: 'signal-grid' | 'rush-lane' | 'aether-flight'
  slug: string
  categoryKey: GameCategoryKey
  launchCommand: string
}

type GameLocalizationKeySet = {
  displayNameKey: string
  taglineKey: string
  descriptionKey: string
  playerRangeKey: string
  sessionModesKey: string
  techStackKey: string
  lobbyThemeKey: string
  clientSurfaceKey: string
  serverFocusKey: string
}

type Game = GameSeed & {
  name: string
  categoryLabelKey: string
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

const categoryOrder: GameCategoryKey[] = ['board', 'arcade', 'simulation3d']
const categoryAnchorByKey: Record<GameCategoryKey, string> = {
  board: 'board',
  arcade: 'arcade',
  simulation3d: '3d-simulation',
}
const categoryLabelKeyByCategory: Record<GameCategoryKey, string> = {
  board: 'navigation.categories.board',
  arcade: 'navigation.categories.arcade',
  simulation3d: 'navigation.categories.simulation3d',
}
const categoryKeyByTranslationKey: Record<string, GameCategoryKey> = {
  'navigation.categories.board': 'board',
  'navigation.categories.arcade': 'arcade',
  'navigation.categories.simulation3d': 'simulation3d',
}
const categoryKeyByCatalogCategory: Record<string, GameCategoryKey> = {
  board: 'board',
  arcade: 'arcade',
  simulation: 'simulation3d',
  '3d': 'simulation3d',
}
const gameLocalizationKeys: Record<GameSeed['gameId'], GameLocalizationKeySet> = {
  'signal-grid': {
    displayNameKey: 'catalog.gameMeta.names.signal-grid',
    taglineKey: 'catalog.gameMeta.tagline.signal-grid',
    descriptionKey: 'catalog.gameMeta.descriptions.signal-grid',
    playerRangeKey: 'catalog.gameMeta.playerRange.board',
    sessionModesKey: 'catalog.gameMeta.sessionModes.signal-grid',
    techStackKey: 'catalog.gameMeta.techStack.signal-grid',
    lobbyThemeKey: 'catalog.gameMeta.lobbyTheme.signal-grid',
    clientSurfaceKey: 'catalog.gameMeta.clientSurface.signal-grid',
    serverFocusKey: 'catalog.gameMeta.serverFocus.signal-grid',
  },
  'rush-lane': {
    displayNameKey: 'catalog.gameMeta.names.rush-lane',
    taglineKey: 'catalog.gameMeta.tagline.rush-lane',
    descriptionKey: 'catalog.gameMeta.descriptions.rush-lane',
    playerRangeKey: 'catalog.gameMeta.playerRange.arcade',
    sessionModesKey: 'catalog.gameMeta.sessionModes.rush-lane',
    techStackKey: 'catalog.gameMeta.techStack.rush-lane',
    lobbyThemeKey: 'catalog.gameMeta.lobbyTheme.rush-lane',
    clientSurfaceKey: 'catalog.gameMeta.clientSurface.rush-lane',
    serverFocusKey: 'catalog.gameMeta.serverFocus.rush-lane',
  },
  'aether-flight': {
    displayNameKey: 'catalog.gameMeta.names.aether-flight',
    taglineKey: 'catalog.gameMeta.tagline.aether-flight',
    descriptionKey: 'catalog.gameMeta.descriptions.aether-flight',
    playerRangeKey: 'catalog.gameMeta.playerRange.simulation',
    sessionModesKey: 'catalog.gameMeta.sessionModes.aether-flight',
    techStackKey: 'catalog.gameMeta.techStack.aether-flight',
    lobbyThemeKey: 'catalog.gameMeta.lobbyTheme.aether-flight',
    clientSurfaceKey: 'catalog.gameMeta.clientSurface.aether-flight',
    serverFocusKey: 'catalog.gameMeta.serverFocus.aether-flight',
  },
}
const sourceLabelKeyBySource: Record<CatalogSource, string> = {
  liveService: 'catalog.source.liveService',
}

function App({ locale }: { locale: SupportedLocale }) {
  return (
    <BrowserRouter>
      <GameCenter locale={locale} />
    </BrowserRouter>
  )
}

function GameCenter({ locale }: { locale: SupportedLocale }) {
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
          {categoryOrder.map((categoryKey) => (
            <a key={categoryKey} href={`#${categoryAnchorByKey[categoryKey]}`}>
              {translate(locale, categoryLabelKeyByCategory[categoryKey])}
            </a>
          ))}
        </nav>
        <div className="source-pill">
          {translate(locale, 'catalog.source.label', {
            source: translate(locale, sourceLabelKeyBySource.liveService),
          })}
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePageRoute locale={locale} />} />
        <Route path="/game/:slug" element={<GameLobbyPage locale={locale} />} />
      </Routes>
    </div>
  )
}

function HomePageRoute({ locale }: { locale: SupportedLocale }) {
  const { games, errorKey } = useGameCatalog(locale)

  return <HomePage games={games} locale={locale} errorKey={errorKey} />
}

function HomePage({ games, locale, errorKey }: { games: Game[]; locale: SupportedLocale; errorKey: string | null }) {
  const categories = useMemo(
    () =>
      categoryOrder.map((categoryKey) => ({
        categoryKey,
        games: games.filter((game) => game.categoryKey === categoryKey),
      })),
    [games],
  )

  return (
    <main className="page">
      <section className="hero-panel">
        <div className="hero-copy">
          {errorKey ? <p className="eyebrow">{translate(locale, errorKey)}</p> : null}
          <p className="eyebrow">{translate(locale, 'catalog.hero.eyebrow')}</p>
          <h1>{translate(locale, 'catalog.hero.title')}</h1>
          <p className="hero-text">{translate(locale, 'catalog.hero.body')}</p>
          <div className="hero-actions">
            <Link className="primary-action" to="/game/signal-grid" data-testid="featured-game-signal-grid-hero">
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
          <Link
            key={game.slug}
            className="featured-card"
            to={`/game/${game.slug}`}
            data-testid={`featured-game-${game.gameId}`}
          >
            <p>{translate(locale, game.categoryLabelKey)}</p>
            <h2>{game.name}</h2>
            <span>{game.tagline}</span>
          </Link>
        ))}
      </section>

      <section className="catalog-section" id="catalog">
        {categories.map(({ categoryKey, games: categoryGames }) => (
          <div className="category-block" id={categoryAnchorByKey[categoryKey]} key={categoryKey}>
            <div className="section-heading">
              <p className="eyebrow">{translate(locale, categoryLabelKeyByCategory[categoryKey])}</p>
              <h2>
                {translate(locale, 'common.formats.categoryLobbies', {
                  category: translate(locale, categoryLabelKeyByCategory[categoryKey]),
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

function GameLobbyPage({ locale }: { locale: SupportedLocale }) {
  const { slug } = useParams<{ slug: string }>()
  const detailState = useGameDetail(slug, locale)

  if (detailState.status === 'loading') {
    return (
      <main className="page lobby-page" data-testid="game-detail-loading">
        <section className="lobby-layout">
          <div className="lobby-main">
            <p className="eyebrow">{translate(locale, 'lobby.loading.eyebrow')}</p>
            <h1>{translate(locale, 'lobby.loading.title')}</h1>
            <p>{translate(locale, 'common.states.loading')}</p>
          </div>
        </section>
      </main>
    )
  }

  if (detailState.status === 'notFound') {
    return (
      <main className="page lobby-page" data-testid="game-detail-not-found">
        <section className="lobby-layout">
          <div className="lobby-main">
            <p className="eyebrow">{translate(locale, 'lobby.notFound.eyebrow')}</p>
            <h1>{translate(locale, detailState.errorKey)}</h1>
            <Link className="primary-action" to="/" data-testid="lobby-return-main">
              {translate(locale, 'common.actions.returnToMainLobby')}
            </Link>
          </div>
        </section>
      </main>
    )
  }

  if (detailState.status === 'error') {
    return (
      <main className="page lobby-page" data-testid="game-detail-error">
        <section className="lobby-layout">
          <div className="lobby-main">
            <p className="eyebrow">{translate(locale, 'lobby.error.eyebrow')}</p>
            <h1>{translate(locale, detailState.errorKey)}</h1>
            <p>{translate(locale, 'lobby.error.title')}</p>
            <Link className="primary-action" to="/" data-testid="lobby-return-main">
              {translate(locale, 'common.actions.returnToMainLobby')}
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const { game } = detailState

  return (
    <main className="page lobby-page" data-testid="game-detail-ready">
      <section className="breadcrumb-row">
        <Link to="/">{translate(locale, 'common.surfaces.mainLobby')}</Link>
        <span>{translate(locale, 'navigation.breadcrumbs.separator')}</span>
        <span>{game.name}</span>
      </section>

      <section className="lobby-layout">
        <div className="lobby-main">
          <p className="eyebrow">
            {translate(locale, 'lobby.detail.eyebrow', {
              category: translate(locale, game.categoryLabelKey),
            })}
          </p>
          <h1>{game.name}</h1>
          <p className="hero-text">{game.description}</p>

          <div className="hero-actions">
            <Link className="primary-action" to="/" data-testid="lobby-back-to-catalog">
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

function getLocalizationKeys(gameId: GameSeed['gameId']): GameLocalizationKeySet {
  return gameLocalizationKeys[gameId]
}

function localizeGame(seed: GameSeed, locale: SupportedLocale): Game {
  const localizationKeys = getLocalizationKeys(seed.gameId)

  return {
    ...seed,
    name: translate(locale, localizationKeys.displayNameKey),
    categoryLabelKey: categoryLabelKeyByCategory[seed.categoryKey],
    tagline: translate(locale, localizationKeys.taglineKey),
    description: translate(locale, localizationKeys.descriptionKey),
    playerRange: translate(locale, localizationKeys.playerRangeKey),
    sessionModes: translateList(locale, localizationKeys.sessionModesKey),
    techStack: translateList(locale, localizationKeys.techStackKey),
    lobbyTheme: translate(locale, localizationKeys.lobbyThemeKey),
    clientSurface: translate(locale, localizationKeys.clientSurfaceKey),
    serverFocus: translate(locale, localizationKeys.serverFocusKey),
  }
}

function getCategoryKey(remoteGame: RemoteCatalogGame, fallbackSeed: GameSeed): GameCategoryKey {
  if (remoteGame.categoryKey) {
    return categoryKeyByTranslationKey[remoteGame.categoryKey] ?? fallbackSeed.categoryKey
  }

  return categoryKeyByCatalogCategory[remoteGame.manifest.category] ?? fallbackSeed.categoryKey
}

type RemoteCatalogGame = GameDefinition

function mergeRemoteCatalogGameWithLocale(remoteGame: RemoteCatalogGame, locale: SupportedLocale): Game | null {
  const presentationSeed =
    gameSeeds.find((game) => game.gameId === remoteGame.gameId) ??
    gameSeeds.find((game) => game.slug === remoteGame.slug)

  if (!presentationSeed) {
    return null
  }

  const localizedGame = localizeGame(presentationSeed, locale)
  const categoryKey = getCategoryKey(remoteGame, presentationSeed)
  const localizationKeys = getLocalizationKeys(presentationSeed.gameId)

  return {
    ...localizedGame,
    slug: remoteGame.slug,
    categoryKey,
    categoryLabelKey: remoteGame.categoryKey ?? categoryLabelKeyByCategory[categoryKey],
    name: translate(locale, remoteGame.displayNameKey ?? localizationKeys.displayNameKey),
    tagline: translate(locale, remoteGame.taglineKey ?? localizationKeys.taglineKey),
    description: translate(locale, remoteGame.descriptionKey ?? localizationKeys.descriptionKey),
  }
}

function useGameCatalog(locale: SupportedLocale) {
  const [remoteCatalog, setRemoteCatalog] = useState<RemoteCatalogState | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadGames = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/games`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          setLoadError(true)
          return
        }

        const payload = (await response.json()) as CatalogListResponse | RemoteCatalogGame[]
        const remoteGames = Array.isArray(payload) ? payload : payload.games

        const mergedGames = remoteGames
          .map((game) => mergeRemoteCatalogGameWithLocale(game, locale))
          .filter((game): game is Game => game !== null)

        setRemoteCatalog({ locale, games: mergedGames })
        setLoadError(false)
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(true)
        }
      }
    }

    void loadGames()

    return () => controller.abort()
  }, [locale])

  return {
    games: remoteCatalog?.locale === locale ? remoteCatalog.games : [],
    source: 'liveService' as CatalogSource,
    errorKey: loadError ? 'errors.catalog.loadFailed' : null,
  }
}

function useGameDetail(slug: string | undefined, locale: SupportedLocale): GameDetailState {
  const [detailState, setDetailState] = useState<GameDetailState>({
    status: 'loading',
    game: null,
    errorKey: null,
  })

  useEffect(() => {
    if (!slug) {
      setDetailState({
        status: 'notFound',
        game: null,
        errorKey: 'errors.catalog.gameNotFound',
      })
      return
    }

    const controller = new AbortController()

    setDetailState({
      status: 'loading',
      game: null,
      errorKey: null,
    })

    const loadGame = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/games/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })

        if (response.status === 404) {
          const errorResponse = await parseCatalogErrorResponse(response)

          if (errorResponse?.code === 'CATALOG_GAME_NOT_FOUND') {
            setDetailState({
              status: 'notFound',
              game: null,
              errorKey: 'errors.catalog.gameNotFound',
            })
          } else {
            setDetailState({
              status: 'error',
              game: null,
              errorKey: 'errors.common.unknown',
            })
          }

          return
        }

        if (!response.ok) {
          setDetailState({
            status: 'error',
            game: null,
            errorKey: 'errors.common.unknown',
          })
          return
        }

        const payload = (await response.json()) as RemoteCatalogGame
        const game = mergeRemoteCatalogGameWithLocale(payload, locale)

        if (!game) {
          setDetailState({
            status: 'error',
            game: null,
            errorKey: 'errors.common.unknown',
          })
          return
        }

        setDetailState({
          status: 'ready',
          game,
          errorKey: null,
        })
      } catch {
        if (!controller.signal.aborted) {
          setDetailState({
            status: 'error',
            game: null,
            errorKey: 'errors.catalog.loadFailed',
          })
        }
      }
    }

    void loadGame()

    return () => controller.abort()
  }, [locale, slug])

  return detailState
}

async function parseCatalogErrorResponse(response: Response): Promise<CatalogErrorResponse | null> {
  try {
    return (await response.json()) as CatalogErrorResponse
  } catch {
    return null
  }
}

export default App