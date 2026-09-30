import {
  createGameLocalization,
  getGameClientLocale,
  type GameClientLocale,
  type GameLocalizationDictionary,
} from '@game-center/game-client-core'

type FlightTranslations = {
  documentTitle: string
  eyebrow: string
  title: string
  description: string
  missionLabel: string
  missionValue: string
  squadLabel: string
  squadValue: string
  telemetryLabel: string
  telemetryValue: string
  environmentLabel: string
  environmentValue: string
}

const translations: GameLocalizationDictionary = {
  en: {
    documentTitle: 'Aether Flight',
    eyebrow: '3D simulation prototype',
    title: 'Aether Flight',
    description:
      'A dedicated Three.js mission bay for high-resolution simulation previews. This prototype stays separate from React so the browser rendering loop and scene graph remain focused on preview runtime needs.',
    missionLabel: 'Mission',
    missionValue: 'Low Orbit Survey',
    squadLabel: 'Squad status',
    squadValue: '3 pilots linked',
    telemetryLabel: 'Telemetry',
    telemetryValue: 'Stable vector lock',
    environmentLabel: 'Environment',
    environmentValue: 'Upper atmosphere',
  } as FlightTranslations,
  he: {
    documentTitle: 'טיסת איתר',
    eyebrow: 'אב טיפוס סימולציה תלת-ממדית',
    title: 'טיסת איתר',
    description:
      'מפרץ משימה ייעודי ב-Three.js לתצוגות מקדימות של סימולציה ברזולוציה גבוהה. אב הטיפוס נשאר מופרד מ-React כדי שלולאת הרינדור בדפדפן וגרף הסצנה יתמקדו בצורכי התצוגה בלבד.',
    missionLabel: 'משימה',
    missionValue: 'סקר מסלול נמוך',
    squadLabel: 'סטטוס כנף',
    squadValue: '3 טייסים מחוברים',
    telemetryLabel: 'טלמטריה',
    telemetryValue: 'נעילת וקטור יציבה',
    environmentLabel: 'סביבה',
    environmentValue: 'אטמוספירה עליונה',
  } as FlightTranslations,
}

export function getPrototypeLocale(search = window.location.search): GameClientLocale {
  return getGameClientLocale(search)
}

export function getFlightTranslations(locale: GameClientLocale) {
  const localization = createGameLocalization(locale, translations)

  return {
    copy: translations[locale] as FlightTranslations,
    localization,
  }
}