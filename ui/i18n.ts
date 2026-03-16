'use client'

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'it'],
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    },
    resources: {
      en: { translation: require('./locales/en/translation.json') },
      it: { translation: require('./locales/it/translation.json') },
    },
    interpolation: { escapeValue: false },
  })

export default i18n
