/**
 * Redis Service
 * Manages Redis connection and caching operations
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';

class RedisService {
  private client: RedisClientType | null = null;
  private connected: boolean = false;

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = createClient({
        url: redisUrl,
      });

      this.client.on('error', err => {
        logger.error('Redis Client Error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.connected = true;
      });

      await this.client.connect();
      logger.info('Redis service initialized');
    } catch (error: unknown) {
      logger.warn(
        'Redis connection failed, continuing without cache:',
        error instanceof Error ? error.message : String(error)
      );
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis disconnected');
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.connected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error: unknown) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error: unknown) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error: unknown) {
      logger.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    try {
      let cursor = 0;
      let deleted = 0;
      do {
        const result = await this.client.scan(String(cursor), { MATCH: pattern, COUNT: 100 });
        cursor = typeof result.cursor === 'string' ? parseInt(result.cursor, 10) : result.cursor;
        if (result.keys.length > 0) {
          await this.client.del(result.keys);
          deleted += result.keys.length;
        }
      } while (cursor !== 0);
      return deleted;
    } catch (error: unknown) {
      logger.error(`Redis deletePattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if Redis is available (sync version)
   */
  isAvailable(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Check if Redis is connected (sync version)
   * Alias for isAvailable() for backward compatibility
   */
  isConnected(): boolean {
    return this.isAvailable();
  }

  /**
   * Check if Redis is connected (async version for health checks)
   * Returns a promise that resolves to connection status
   */
  async checkConnection(): Promise<boolean> {
    return this.connected && this.client !== null;
  }

  /**
   * Get connection status string
   */
  getStatus(): 'connected' | 'disconnected' | 'error' {
    if (this.connected && this.client) {
      return 'connected';
    }
    return 'disconnected';
  }
}

export const redisService = new RedisService();
