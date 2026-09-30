import type {
	CatalogGameCategory,
	CatalogGameResponse,
	GameCapabilities,
	GameClientRuntime,
	GameDefinition,
	GameDistributionMetadata,
	GameLifecycleStatus,
	GamePlatformAvailability,
	GameServerType,
	GameVersion,
} from '@game-center/contracts'

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY')

export type CatalogGameDefinition = {
	gameId: string
	slug: string
	status: GameLifecycleStatus
	tags: string[]
	category: CatalogGameCategory
	categoryKey: string
	displayNameKey: string
	descriptionKey: string
	taglineKey: string
}

export type CatalogGameRuntime = {
	clientRuntime: GameClientRuntime
	engine: string
	serverType: GameServerType
}

export type CatalogGameVersion = GameVersion & {
	runtime: CatalogGameRuntime
	capabilities: GameCapabilities
	platforms: GamePlatformAvailability
	distribution: GameDistributionMetadata
}

export type CatalogGame = {
	definition: CatalogGameDefinition
	activeVersion: CatalogGameVersion
}

export interface CatalogRepository {
	listGames(): Promise<CatalogGame[]>
	getGameBySlug(slug: string): Promise<CatalogGame | null>
}

export function toCatalogGameResponse(game: CatalogGame): CatalogGameResponse {
	const { definition, activeVersion } = game

	return {
		gameId: definition.gameId,
		slug: definition.slug,
		status: definition.status,
		tags: definition.tags,
		categoryKey: definition.categoryKey,
		displayNameKey: definition.displayNameKey,
		descriptionKey: definition.descriptionKey,
		taglineKey: definition.taglineKey,
		manifest: {
			gameId: definition.gameId,
			slug: definition.slug,
			category: definition.category,
			categoryKey: definition.categoryKey,
			displayNameKey: definition.displayNameKey,
			descriptionKey: definition.descriptionKey,
			taglineKey: definition.taglineKey,
			runtime: {
				...activeVersion.runtime,
			},
			version: {
				gameVersion: activeVersion.gameVersion,
				protocolVersion: activeVersion.protocolVersion,
				buildVersion: activeVersion.buildVersion,
			},
			capabilities: {
				...activeVersion.capabilities,
			},
			platforms: {
				...activeVersion.platforms,
			},
			distribution: {
				...activeVersion.distribution,
			},
		},
	}
}

export function getCatalogLocalizationKeys(game: CatalogGame) {
	return {
		categoryKey: game.definition.categoryKey,
		displayNameKey: game.definition.displayNameKey,
		descriptionKey: game.definition.descriptionKey,
		taglineKey: game.definition.taglineKey,
	}
}

export function isCatalogGameInCategory(game: CatalogGame, category: CatalogGameCategory) {
	return game.definition.category === category
}

export function supportsCatalogPlatform(game: CatalogGame, platform: keyof CatalogGameVersion['platforms']) {
	return game.activeVersion.platforms[platform]
}

export function toCatalogGame(game: GameDefinition): CatalogGame {
	return {
		definition: {
			gameId: game.gameId,
			slug: game.slug,
			status: game.status,
			tags: [...game.tags],
			category: game.manifest.category,
			categoryKey: game.categoryKey,
			displayNameKey: game.displayNameKey,
			descriptionKey: game.descriptionKey,
			taglineKey: game.taglineKey,
		},
		activeVersion: {
			gameVersion: game.manifest.version.gameVersion,
			protocolVersion: game.manifest.version.protocolVersion,
			buildVersion: game.manifest.version.buildVersion,
			runtime: {
				...game.manifest.runtime,
			},
			capabilities: {
				...game.manifest.capabilities,
			},
			platforms: {
				...game.manifest.platforms,
			},
			distribution: {
				...game.manifest.distribution,
			},
		},
	}
}