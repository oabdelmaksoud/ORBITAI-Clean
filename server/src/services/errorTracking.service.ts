/**
 * Backend Error Tracking Service
 * Centralized error tracking with Sentry integration (optional)
 */

import { logger } from '../utils/logger.js';

// Sentry integration (optional - only if SENTRY_DSN is set)
let Sentry: any = null;
let isSentryInitialized = false;

/**
 * Initialize error tracking
 */
export async function initErrorTracking(): Promise<void> {
  if (isSentryInitialized) {
    return;
  }

  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn) {
    logger.info('[Error Tracking] Sentry DSN not configured, using logger fallback');
    isSentryInitialized = true;
    return;
  }

  try {
    // Dynamic import to avoid bundle size if not using Sentry
    const sentryModule = await import('@sentry/node').catch(() => null);

    if (!sentryModule) {
      logger.info('[Error Tracking] @sentry/node package not installed. Error tracking disabled.');
      isSentryInitialized = true;
      return;
    }

    Sentry = sentryModule;

    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }), // Will be set later
      ],
      beforeSend(event, hint) {
        // Filter out known non-critical errors
        if (event.exception) {
          const error = hint.originalException;
          if (error instanceof Error) {
            // Don't track validation errors (expected)
            if (error.message.includes('validation') || error.message.includes('Validation')) {
              return null;
            }
          }
        }
        return event;
      },
    });

    isSentryInitialized = true;
    logger.info('[Error Tracking] Sentry initialized');
  } catch (error: unknown) {
    logger.warn('[Error Tracking] Failed to initialize Sentry:', error.message);
    isSentryInitialized = true; // Mark as initialized (using logger fallback)
  }
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (isSentryInitialized && Sentry) {
    Sentry.captureException(error, { extra: context });
  } else {
    // Fallback to logger
    logger.error('Exception:', {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>): void {
  if (isSentryInitialized && Sentry) {
    Sentry.captureMessage(message, { level, extra: context });
  } else {
    // Fallback to logger
    logger[level](`[Error Tracking] ${message}`, context);
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

export default {
  init: initErrorTracking,
  captureException,
  captureMessage,
  setUserContext,
  clearUserContext,
};


