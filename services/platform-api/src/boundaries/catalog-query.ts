export type CatalogGameForLobby = {
  gameId: string
  status: 'draft' | 'active' | 'retired'
  multiplayer: boolean
  privateRooms: boolean
  gameVersion: string
  protocolVersion: string
  platforms: {
    web: boolean
    windows: boolean
    macos: boolean
    android: boolean
    ios: boolean
    ipados: boolean
  }
}

export interface CatalogQueryService {
  getGameById(gameId: string): Promise<CatalogGameForLobby | null>
}

export const CATALOG_QUERY_SERVICE = Symbol('CATALOG_QUERY_SERVICE')