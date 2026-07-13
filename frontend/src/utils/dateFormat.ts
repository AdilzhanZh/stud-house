import i18n from '../i18n'

const LOCALE_BY_LANG: Record<string, string> = {
  kk: 'kk-KZ',
  ru: 'ru-RU',
  en: 'en-US',
}

function activeLocale(): string {
  return LOCALE_BY_LANG[i18n.language] ?? 'kk-KZ'
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(activeLocale())
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(activeLocale())
}
