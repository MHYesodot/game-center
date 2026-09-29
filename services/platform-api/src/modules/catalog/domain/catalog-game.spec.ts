import { describe, expect, it } from 'vitest'
import { buildCatalogGame } from '@game-center/testing'

import { getCatalogLocalizationKeys, isCatalogGameInCategory, supportsCatalogPlatform } from './catalog-game.js'

describe('catalog domain helpers', () => {
  it('returns the semantic localization keys for a catalog game', () => {
    const game = buildCatalogGame()

    expect(getCatalogLocalizationKeys(game)).toEqual({
      categoryKey: 'navigation.categories.board',
      displayNameKey: 'catalog.gameMeta.names.signal-grid',
      descriptionKey: 'catalog.gameMeta.descriptions.signal-grid',
      taglineKey: 'catalog.gameMeta.tagline.signal-grid',
    })
  })

  it('checks category membership against the manifest category', () => {
    const baselineGame = buildCatalogGame()
    const game = buildCatalogGame({ manifest: { ...baselineGame.manifest, category: 'board' } })

    expect(isCatalogGameInCategory(game, 'board')).toBe(true)
    expect(isCatalogGameInCategory(game, 'arcade')).toBe(false)
  })

  it('checks platform availability from the manifest', () => {
    const baselineGame = buildCatalogGame()
    const game = buildCatalogGame({
      manifest: {
        ...baselineGame.manifest,
        platforms: {
          web: true,
          windows: true,
          macos: true,
          android: false,
          ios: false,
          ipados: false,
        },
      },
    })

    expect(supportsCatalogPlatform(game, 'windows')).toBe(true)
    expect(supportsCatalogPlatform(game, 'android')).toBe(false)
  })
})