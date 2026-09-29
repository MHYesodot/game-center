export function formatNumber(locale: 'en' | 'he', value: number) {
  return new Intl.NumberFormat(locale).format(value)
}