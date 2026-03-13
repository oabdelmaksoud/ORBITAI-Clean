import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Fallback resources in case HttpBackend fails
const fallbackResources = {
  en: {
    translation: {
      common: {
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        close: "Close",
        search: "Search",
        loading: "Loading...",
        error: "Error",
        success: "Success"
      }
    }
  }
};

// Initialize i18n with error handling
try {
  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      backend: {
        loadPath: '/i18n/locales/{{lng}}.json',
        allowMultiLoading: false,
        crossDomain: false
      },
      fallbackLng: 'en',
      debug: false,
      interpolation: {
        escapeValue: false
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage']
      },
      // Fallback resources if backend fails
      resources: fallbackResources,
      // Don't fail if translations can't be loaded
      react: {
        useSuspense: false
      },
      // Handle backend load errors gracefully
      partialBundledLanguages: true
    }).catch((error) => {
      console.warn('[i18n] Initialization error, using fallback:', error);
    });
} catch (error) {
  console.warn('[i18n] Failed to initialize, using fallback resources:', error);
  // Initialize with fallback resources only
  i18n
    .use(initReactI18next)
    .init({
      resources: fallbackResources,
      fallbackLng: 'en',
      react: {
        useSuspense: false
      }
    });
}

export default i18n;

