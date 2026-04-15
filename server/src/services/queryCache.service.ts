/**
 * Query Cache Service
 * Caches frequently accessed database queries in Redis for improved performance
 */

import { redisService } from './redis.service.js';
import { logger } from '../utils/logger.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  keyPrefix?: string; // Prefix for cache key
}

export class QueryCacheService {
  /**
   * Get cached query result
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redisService.isAvailable()) {
      return null; // Cache unavailable, return null to fetch from DB
    }

    try {
      const cacheKey = this.buildCacheKey(key);
      const cached = await redisService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug(`[QueryCache] Cache hit for key: ${cacheKey}`);
        return cached;
      }
      
      logger.debug(`[QueryCache] Cache miss for key: ${cacheKey}`);
      return null;
    } catch (error: unknown) {
      logger.warn(`[QueryCache] Error getting cache for key ${key}:`, error);
      return null; // On error, return null to fetch from DB
    }
  }

  /**
   * Set cached query result
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    if (!redisService.isAvailable()) {
      return false; // Cache unavailable, skip caching
    }

    try {
      const cacheKey = this.buildCacheKey(key, options?.keyPrefix);
      const ttl = options?.ttl || 300; // Default 5 minutes
      
      const success = await redisService.set(cacheKey, value, ttl);
      
      if (success) {
        logger.debug(`[QueryCache] Cached result for key: ${cacheKey} (TTL: ${ttl}s)`);
      }
      
      return success;
    } catch (error: unknown) {
      logger.warn(`[QueryCache] Error setting cache for key ${key}:`, error);
      return false; // On error, continue without cache
    }
  }

  /**
   * Invalidate cache by key pattern
   */
  async invalidate(pattern: string): Promise<number> {
    if (!redisService.isAvailable()) {
      return 0;
    }

    try {
      const cachePattern = this.buildCacheKey(pattern);
      const deleted = await redisService.deletePattern(cachePattern);
      
      if (deleted > 0) {
        logger.debug(`[QueryCache] Invalidated ${deleted} cache entries matching pattern: ${cachePattern}`);
      }
      
      return deleted;
    } catch (error: unknown) {
      logger.warn(`[QueryCache] Error invalidating cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate all cache entries for a specific entity type
   */
  async invalidateEntity(entityType: string, entityId?: string): Promise<number> {
    const pattern = entityId 
      ? `${entityType}:${entityId}:*`
      : `${entityType}:*`;
    return this.invalidate(pattern);
  }

  /**
   * Build cache key with prefix
   */
  private buildCacheKey(key: string, prefix?: string): string {
    const cachePrefix = prefix || 'query';
    return `${cachePrefix}:${key}`;
  }

  /**
   * Cache wrapper for async functions
   * Automatically caches function results
   */
  async cache<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - execute function
    const result = await fn();

    // Cache the result
    await this.set(key, result, options);

    return result;
  }
}

export const queryCacheService = new QueryCacheService();
