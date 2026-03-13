import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Request timeout middleware
 * Automatically cancels requests that exceed the timeout duration
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timeout: ${req.method} ${req.path} (${timeoutMs}ms)`);
        res.status(408).json({
          success: false,
          error: {
            message: `Request timed out after ${timeoutMs / 1000} seconds`,
            code: 'REQUEST_TIMEOUT'
          }
        });
      }
    }, timeoutMs);

    // Clear timeout on response finish
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    // Clear timeout on response close
    res.on('close', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
}

/**
 * Route-specific timeout middleware
 * Allows different timeouts for different routes
 */
export function routeTimeout(timeoutMs: number) {
  return requestTimeout(timeoutMs);
}






