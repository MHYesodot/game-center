type PrototypeLocale = 'en' | 'he'
type TextDirection = 'ltr' | 'rtl'

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

const translations: Record<PrototypeLocale, ArcadeTranslationDictionary> = {
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
  },
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
  },
}

const textDirection: Record<PrototypeLocale, TextDirection> = {
  en: 'ltr',
  he: 'rtl',
}

export function getPrototypeLocale(): PrototypeLocale {
  const locale = new URLSearchParams(window.location.search).get('locale')
  return locale === 'he' ? 'he' : 'en'
}

export function getPrototypeTextDirection(locale: PrototypeLocale): TextDirection {
  return textDirection[locale]
}

export function getArcadeTranslations(locale: PrototypeLocale) {
  return translations[locale]
}