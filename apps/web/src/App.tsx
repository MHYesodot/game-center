import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import type {
  AuthErrorResponse,
  AuthSession,
  CatalogErrorResponse,
  CatalogListResponse,
  GameDefinition,
  IssueRealtimeTicketResponse,
  LoginRequest,
  PlatformRealtimeEvent,
  RealtimeAckEnvelope,
  RealtimeCommandEnvelope,
  RealtimeErrorEnvelope,
  RealtimeHandshakePayload,
  RegisterRequest,
} from '@game-center/contracts'
import { formatNumber, getTextDirection, translate, translateList, type SupportedLocale } from '@game-center/i18n'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
const realtimeBaseUrl = import.meta.env.VITE_REALTIME_BASE_URL ?? null
const realtimeWebsocketPath = import.meta.env.VITE_REALTIME_WEBSOCKET_PATH ?? '/realtime/v1/ws'
const realtimeClientVersion = 'web-portal'

type GameCategoryKey = 'board' | 'arcade' | 'simulation3d'
type CatalogSource = 'liveService'
type AuthFormMode = 'sign-in' | 'register'

type RemoteCatalogState = {
  locale: SupportedLocale
  games: Game[]
}

type GameDetailState =
  | { status: 'loading'; game: null; errorKey: null }
  | { status: 'ready'; game: Game; errorKey: null }
  | { status: 'notFound'; game: null; errorKey: 'errors.catalog.gameNotFound' }
  | { status: 'error'; game: null; errorKey: 'errors.catalog.loadFailed' | 'errors.common.unknown' }

type AuthState =
  | { status: 'loading'; session: null; errorKey: null }
  | { status: 'unauthenticated'; session: null; errorKey: string | null }
  | { status: 'authenticated'; session: AuthSession; errorKey: null }

type AuthController = {
  state: AuthState
  signIn(request: LoginRequest): Promise<string | null>
  register(request: RegisterRequest): Promise<string | null>
  signOut(): Promise<void>
  refresh(): Promise<void>
}

type RealtimeState =
  | { status: 'idle'; messageKey: 'common.auth.realtimeReady' | 'common.states.realtimeDisconnected' | 'common.auth.realtimeClosed' }
  | { status: 'connecting'; messageKey: 'common.auth.realtimeTicketIssued' | 'common.states.realtimeConnecting' }
  | { status: 'connected'; messageKey: 'common.auth.realtimeOpen'; playerId: string }
  | { status: 'error'; messageKey: string }

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

function createLoadingDetailState(): GameDetailState {
  return {
    status: 'loading',
    game: null,
    errorKey: null,
  }
}

function createNotFoundDetailState(): GameDetailState {
  return {
    status: 'notFound',
    game: null,
    errorKey: 'errors.catalog.gameNotFound',
  }
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
  const auth = useAuthSession()

  return (
    <BrowserRouter>
      <GameCenter auth={auth} locale={locale} />
    </BrowserRouter>
  )
}

function GameCenter({ auth, locale }: { auth: AuthController; locale: SupportedLocale }) {
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
        <div className="toolbar-session">
          <div className="source-pill">
            {auth.state.status === 'authenticated'
              ? translate(locale, 'common.auth.sessionLabel', { email: auth.state.session.email })
              : translate(locale, 'catalog.source.label', {
                  source: translate(locale, sourceLabelKeyBySource.liveService),
                })}
          </div>
          {auth.state.status === 'authenticated' ? (
            <button className="secondary-action button-reset" onClick={() => void auth.signOut()} type="button">
              {translate(locale, 'common.actions.signOut')}
            </button>
          ) : (
            <a className="secondary-action" href="#auth-panel">
              {translate(locale, 'common.actions.signIn')}
            </a>
          )}
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePageRoute auth={auth} locale={locale} />} />
        <Route path="/game/:slug" element={<ProtectedGameLobbyRoute auth={auth} locale={locale} />} />
      </Routes>
    </div>
  )
}

function HomePageRoute({ auth, locale }: { auth: AuthController; locale: SupportedLocale }) {
  const { games, errorKey } = useGameCatalog(locale)

  return <HomePage auth={auth} games={games} locale={locale} errorKey={errorKey} />
}

function HomePage({ auth, games, locale, errorKey }: { auth: AuthController; games: Game[]; locale: SupportedLocale; errorKey: string | null }) {
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
          <article id="auth-panel" className="auth-card">
            <span>{translate(locale, 'common.auth.eyebrow')}</span>
            <h2>{translate(locale, 'common.auth.title')}</h2>
            <p>{translate(locale, 'common.auth.body')}</p>
            <AuthPanel auth={auth} locale={locale} />
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

function ProtectedGameLobbyRoute({ auth, locale }: { auth: AuthController; locale: SupportedLocale }) {
  const authState = auth.state

  if (authState.status === 'loading') {
    return (
      <main className="page lobby-page">
        <section className="lobby-layout">
          <div className="lobby-main">
            <p className="eyebrow">{translate(locale, 'common.auth.protectedRouteTitle')}</p>
            <h1>{translate(locale, 'common.states.authenticating')}</h1>
            <p>{translate(locale, 'common.auth.protectedRouteBody')}</p>
          </div>
        </section>
      </main>
    )
  }

  if (authState.status === 'unauthenticated') {
    return (
      <main className="page lobby-page" data-testid="auth-gate">
        <section className="lobby-layout">
          <div className="lobby-main">
            <p className="eyebrow">{translate(locale, 'common.auth.protectedRouteTitle')}</p>
            <h1>{translate(locale, 'common.actions.signIn')}</h1>
            <p className="hero-text">{translate(locale, 'common.auth.protectedRouteBody')}</p>
            <AuthPanel auth={auth} locale={locale} />
          </div>
        </section>
      </main>
    )
  }

  return <GameLobbyPage auth={auth} locale={locale} session={authState.session} />
}

function AuthPanel({ auth, locale }: { auth: AuthController; locale: SupportedLocale }) {
  const [mode, setMode] = useState<AuthFormMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localErrorKey, setLocalErrorKey] = useState<string | null>(null)

  if (auth.state.status === 'authenticated') {
    return (
      <div className="auth-panel-body">
        <p className="status-note" data-tone="success">
          {translate(locale, 'common.auth.sessionLabel', { email: auth.state.session.email })}
        </p>
        <p className="session-chip">{translate(locale, 'common.auth.sessionSummary', { playerId: auth.state.session.playerId })}</p>
      </div>
    )
  }

  const errorKey = localErrorKey ?? auth.state.errorKey

  async function handleSubmit(nextMode: AuthFormMode) {
    setMode(nextMode)
    setIsSubmitting(true)
    setLocalErrorKey(null)

    const request = {
      email,
      password,
    }

    const nextErrorKey =
      nextMode === 'register' ? await auth.register(request as RegisterRequest) : await auth.signIn(request as LoginRequest)

    setLocalErrorKey(nextErrorKey)
    setIsSubmitting(false)
  }

  return (
    <div className="auth-panel-body">
      <label className="form-field">
        <span>{translate(locale, 'common.auth.emailLabel')}</span>
        <input className="auth-input" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      </label>
      <label className="form-field">
        <span>{translate(locale, 'common.auth.passwordLabel')}</span>
        <input className="auth-input" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
      </label>
      {errorKey ? (
        <p className="status-note" data-tone="error">
          {translate(locale, errorKey)}
        </p>
      ) : null}
      <div className="hero-actions auth-actions">
        <button className="primary-action button-reset" disabled={isSubmitting} onClick={() => void handleSubmit(mode)} type="button">
          {translate(locale, mode === 'register' ? 'common.actions.register' : 'common.actions.signIn')}
        </button>
        <button
          className="secondary-action button-reset"
          disabled={isSubmitting}
          onClick={() => setMode(mode === 'register' ? 'sign-in' : 'register')}
          type="button"
        >
          {translate(locale, mode === 'register' ? 'common.actions.signIn' : 'common.actions.register')}
        </button>
      </div>
    </div>
  )
}

function GameLobbyPage({ auth, locale, session }: { auth: AuthController; locale: SupportedLocale; session: AuthSession }) {
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
            <button className="secondary-action button-reset" onClick={() => void auth.signOut()} type="button">
              {translate(locale, 'common.actions.signOut')}
            </button>
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
            <h2>{translate(locale, 'lobby.detail.authenticatedSession')}</h2>
            <p className="status-note">{translate(locale, 'common.auth.sessionLabel', { email: session.email })}</p>
            <p>{translate(locale, 'lobby.detail.protectedBody')}</p>
            <p className="session-chip">{translate(locale, 'common.auth.sessionSummary', { playerId: session.playerId })}</p>
          </div>

          <RealtimeStatusCard locale={locale} session={session} />

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

function RealtimeStatusCard({ locale, session }: { locale: SupportedLocale; session: AuthSession }) {
  const socketRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<RealtimeState>({
    status: 'idle',
    messageKey: 'common.auth.realtimeReady',
  })

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [])

  async function connectRealtime() {
    if (socketRef.current) {
      return
    }

    setState({ status: 'connecting', messageKey: 'common.auth.realtimeTicketIssued' })

    const ticketResponse = await fetch(`${apiBaseUrl}/auth/realtime-ticket`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        clientType: 'web',
        clientVersion: realtimeClientVersion,
        platform: 'web',
      }),
    })

    if (!ticketResponse.ok) {
      setState({ status: 'error', messageKey: await resolveAuthErrorKey(ticketResponse, 'errors.auth.realtimeUnavailable') })
      return
    }

    const { ticket } = (await ticketResponse.json()) as IssueRealtimeTicketResponse
    const socket = new WebSocket(buildRealtimeWebSocketUrl())
    socketRef.current = socket

    socket.addEventListener('open', () => {
      setState({ status: 'connecting', messageKey: 'common.states.realtimeConnecting' })

      const handshake: RealtimeCommandEnvelope<RealtimeHandshakePayload> = {
        protocolVersion: 'realtime.v1',
        kind: 'command',
        type: 'connection.handshake',
        messageId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        payload: {
          protocolVersion: 'realtime.v1',
          ticket,
          clientType: 'web',
          clientVersion: realtimeClientVersion,
          platform: 'web',
        },
      }

      socket.send(JSON.stringify(handshake))
    })

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as PlatformRealtimeEvent | RealtimeAckEnvelope | RealtimeErrorEnvelope

        if ('eventType' in message && message.eventType === 'connection.established' && 'playerId' in message.payload) {
          setState({
            status: 'connected',
            messageKey: 'common.auth.realtimeOpen',
            playerId: message.payload.playerId,
          })
          return
        }

        if ('kind' in message && message.kind === 'ack' && message.payload.status === 'accepted') {
          setState({
            status: 'connected',
            messageKey: 'common.auth.realtimeOpen',
            playerId: session.playerId,
          })
          return
        }

        if ('kind' in message && message.kind === 'error') {
          setState({
            status: 'error',
            messageKey: mapRealtimeErrorCodeToTranslation(message.payload.code),
          })
        }
      } catch {
        setState({ status: 'error', messageKey: 'errors.auth.realtimeUnavailable' })
      }
    })

    socket.addEventListener('close', () => {
      socketRef.current = null
      setState({ status: 'idle', messageKey: 'common.auth.realtimeClosed' })
    })

    socket.addEventListener('error', () => {
      setState({ status: 'error', messageKey: 'common.auth.realtimeError' })
    })
  }

  function disconnectRealtime() {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    setState({ status: 'idle', messageKey: 'common.states.realtimeDisconnected' })
  }

  return (
    <div className="sidebar-card realtime-card">
      <h2>{translate(locale, 'lobby.detail.realtimeTransport')}</h2>
      <p className="eyebrow">{translate(locale, 'common.auth.realtimeLabel')}</p>
      <p className="status-note" data-tone={state.status === 'error' ? 'error' : state.status === 'connected' ? 'success' : 'neutral'}>
        {state.status === 'connected'
          ? translate(locale, state.messageKey, { playerId: state.playerId })
          : translate(locale, state.messageKey)}
      </p>
      <div className="hero-actions auth-actions">
        <button className="primary-action button-reset" onClick={() => void connectRealtime()} type="button">
          {translate(locale, 'common.actions.connectRealtime')}
        </button>
        <button className="secondary-action button-reset" onClick={disconnectRealtime} type="button">
          {translate(locale, 'common.actions.disconnectRealtime')}
        </button>
      </div>
    </div>
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
    gameSeeds.find((game) => game.gameId === remoteGame.gameId) ?? gameSeeds.find((game) => game.slug === remoteGame.slug)

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
  const [detailState, setDetailState] = useState<{
    locale: SupportedLocale
    slug: string | undefined
    state: GameDetailState
  }>(slug ? { locale, slug, state: createLoadingDetailState() } : { locale, slug, state: createNotFoundDetailState() })

  useEffect(() => {
    if (!slug) {
      return
    }

    const controller = new AbortController()

    const loadGame = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/games/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })

        if (response.status === 404) {
          const errorResponse = await parseCatalogErrorResponse(response)

          if (errorResponse?.code === 'CATALOG_GAME_NOT_FOUND') {
            setDetailState({
              locale,
              slug,
              state: createNotFoundDetailState(),
            })
          } else {
            setDetailState({
              locale,
              slug,
              state: {
                status: 'error',
                game: null,
                errorKey: 'errors.common.unknown',
              },
            })
          }

          return
        }

        if (!response.ok) {
          const errorResponse = await parseCatalogErrorResponse(response)

          setDetailState({
            locale,
            slug,
            state: {
              status: 'error',
              game: null,
              errorKey: errorResponse?.code === 'CATALOG_UNAVAILABLE' ? 'errors.catalog.loadFailed' : 'errors.common.unknown',
            },
          })
          return
        }

        const payload = (await response.json()) as RemoteCatalogGame
        const game = mergeRemoteCatalogGameWithLocale(payload, locale)

        if (!game) {
          setDetailState({
            locale,
            slug,
            state: {
              status: 'error',
              game: null,
              errorKey: 'errors.common.unknown',
            },
          })
          return
        }

        setDetailState({
          locale,
          slug,
          state: {
            status: 'ready',
            game,
            errorKey: null,
          },
        })
      } catch {
        if (!controller.signal.aborted) {
          setDetailState({
            locale,
            slug,
            state: {
              status: 'error',
              game: null,
              errorKey: 'errors.catalog.loadFailed',
            },
          })
        }
      }
    }

    void loadGame()

    return () => controller.abort()
  }, [locale, slug])

  if (!slug) {
    return createNotFoundDetailState()
  }

  if (detailState.slug !== slug || detailState.locale !== locale) {
    return createLoadingDetailState()
  }

  return detailState.state
}

function useAuthSession(): AuthController {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    session: null,
    errorKey: null,
  })

  async function refresh() {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/session`, {
        credentials: 'include',
      })

      if (response.status === 401) {
        setState({ status: 'unauthenticated', session: null, errorKey: null })
        return
      }

      if (!response.ok) {
        setState({ status: 'unauthenticated', session: null, errorKey: 'errors.auth.sessionLoadFailed' })
        return
      }

      const session = (await response.json()) as AuthSession
      setState({ status: 'authenticated', session, errorKey: null })
    } catch {
      setState({ status: 'unauthenticated', session: null, errorKey: 'errors.auth.sessionLoadFailed' })
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function signIn(request: LoginRequest) {
    return await authenticate('/auth/login', request, setState)
  }

  async function register(request: RegisterRequest) {
    return await authenticate('/auth/register', request, setState)
  }

  async function signOut() {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })

    setState({ status: 'unauthenticated', session: null, errorKey: null })
  }

  return {
    state,
    signIn,
    register,
    signOut,
    refresh,
  }
}

async function authenticate(path: '/auth/login' | '/auth/register', request: LoginRequest | RegisterRequest, setState: (state: AuthState) => void) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorKey = await resolveAuthErrorKey(response, 'errors.common.unknown')
      setState({ status: 'unauthenticated', session: null, errorKey })
      return errorKey
    }

    const session = (await response.json()) as AuthSession
    setState({ status: 'authenticated', session, errorKey: null })
    return null
  } catch {
    setState({ status: 'unauthenticated', session: null, errorKey: 'errors.common.unknown' })
    return 'errors.common.unknown'
  }
}

async function resolveAuthErrorKey(response: Response, fallbackKey: string) {
  const error = await parseAuthErrorResponse(response)

  switch (error?.code) {
    case 'ACCOUNT_ALREADY_EXISTS':
      return 'errors.auth.accountAlreadyExists'
    case 'INVALID_CREDENTIALS':
      return 'errors.auth.invalidCredentials'
    case 'AUTHENTICATION_REQUIRED':
      return 'errors.auth.sessionRequired'
    case 'INVALID_REALTIME_TICKET':
      return 'errors.auth.realtimeRejected'
    default:
      return fallbackKey
  }
}

function mapRealtimeErrorCodeToTranslation(code: string) {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
    case 'INVALID_REALTIME_TICKET':
      return 'errors.auth.realtimeRejected'
    case 'REALTIME_UNAVAILABLE':
      return 'errors.auth.realtimeUnavailable'
    default:
      return 'common.auth.realtimeError'
  }
}

function buildRealtimeWebSocketUrl() {
  if (realtimeBaseUrl) {
    if (realtimeBaseUrl.startsWith('ws://') || realtimeBaseUrl.startsWith('wss://')) {
      return `${realtimeBaseUrl}${realtimeWebsocketPath}`
    }

    return `${realtimeBaseUrl.replace(/^http/, 'ws')}${realtimeWebsocketPath}`
  }

  return `${window.location.origin.replace(/^http/, 'ws')}${realtimeWebsocketPath}`
}

async function parseCatalogErrorResponse(response: Response): Promise<CatalogErrorResponse | null> {
  try {
    return (await response.json()) as CatalogErrorResponse
  } catch {
    return null
  }
}

async function parseAuthErrorResponse(response: Response): Promise<AuthErrorResponse | null> {
  try {
    return (await response.json()) as AuthErrorResponse
  } catch {
    return null
  }
}

export default App
