/**
 * API Key Provider Service
 * SECURITY: API keys are ONLY retrieved from encrypted database storage
 * Environment variables are NOT used to prevent security breaches
 * 
 * To add API keys: Admin Console → Settings → API Keys
 */

import { apiKeyManagement } from './apiKeyManagement.service.js';
import { logger } from '../utils/logger.js';
import { UserSettings } from '../models/UserSettings.model.js';
import { userApiKeyEncryption } from './userApiKeyEncryption.service.js';

export type APIKeyProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'huggingface' | 'e2b' | 'google_search' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'custom' | 'ollama' | 'vllm' | 'openai_compatible' | 'tripo' | 'flux' | 'sloyd';

export type ApiKeyPreference = 'user' | 'platform' | 'user_then_platform';

class APIKeyProviderService {
  private cache: Map<APIKeyProvider, string | null> = new Map();
  private cacheExpiry: Map<APIKeyProvider, number> = new Map();
  private userCache: Map<string, Map<APIKeyProvider, string | null>> = new Map(); // userId -> provider -> key
  private userCacheExpiry: Map<string, Map<APIKeyProvider, number>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get API key for a provider (database ONLY - no environment variable fallback)
   * SECURITY: Only uses encrypted database storage to prevent API key exposure
   * 
   * @param silent - If true, don't log warnings when key is not found (useful for existence checks)
   * @throws Error if key not found in database with instructions to add via Admin Console
   */
  async getApiKey(provider: APIKeyProvider, silent: boolean = false): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(provider);
    const expiry = this.cacheExpiry.get(provider);
    if (cached !== undefined && expiry && Date.now() < expiry) {
      return cached;
    }

    try {
      // Only use database (encrypted, secure)
      const dbKey = await apiKeyManagement.getActiveKeyForProvider(provider);
      if (dbKey) {
        this.cache.set(provider, dbKey);
        this.cacheExpiry.set(provider, Date.now() + this.CACHE_TTL);
        logger.debug(`API key for ${provider} retrieved from database`);
        return dbKey;
      }
    } catch (error) {
      logger.error(`Failed to get API key from database for ${provider}:`, error);
    }

    // No key found - return null (don't fallback to env vars for security)
    if (!silent) {
      logger.warn(`⚠️  API key for ${provider} not found in database. Add it via Admin Console → Settings → API Keys`);
    }
    this.cache.set(provider, null);
    this.cacheExpiry.set(provider, Date.now() + this.CACHE_TTL);
    return null;
  }

  /**
   * Get API key with metadata for providers that need additional configuration
   * (e.g., Google Search needs engineId alongside the API key)
   */
  async getApiKeyWithMetadata(provider: APIKeyProvider): Promise<{ apiKey: string; metadata?: any } | null> {
    try {
      const result = await apiKeyManagement.getActiveKeyWithMetadata(provider);
      if (result) {
        return result;
      }
    } catch (error) {
      logger.error(`Failed to get API key with metadata from database for ${provider}:`, error);
    }

    return null;
  }

  /**
   * Get Google Search Engine ID from database (stored in API key metadata)
   */
  async getGoogleSearchEngineId(): Promise<string | null> {
    try {
      const result = await this.getApiKeyWithMetadata('google_search');
      if (result && result.metadata?.additionalConfig?.engineId) {
        return result.metadata.additionalConfig.engineId;
      }
    } catch (error) {
      logger.error('Failed to get Google Search Engine ID from database:', error);
    }

    return null;
  }

  /**
   * Check if API key is configured (database ONLY)
   */
  async hasApiKey(provider: APIKeyProvider): Promise<boolean> {
    const key = await this.getApiKey(provider, true); // Silent check - don't log warnings
    return !!key && key.trim().length > 0;
  }

  /**
   * Check if API key exists in database
   */
  async hasDatabaseKey(provider: APIKeyProvider): Promise<boolean> {
    try {
      const dbKey = await apiKeyManagement.getActiveKeyForProvider(provider);
      return !!dbKey && dbKey.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API key source (always 'database' or 'none' - no environment fallback)
   */
  async getApiKeySource(provider: APIKeyProvider): Promise<'database' | 'none'> {
    if (await this.hasDatabaseKey(provider)) {
      return 'database';
    }
    return 'none';
  }

  /**
   * Clear cache for a provider (useful after key updates)
   */
  clearCache(provider?: APIKeyProvider): void {
    if (provider) {
      this.cache.delete(provider);
      this.cacheExpiry.delete(provider);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get all configured providers (database ONLY)
   */
  async getConfiguredProviders(): Promise<APIKeyProvider[]> {
    const providers: APIKeyProvider[] = [
      'gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'mistral',
      'qwen', 'e2b', 'google_search', 'openrouter', 'groq', 'vertex', 'azure',
      'tripo', 'flux', 'sloyd'
    ];

    const configured: APIKeyProvider[] = [];

    for (const provider of providers) {
      if (await this.hasDatabaseKey(provider)) {
        configured.push(provider);
      }
    }

    return configured;
  }

  /**
   * Get user API key for a provider (decrypted)
   */
  async getUserApiKey(userId: string, provider: APIKeyProvider): Promise<string | null> {
    if (!userId) {
      return null;
    }

    // Check user cache first
    const userCacheMap = this.userCache.get(userId);
    const userExpiryMap = this.userCacheExpiry.get(userId);
    if (userCacheMap && userExpiryMap) {
      const cached = userCacheMap.get(provider);
      const expiry = userExpiryMap.get(provider);
      if (cached !== undefined && expiry && Date.now() < expiry) {
        return cached;
      }
    }

    try {
      const userSettings = await UserSettings.findOne({ userId }).lean();
      if (!userSettings || !userSettings.llmConfig || !userSettings.llmConfig.apiKeys) {
        return null;
      }

      const apiKeyEntry = userSettings.llmConfig.apiKeys.find(
        (key: any) => key.provider === provider
      );

      if (!apiKeyEntry || !apiKeyEntry.apiKey) {
        return null;
      }

      // Decrypt the API key
      try {
        const decryptedKey = userApiKeyEncryption.decryptApiKey(userId, apiKeyEntry.apiKey);

        // Update cache
        if (!userCacheMap) {
          this.userCache.set(userId, new Map());
          this.userCacheExpiry.set(userId, new Map());
        }
        this.userCache.get(userId)!.set(provider, decryptedKey);
        this.userCacheExpiry.get(userId)!.set(provider, Date.now() + this.CACHE_TTL);

        // Update lastUsed timestamp (async, don't wait)
        UserSettings.updateOne(
          { userId, 'llmConfig.apiKeys.provider': provider },
          { $set: { 'llmConfig.apiKeys.$.lastUsed': new Date() } }
        ).catch(err => logger.error('Failed to update lastUsed:', err));

        return decryptedKey;
      } catch (decryptError: any) {
        logger.error(`Failed to decrypt API key for user ${userId}, provider ${provider}:`, decryptError);
        return null;
      }
    } catch (error: unknown) {
      logger.error(`Failed to get user API key for ${userId}, provider ${provider}:`, error);
      return null;
    }
  }

  /**
   * Get API key for a request with fallback strategy
   * @param userId - User ID (optional, for user-specific keys)
   * @param provider - API key provider
   * @param preference - Preference strategy ('user', 'platform', 'user_then_platform')
   * @returns API key or null if not found
   */
  async getApiKeyForRequest(
    userId: string | undefined,
    provider: APIKeyProvider,
    preference?: ApiKeyPreference
  ): Promise<{ apiKey: string | null; source: 'user' | 'platform' | 'none' }> {
    // For local LLMs, we don't need API keys
    if (['ollama', 'vllm', 'openai_compatible'].includes(provider)) {
      return { apiKey: null, source: 'none' };
    }

    // Get effective preference (check provider override first, then global preference, then default)
    const effectivePreference = preference || (userId ? await this.getEffectiveApiKeyPreference(userId, provider) : 'user_then_platform');

    // Try user key first if preference allows
    if (userId && (effectivePreference === 'user' || effectivePreference === 'user_then_platform')) {
      const userKey = await this.getUserApiKey(userId, provider);
      if (userKey) {
        return { apiKey: userKey, source: 'user' };
      }
    }

    // Try platform key if preference allows
    if (effectivePreference === 'platform' || effectivePreference === 'user_then_platform') {
      const platformKey = await this.getApiKey(provider);
      if (platformKey) {
        return { apiKey: platformKey, source: 'platform' };
      }
    }

    // If user preference is 'user' only and no user key found, return null
    if (effectivePreference === 'user') {
      return { apiKey: null, source: 'none' };
    }

    return { apiKey: null, source: 'none' };
  }

  /**
   * Get user's API key preference
   */
  async getUserApiKeyPreference(userId: string): Promise<ApiKeyPreference> {
    try {
      const userSettings = await UserSettings.findOne({ userId }).lean();
      if (userSettings?.llmConfig?.apiKeyPreference) {
        return userSettings.llmConfig.apiKeyPreference as ApiKeyPreference;
      }
    } catch (error) {
      logger.error(`Failed to get API key preference for user ${userId}:`, error);
    }
    return 'user_then_platform'; // Default
  }

  /**
   * Get effective API key preference for a specific provider.
   * Checks provider override first, then falls back to global preference.
   */
  async getEffectiveApiKeyPreference(
    userId: string,
    provider: APIKeyProvider
  ): Promise<ApiKeyPreference> {
    try {
      const userSettings = await UserSettings.findOne({ userId }).lean();
      if (!userSettings?.llmConfig) {
        return 'user_then_platform';
      }

      // Check for provider-specific override
      const override = userSettings.llmConfig.providerOverrides?.[provider];
      if (override) {
        return override as ApiKeyPreference;
      }

      // Use global preference
      return (userSettings.llmConfig.apiKeyPreference || 'user_then_platform') as ApiKeyPreference;
    } catch (error) {
      logger.error(`Failed to get effective API key preference for user ${userId}, provider ${provider}:`, error);
      return 'user_then_platform'; // Default to fallback
    }
  }

  /**
   * Clear user cache for a provider or all providers
   */
  clearUserCache(userId: string, provider?: APIKeyProvider): void {
    if (provider) {
      this.userCache.get(userId)?.delete(provider);
      this.userCacheExpiry.get(userId)?.delete(provider);
    } else {
      this.userCache.delete(userId);
      this.userCacheExpiry.delete(userId);
    }
  }

  /**
   * Check if user has API key for a provider
   */
  async hasUserApiKey(userId: string, provider: APIKeyProvider): Promise<boolean> {
    const key = await this.getUserApiKey(userId, provider);
    return !!key && key.trim().length > 0;
  }
}

export const apiKeyProvider = new APIKeyProviderService();










