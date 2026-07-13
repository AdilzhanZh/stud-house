import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { kk } from './locales/kk'
import { ru } from './locales/ru'
import { en } from './locales/en'

export type SupportedLanguage = 'kk' | 'ru' | 'en'

const STORAGE_KEY = 'student-house-lang'

export function readStoredLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'ru' || stored === 'en' ? stored : 'kk'
}

export function storeLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang)
}

void i18n.use(initReactI18next).init({
  resources: {
    kk: { translation: kk },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: readStoredLanguage(),
  fallbackLng: 'kk',
  interpolation: { escapeValue: false },
})

export default i18n
