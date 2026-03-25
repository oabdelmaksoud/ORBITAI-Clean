/**
 * Redis Service
 * Manages Redis connection and caching operations
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

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

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.connected = true;
      });

      await this.client.connect();
      logger.info('Redis service initialized');
    } catch (error: any) {
      logger.warn('Redis connection failed, continuing without cache:', error.message);
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await this.client.del(keys);
      return keys.length;
    } catch (error) {
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


