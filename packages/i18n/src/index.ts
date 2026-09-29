import commonEn from './locales/en/common.json'
import navigationEn from './locales/en/navigation.json'
import catalogEn from './locales/en/catalog.json'
import lobbyEn from './locales/en/lobby.json'
import matchmakingEn from './locales/en/matchmaking.json'
import errorsEn from './locales/en/errors.json'
import commonHe from './locales/he/common.json'
import navigationHe from './locales/he/navigation.json'
import catalogHe from './locales/he/catalog.json'
import lobbyHe from './locales/he/lobby.json'
import matchmakingHe from './locales/he/matchmaking.json'
import errorsHe from './locales/he/errors.json'

export type SupportedLocale = 'en' | 'he'

export type TextDirection = 'ltr' | 'rtl'

type TranslationLeaf = string | string[]

type TranslationNode = {
  [key: string]: TranslationLeaf | TranslationNode
}

type TranslationBundle = Record<string, TranslationNode>

type TranslationValues = Record<string, string | number>

const translations: Record<SupportedLocale, TranslationBundle> = {
  en: {
    common: commonEn as TranslationNode,
    navigation: navigationEn as TranslationNode,
    catalog: catalogEn as TranslationNode,
    lobby: lobbyEn as TranslationNode,
    matchmaking: matchmakingEn as TranslationNode,
    errors: errorsEn as TranslationNode,
  },
  he: {
    common: commonHe as TranslationNode,
    navigation: navigationHe as TranslationNode,
    catalog: catalogHe as TranslationNode,
    lobby: lobbyHe as TranslationNode,
    matchmaking: matchmakingHe as TranslationNode,
    errors: errorsHe as TranslationNode,
  },
}

const localeDirection: Record<SupportedLocale, TextDirection> = {
  en: 'ltr',
  he: 'rtl',
}

function resolvePath(node: TranslationNode | TranslationLeaf, path: string[]): TranslationLeaf | undefined {
  if (typeof node === 'string' || Array.isArray(node)) {
    return path.length === 0 ? node : undefined
  }

  const [head, ...tail] = path

  if (!head) {
    return undefined
  }

  const next = node[head]

  if (next === undefined) {
    return undefined
  }

  if (tail.length === 0 && (typeof next === 'string' || Array.isArray(next))) {
    return next
  }

  return resolvePath(next, tail)
}

function formatTemplate(template: string, values?: TranslationValues) {
  if (!values) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

export function getTextDirection(locale: SupportedLocale): TextDirection {
  return localeDirection[locale]
}

export function translate(locale: SupportedLocale, key: string, values?: TranslationValues): string {
  const [namespace, ...path] = key.split('.')
  const namespaceNode = translations[locale][namespace]

  if (!namespaceNode) {
    throw new Error(`Missing translation namespace: ${namespace}`)
  }

  const resolved = resolvePath(namespaceNode, path)

  if (resolved === undefined) {
    throw new Error(`Missing translation key: ${key}`)
  }

  if (Array.isArray(resolved)) {
    throw new Error(`Translation key does not resolve to a string: ${key}`)
  }

  return formatTemplate(resolved, values)
}

export function translateList(locale: SupportedLocale, key: string): string[] {
  const [namespace, ...path] = key.split('.')
  const namespaceNode = translations[locale][namespace]

  if (!namespaceNode) {
    throw new Error(`Missing translation namespace: ${namespace}`)
  }

  const resolved = resolvePath(namespaceNode, path)

  if (resolved === undefined) {
    throw new Error(`Missing translation key: ${key}`)
  }

  if (!Array.isArray(resolved)) {
    throw new Error(`Translation key does not resolve to a list: ${key}`)
  }

  return resolved
}

export function formatNumber(locale: SupportedLocale, value: number) {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatList(locale: SupportedLocale, values: string[]) {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(values)
}

export function formatPlural(locale: SupportedLocale, count: number, forms: Record<Intl.LDMLPluralRule, string>) {
  const pluralRules = new Intl.PluralRules(locale)
  const rule = pluralRules.select(count)
  const template = forms[rule] ?? forms.other
  return formatTemplate(template, { count })
}

export function getLocaleBundles() {
  return translations
}