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
        success: "Success",
        create: "Create",
        update: "Update",
        submit: "Submit",
        back: "Back",
        next: "Next",
        confirm: "Confirm",
        yes: "Yes",
        no: "No",
        add: "Add",
        name: "Name",
        description: "Description",
        status: "Status",
        actions: "Actions",
        settings: "Settings",
        noData: "No data available",
        processing: "Processing...",
        failed: "Failed",
        pending: "Pending",
        completed: "Completed",
        active: "Active",
        inactive: "Inactive"
      },
      auth: {
        login: "Log In",
        logout: "Log Out",
        email: "Email",
        password: "Password",
        loginTitle: "Welcome Back"
      },
      navigation: {
        hub: "Hub",
        workspace: "Workspace",
        settings: "Settings",
        admin: "Admin",
        dashboard: "Dashboard",
        projects: "Projects"
      },
      project: {
        name: "Project Name",
        create: "Create Project",
        noProjects: "No projects found"
      },
      workspace: {
        title: "Workspace",
        agents: "Agents",
        chat: "Chat",
        logs: "Logs",
        preview: "Preview"
      },
      errors: {
        notFound: "Page not found",
        serverError: "Server error. Please try again later.",
        genericError: "Something went wrong. Please try again."
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

