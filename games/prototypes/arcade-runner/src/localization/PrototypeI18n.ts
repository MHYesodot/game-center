import {
  createGameLocalization,
  getGameClientLocale,
  type GameClientLocale,
  type GameLocalizationDictionary,
} from '@game-center/game-client-core'

type ArcadeTranslationDictionary = {
  documentTitle: string
  eyebrow: string
  title: string
  description: string
  hudSpeed: string
  hudScore: string
  infoTitle: string
  infoItems: string[]
}

const translations: GameLocalizationDictionary = {
  en: {
    documentTitle: 'Rush Lane',
    eyebrow: 'Arcade client',
    title: 'Rush Lane',
    description:
      'A standalone TypeScript arcade surface built around a canvas loop rather than React. Use the arrow keys to dodge traffic and chase score multipliers.',
    hudSpeed: 'Speed',
    hudScore: 'Score',
    infoTitle: 'Loop design',
    infoItems: [
      'Low-overhead canvas renderer for twitch input',
      'Separate from the portal so the gameplay loop stays lean',
      'Ready for score submission to the Node service',
    ],
  } as ArcadeTranslationDictionary,
  he: {
    documentTitle: 'נתיב הדחף',
    eyebrow: 'לקוח ארקייד',
    title: 'נתיב הדחף',
    description:
      'אב טיפוס ארקייד עצמאי ב-TypeScript סביב לולאת canvas במקום React. השתמשו במקשי החצים כדי להתחמק מתנועה ולצבור ניקוד.',
    hudSpeed: 'מהירות',
    hudScore: 'ניקוד',
    infoTitle: 'מבנה הלולאה',
    infoItems: [
      'מרנדר Canvas קל משקל לקלט מהיר',
      'מופרד מהפורטל כדי שלולאת המשחק תישאר רזה',
      'מוכן להגשת ניקוד לשירות Node',
    ],
  } as ArcadeTranslationDictionary,
}

export function getPrototypeLocale(search = window.location.search): GameClientLocale {
  return getGameClientLocale(search)
}

export function getArcadeTranslations(locale: GameClientLocale) {
  const localization = createGameLocalization(locale, translations)

  return {
    copy: translations[locale] as ArcadeTranslationDictionary,
    localization,
  }
}