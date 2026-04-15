/**
 * Sentry Error Tracking Integration
 * Provides error tracking and monitoring for production
 */

import * as Sentry from '@sentry/node';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let initialized = false;

/**
 * Initialize Sentry
 */
export function initSentry(dsn?: string): void {
  if (initialized) {
    logger.warn('Sentry already initialized');
    return;
  }

  const sentryDsn = dsn || process.env.SENTRY_DSN;

  if (!sentryDsn) {
    logger.info('Sentry DSN not configured, skipping initialization');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.nodeEnv,
      tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
      beforeSend(event: any, _hint: any) {
        // Filter out sensitive data
        if (event.request) {
          // Remove sensitive headers
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
      ],
    });

    initialized = true;
    logger.info('Sentry initialized successfully');
  } catch (error: unknown) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (!initialized) {
    logger.error('Sentry not initialized:', error);
    return;
  }

  Sentry.withScope((scope: any) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: any = 'info'): void {
  if (!initialized) {
    logger.info(message);
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Set user context
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  if (!initialized) return;
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!initialized) return;
  Sentry.setUser(null);
}

export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
};
