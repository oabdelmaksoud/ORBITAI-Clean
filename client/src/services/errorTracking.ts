/**
 * Error Tracking Service
 * Centralized error tracking with Sentry integration (optional)
 */

// Sentry integration (optional - only if SENTRY_DSN is set)
let Sentry: any = null;
let isSentryInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize error tracking
 * Safe to call multiple times - will only initialize once
 */
export async function initErrorTracking(): Promise<void> {
  // If already initialized or initializing, return
  if (isSentryInitialized || initPromise) {
    return initPromise || Promise.resolve();
  }

  // Create initialization promise
  initPromise = (async () => {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    
    if (!sentryDsn) {
      console.log('[Error Tracking] Sentry DSN not configured, using console logging');
      isSentryInitialized = true; // Mark as initialized (using console fallback)
      return;
    }

    try {
      // Dynamic import to avoid bundle size if not using Sentry
      // Use try-catch to handle if package is not installed
      // Using Function constructor to prevent Vite from statically analyzing this import
      const loadSentry = new Function('packageName', 'return import(packageName)');
      const sentryModule = await loadSentry('@sentry/react').catch(() => null);
      
      if (!sentryModule) {
        if (import.meta.env.DEV) {
          console.log('[Error Tracking] @sentry/react package not installed. Error tracking disabled.');
        }
        isSentryInitialized = true; // Mark as initialized (using console fallback)
        return;
      }
      
      Sentry = sentryModule;
      
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE || 'development',
        tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
        beforeSend(event, hint) {
          // Filter out known non-critical errors
          if (event.exception) {
            const error = hint.originalException;
            if (error instanceof Error) {
              // Don't track network errors (backend not running)
              if (error.message.includes('Failed to fetch') || 
                  error.message.includes('NetworkError') ||
                  error.message.includes('Cannot connect to server')) {
                return null; // Don't send to Sentry
              }
            }
          }
          return event;
        },
      });
      
      isSentryInitialized = true;
      console.log('[Error Tracking] Sentry initialized');
    } catch (error) {
      console.warn('[Error Tracking] Failed to initialize Sentry:', error);
      isSentryInitialized = true; // Mark as initialized (using console fallback)
    }
  })();

  return initPromise;
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (isSentryInitialized && Sentry) {
    Sentry.captureException(error, { extra: context });
  } else {
    // Fallback to console in development
    if (import.meta.env.DEV) {
      console.error('[Error Tracking]', error, context);
    }
  }
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>): void {
  if (isSentryInitialized && Sentry) {
    Sentry.captureMessage(message, { level, extra: context });
  } else {
    // Fallback to console
    if (import.meta.env.DEV || level === 'error') {
      console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log']('[Error Tracking]', message, context);
    }
  }
}

/**
 * Set user context
 */
export function setUserContext(user: { id: string; email: string; name?: string }): void {
  if (isSentryInitialized && Sentry) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  if (isSentryInitialized && Sentry) {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' = 'info', data?: Record<string, any>): void {
  if (isSentryInitialized && Sentry) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
    });
  }
}

export default {
  init: initErrorTracking,
  captureException,
  captureMessage,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
};

