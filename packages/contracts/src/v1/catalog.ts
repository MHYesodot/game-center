export type CatalogGameCategory =
  | 'board'
  | 'card'
  | 'arcade'
  | '2d'
  | '3d'
  | 'racing'
  | 'simulation'
  | 'fps'

export type GameClientRuntime = 'web' | 'native' | 'launcher'

export type GameServerType = 'none' | 'shared' | 'dedicated'

export type GameLifecycleStatus = 'draft' | 'active' | 'retired'

export type GameCapabilities = {
  multiplayer: boolean
  ranked: boolean
  spectators: boolean
  replays: boolean
  privateRooms: boolean
}

export type GameRuntime = {
  clientRuntime: GameClientRuntime
  engine: string
  serverType: GameServerType
}

export type GameVersion = {
  gameVersion: string
  protocolVersion: string
  buildVersion: string
}

export type GamePlatformAvailability = {
  web: boolean
  windows: boolean
  macos: boolean
  android: boolean
  ios: boolean
  ipados: boolean
}

export type GameDistributionMetadata = {
  minimumVersion?: string
  downloadStrategy?: 'browser' | 'managed-install' | 'store-deep-link' | 'bundled'
  launchStrategy?: 'route' | 'native-process' | 'deep-link' | 'embedded-web-runtime'
  architecture?: 'browser' | 'native-desktop' | 'native-mobile' | 'dedicated-server'
}

export type GameManifest = {
  gameId: string
  slug: string
  category: CatalogGameCategory
  categoryKey: string
  displayNameKey: string
  descriptionKey: string
  taglineKey: string
  runtime: GameRuntime
  version: GameVersion
  capabilities: GameCapabilities
  platforms: GamePlatformAvailability
  distribution: GameDistributionMetadata
}

export type GameDefinition = {
  gameId: string
  slug: string
  status: GameLifecycleStatus
  tags: string[]
  categoryKey: string
  displayNameKey: string
  descriptionKey: string
  taglineKey: string
  manifest: GameManifest
}

export type CatalogListResponse = {
  games: GameDefinition[]
}

export type CatalogGameResponse = GameDefinition

export type CatalogErrorCode = 'CATALOG_GAME_NOT_FOUND' | 'CATALOG_UNAVAILABLE'

export type CatalogErrorResponse = {
  code: CatalogErrorCode
}

export type CatalogGameManifest = {
  gameId: string
  slug: string
  category: CatalogGameCategory
  categoryKey: string
  displayNameKey: string
  descriptionKey: string
  taglineKey: string
  runtime: GameClientRuntime
  engine: string
  serverType: GameServerType
  gameVersion: string
  protocolVersion: string
  buildVersion: string
  supports: GameCapabilities
  platforms: GamePlatformAvailability
  distribution: GameDistributionMetadata
}