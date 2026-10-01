import type { GameServerArtifactRuntimeType, GameServerType } from '@game-center/contracts'

export type CatalogGameServerArtifact = {
  gameId: string
  gameVersion: string
  protocolVersion: string
  buildVersion: string
  serverType: GameServerType
  runtimeType: GameServerArtifactRuntimeType
}

export interface CatalogAllocationArtifactQuery {
  getGameServerArtifact(gameId: string): Promise<CatalogGameServerArtifact | null>
}

export const CATALOG_ALLOCATION_ARTIFACT_QUERY = Symbol('CATALOG_ALLOCATION_ARTIFACT_QUERY')