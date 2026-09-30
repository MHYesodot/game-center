import {
  createGameLocalization,
  getGameClientLocale,
  type GameClientLocale,
  type GameLocalizationDictionary,
  type TranslationValues,
} from '@game-center/game-client-core'

type BoardTranslations = {
  documentTitle: string
  heroEyebrow: string
  title: string
  description: string
  activeTurn: string
  resetMatch: string
  ruleset: string
  boardLabel: string
  lobbyTitle: string
  sideTitle: string
  sideItems: string[]
  playersTitle: string
  'player.one': string
  'player.two': string
  'player.oneWins': string
  'player.twoWins': string
  'status.ready': string
  'status.turnLocked': string
  'status.columnFull': string
  'status.playerOneWon': string
  'status.playerTwoWon': string
  'board.cellLabel': string
}

type BoardStringTranslationKey = Exclude<keyof BoardTranslations, 'sideItems'>

const translations: GameLocalizationDictionary = {
  en: {
    documentTitle: 'Signal Grid',
    heroEyebrow: 'Board game client',
    title: 'Signal Grid',
    description:
      'A standalone board client for the game center. This preview mirrors the server-side lobby logic with a tactical drop-token match surface.',
    activeTurn: 'Active turn',
    resetMatch: 'Reset match',
    ruleset: 'Server-ready ruleset',
    boardLabel: 'Signal Grid board',
    lobbyTitle: 'Lobby stack',
    sideTitle: 'Purpose-built board surface',
    sideItems: [
      'Canvas-free DOM board for crisp turn controls',
      'Ready for WebSocket state sync from the Node lobby service',
      'Authoritative winner detection already modeled server-side',
    ],
    playersTitle: 'Players',
    'player.one': 'Commander One',
    'player.two': 'Commander Two',
    'player.oneWins': 'Commander One wins',
    'player.twoWins': 'Commander Two wins',
    'status.ready': 'Drop a token to open the round.',
    'status.turnLocked': 'Column {column} locked. Awaiting next move.',
    'status.columnFull': 'Column {column} is full. Choose another lane.',
    'status.playerOneWon': 'Commander One sealed the grid with four in a row.',
    'status.playerTwoWon': 'Commander Two sealed the grid with four in a row.',
    'board.cellLabel': 'Column {column}, row {row}',
  } as BoardTranslations,
  he: {
    documentTitle: 'רשת אות',
    heroEyebrow: 'לקוח משחק לוח',
    title: 'רשת אות',
    description:
      'אב טיפוס עצמאי למשחק לוח עבור Game Center. התצוגה מקדימה משקפת את לוגיקת הלובי בצד השרת עם משטח טקטי להטלת אסימונים.',
    activeTurn: 'תור פעיל',
    resetMatch: 'איפוס משחק',
    ruleset: 'מערכת חוקים מוכנה לשרת',
    boardLabel: 'לוח רשת אות',
    lobbyTitle: 'מחסנית לובי',
    sideTitle: 'משטח לוח ייעודי',
    sideItems: [
      'לוח DOM ללא Canvas לשליטה מדויקת בתורות',
      'מוכן לסנכרון מצב דרך WebSocket משירות הלובי של Node',
      'זיהוי מנצח סמכותי כבר ממודל בצד השרת',
    ],
    playersTitle: 'שחקנים',
    'player.one': 'מפקד אחת',
    'player.two': 'מפקד שתיים',
    'player.oneWins': 'מפקד אחת ניצחה',
    'player.twoWins': 'מפקד שתיים ניצחה',
    'status.ready': 'הטילו אסימון כדי לפתוח את הסיבוב.',
    'status.turnLocked': 'עמודה {column} ננעלה. ממתינים למהלך הבא.',
    'status.columnFull': 'עמודה {column} מלאה. בחרו נתיב אחר.',
    'status.playerOneWon': 'מפקד אחת סגרה את הרשת עם ארבעה ברצף.',
    'status.playerTwoWon': 'מפקד שתיים סגרה את הרשת עם ארבעה ברצף.',
    'board.cellLabel': 'עמודה {column}, שורה {row}',
  } as BoardTranslations,
}

export function getPrototypeLocale(search = window.location.search): GameClientLocale {
  return getGameClientLocale(search)
}

export function createBoardTranslator(locale: GameClientLocale) {
  const localization = createGameLocalization(locale, translations)
  const dictionary = translations[locale] as BoardTranslations

  return {
    copy: dictionary,
    t(key: BoardStringTranslationKey, values?: TranslationValues) {
      return localization.t(key, values)
    },
    direction: localization.direction,
  }
}