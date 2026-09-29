import type { CatalogGameCategory, GameDefinition } from '@game-center/contracts'

export type CatalogGame = GameDefinition

export function getCatalogLocalizationKeys(game: CatalogGame) {
	return {
		categoryKey: game.categoryKey,
		displayNameKey: game.displayNameKey,
		descriptionKey: game.descriptionKey,
		taglineKey: game.taglineKey,
	}
}

export function isCatalogGameInCategory(game: CatalogGame, category: CatalogGameCategory) {
	return game.manifest.category === category
}

export function supportsCatalogPlatform(
	game: CatalogGame,
	platform: keyof CatalogGame['manifest']['platforms'],
) {
	return game.manifest.platforms[platform]
}