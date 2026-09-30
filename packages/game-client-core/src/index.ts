import {
  createTranslator,
  formatNumber,
  formatTranslationTemplate,
  type TextDirection,
  type TranslationBundle,
  type TranslationNode,
  type TranslationValues,
} from '@game-center/i18n'

export type { TranslationValues } from '@game-center/i18n'

export type GameClientLocale = 'en' | 'he'

export type GameLocalization = {
  locale: GameClientLocale
  direction: TextDirection
  t(key: string, params?: Record<string, unknown>): string
}

export type GameLocalizationDictionary = Record<GameClientLocale, Record<string, string | string[]>>

const localeDirections: Record<GameClientLocale, TextDirection> = {
  en: 'ltr',
  he: 'rtl',
}

function toTranslationNode(dictionary: Record<string, string | string[]>): TranslationNode {
  return Object.fromEntries(Object.entries(dictionary)) as TranslationNode
}

function toTranslationBundle(dictionary: GameLocalizationDictionary): Record<GameClientLocale, TranslationBundle> {
  return {
    en: { game: toTranslationNode(dictionary.en) },
    he: { game: toTranslationNode(dictionary.he) },
  }
}

function normalizeTranslationValues(params?: Record<string, unknown>): TranslationValues | undefined {
  if (!params) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === 'number' ? value : String(value)]),
  )
}

export function getGameClientLocale(search: string): GameClientLocale {
  const locale = new URLSearchParams(search).get('locale')
  return locale === 'he' ? 'he' : 'en'
}

export function applyDocumentLocalization(documentElement: HTMLElement, locale: GameClientLocale, direction: TextDirection) {
  documentElement.lang = locale
  documentElement.dir = direction
}

export function createGameLocalization(
  locale: GameClientLocale,
  translations: GameLocalizationDictionary,
): GameLocalization {
  const translator = createTranslator(toTranslationBundle(translations), localeDirections)

  return {
    locale,
    direction: translator.getDirection(locale),
    t(key: string, params?: Record<string, unknown>) {
      return translator.translate(locale, `game.${key}`, normalizeTranslationValues(params))
    },
  }
}

export function getGameTextList(
  locale: GameClientLocale,
  translations: GameLocalizationDictionary,
  key: string,
) {
  const translator = createTranslator(toTranslationBundle(translations), localeDirections)
  return translator.translateList(locale, `game.${key}`)
}

export function formatGameMessage(template: string, params?: Record<string, unknown>) {
  return formatTranslationTemplate(template, normalizeTranslationValues(params))
}

export { formatNumber }