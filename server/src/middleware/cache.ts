/**
 * Cache Middleware
 * Provides response caching for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis.service.js';
import { logger } from '../utils/logger.js';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
}

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Cache middleware factory
 */
export function cache(options: CacheOptions = {}) {
  const { ttl = DEFAULT_TTL, keyGenerator, skipCache } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip cache if Redis is not available
    if (!redisService.isAvailable()) {
      return next();
    }

    // Skip cache if skipCache function returns true
    if (skipCache && skipCache(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.method}:${req.path}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    try {
      const cached = await redisService.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit: ${cacheKey}`);
        res.json(cached); return;
      }
    } catch (error: unknown) {
      logger.warn('Cache read error:', error);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Cache the response
      if (res.statusCode === 200) {
        redisService.set(cacheKey, body, ttl).catch((err) => {
          logger.warn('Cache write error:', err);
        });
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  if (redisService.isAvailable()) {
    await redisService.deletePattern(pattern);
  }
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  user: (userId: string) => `user:${userId}`,
  project: (projectId: string) => `project:${projectId}`,
  featureFlag: (key: string) => `feature:${key}`,
  apiResponse: (method: string, path: string, query?: any) =>
    `api:${method}:${path}${query ? `:${query}` : ''}`,
};


