/**
 * API Key Management Service
 * Handles CRUD operations for API keys with security
 */

import mongoose from 'mongoose';
import { ApiKey, IApiKey } from '../models/ApiKey.model.js';
import { apiKeyEncryption } from './apiKeyEncryption.service.js';
import { logger } from '../utils/logger.js';

export interface ApiKeyInput {
  provider: IApiKey['provider'];
  keyName: string;
  value: string; // Plaintext API key (will be encrypted)
  metadata?: {
    environment?: 'development' | 'staging' | 'production'; // Deprecated - use enabledEnvironments
    enabledEnvironments?: string[]; // Array of environments where this key is active (empty = all environments)
    description?: string;
    tags?: string[];
    additionalConfig?: {
      engineId?: string; // For Google Search: GOOGLE_SEARCH_ENGINE_ID
    };
  };
}

export interface ApiKeyResponse {
  id: string;
  provider: string;
  keyName: string;
  maskedValue: string; // Masked for display
  lastUsed?: Date;
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

class ApiKeyManagementService {
  /**
   * Create a new API key
   */
  async createApiKey(input: ApiKeyInput, userId: string): Promise<ApiKeyResponse> {
    // Validate key format
    const validation = apiKeyEncryption.validateKeyFormat(input.provider, input.value);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Encrypt the API key
    const { encrypted, iv, tag } = apiKeyEncryption.encrypt(input.value);
    const encryptedValue = `${encrypted}:${tag}`; // Store encrypted value with tag

    // Check if there's already an active key for this provider
    const existingActive = await ApiKey.findOne({
      provider: input.provider,
      isActive: true
    });

    // If exists, deactivate it (optional - can have multiple keys)
    if (existingActive) {
      existingActive.isActive = false;
      existingActive.updatedBy = userId as any;
      await existingActive.save();
    }

    // Create new API key
    const apiKey = new ApiKey({
      provider: input.provider,
      keyName: input.keyName,
      encryptedValue,
      iv,
      tag,
      createdBy: userId as any,
      isActive: true,
      metadata: input.metadata
    });

    await apiKey.save();

    logger.info(`API key created for provider: ${input.provider} by user: ${userId}`);

    return this.toResponse(apiKey);
  }

  /**
   * Get all API keys (masked)
   */
  async getAllApiKeys(userId?: string): Promise<ApiKeyResponse[]> {
    const query: any = {};
    if (userId) {
      // Optionally filter by user
    }

    const keys = await ApiKey.find(query).sort({ createdAt: -1 });
    return keys.map(key => this.toResponse(key));
  }

  /**
   * Get API key by ID (masked)
   */
  async getApiKeyById(id: string): Promise<ApiKeyResponse | null> {
    const key = await ApiKey.findById(id);
    if (!key) return null;
    return this.toResponse(key);
  }

  /**
   * Get decrypted API key value (for internal use only - never expose to frontend)
   */
  async getDecryptedKey(id: string): Promise<string | null> {
    const key = await ApiKey.findById(id);
    if (!key || !key.isActive) return null;

    try {
      const [encrypted, tag] = key.encryptedValue.split(':');
      const decrypted = apiKeyEncryption.decrypt(encrypted, key.iv, tag);

      // Update last used timestamp
      key.lastUsed = new Date();
      await key.save();

      return decrypted;
    } catch (error: unknown) {
      logger.error(`Failed to decrypt API key ${id}:`, error);
      return null;
    }
  }

  /**
   * Get active API key for a provider (decrypted - for internal use)
   */
  async getActiveKeyForProvider(provider: IApiKey['provider']): Promise<string | null> {
    // Check if MongoDB is connected before querying
    if (mongoose.connection.readyState !== 1) {
      logger.warn(`MongoDB not connected, cannot retrieve API key for ${provider}`);
      return null;
    }

    try {
      const key = await ApiKey.findOne({
        provider,
        isActive: true
      }).maxTimeMS(5000); // 5 second timeout

      if (!key) return null;

      const [encrypted, tag] = key.encryptedValue.split(':');
      const decrypted = apiKeyEncryption.decrypt(encrypted, key.iv, tag);

      // Update last used timestamp
      key.lastUsed = new Date();
      await key.save();

      return decrypted;
    } catch (error: unknown) {
      // Handle MongoDB timeout errors specifically
      if ((error instanceof Error ? (error instanceof Error ? (error instanceof Error ? error.name : 'Error') : 'Error') : 'Error') === 'MongoServerError' || (error instanceof Error ? (error instanceof Error ? (error instanceof Error ? error.name : 'Error') : 'Error') : 'Error') === 'MongooseError' || (error instanceof Error ? (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)) : String(error))?.includes('buffering timed out')) {
        logger.error(`MongoDB connection issue while retrieving API key for ${provider}:`, (error instanceof Error ? error.message : String(error)));
      } else {
        logger.error(`Failed to decrypt API key for provider ${provider}:`, error);
      }
      return null;
    }
  }

  /**
   * Get active API key with metadata for a provider (for providers that need additional config)
   * Returns both the decrypted API key and metadata (e.g., engineId for Google Search)
   */
  async getActiveKeyWithMetadata(provider: IApiKey['provider']): Promise<{ apiKey: string; metadata?: any } | null> {
    const key = await ApiKey.findOne({
      provider,
      isActive: true
    });

    if (!key) return null;

    try {
      const [encrypted, tag] = key.encryptedValue.split(':');
      const decrypted = apiKeyEncryption.decrypt(encrypted, key.iv, tag);

      // Update last used timestamp
      key.lastUsed = new Date();
      await key.save();

      return {
        apiKey: decrypted,
        metadata: key.metadata
      };
    } catch (error: unknown) {
      logger.error(`Failed to decrypt API key for provider ${provider}:`, error);
      return null;
    }
  }

  /**
   * Update API key (can update name, metadata, or value)
   */
  async updateApiKey(
    id: string,
    updates: Partial<ApiKeyInput>,
    userId: string
  ): Promise<ApiKeyResponse> {
    const key = await ApiKey.findById(id);
    if (!key) {
      throw new Error('API key not found');
    }

    // If updating the value, encrypt it
    if (updates.value) {
      const validation = apiKeyEncryption.validateKeyFormat(key.provider, updates.value);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { encrypted, iv, tag } = apiKeyEncryption.encrypt(updates.value);
      key.encryptedValue = `${encrypted}:${tag}`;
      key.iv = iv;
    }

    if (updates.keyName) key.keyName = updates.keyName;
    if (updates.metadata) key.metadata = { ...key.metadata, ...updates.metadata };
    key.updatedBy = userId as any;

    await key.save();

    logger.info(`API key updated: ${id} by user: ${userId}`);

    return this.toResponse(key);
  }

  /**
   * Deactivate API key (soft delete)
   */
  async deactivateApiKey(id: string, userId: string): Promise<void> {
    const key = await ApiKey.findById(id);
    if (!key) {
      throw new Error('API key not found');
    }

    key.isActive = false;
    key.updatedBy = userId as any;
    await key.save();

    logger.info(`API key deactivated: ${id} by user: ${userId}`);
  }

  /**
   * Delete API key permanently (hard delete)
   */
  async deleteApiKey(id: string, userId: string): Promise<void> {
    const key = await ApiKey.findById(id);
    if (!key) {
      throw new Error('API key not found');
    }

    await ApiKey.deleteOne({ _id: id });

    logger.info(`API key deleted permanently: ${id} by user: ${userId}`);
  }

  /**
   * Convert API key to response format (masked)
   */
  private toResponse(key: IApiKey): ApiKeyResponse {
    // Get a sample of the encrypted value to create a mask
    // We can't decrypt just for display, so we'll use a generic mask
    const maskedValue = apiKeyEncryption.maskKey('••••••••••••••••'); // Generic mask

    return {
      id: key._id.toString(),
      provider: key.provider,
      keyName: key.keyName,
      maskedValue,
      lastUsed: key.lastUsed,
      isActive: key.isActive,
      metadata: key.metadata,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt
    };
  }

  /**
   * Sync API keys to environment config (for backward compatibility)
   * This allows the system to use stored keys instead of env vars
   */
  async syncToConfig(): Promise<Record<string, string>> {
    const keys = await ApiKey.find({ isActive: true });
    const config: Record<string, string> = {};

    for (const key of keys) {
      try {
        const decrypted = await this.getDecryptedKey(key._id.toString());
        if (decrypted) {
          // Map provider to env var name
          const envVarMap: Record<string, string> = {
            'gemini': 'GEMINI_API_KEY',
            'openai': 'OPENAI_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'deepseek': 'DEEPSEEK_API_KEY',
            'grok': 'GROK_API_KEY',
            'mistral': 'MISTRAL_API_KEY',
            'qwen': 'QWEN_API_KEY',
            'huggingface': 'HUGGING_FACE_API_KEY',
            'e2b': 'E2B_API_KEY',
            'google_search': 'GOOGLE_SEARCH_API_KEY'
          };

          const envVar = envVarMap[key.provider];
          if (envVar) {
            config[envVar] = decrypted;
          }
        }
      } catch (error: unknown) {
        logger.error(`Failed to sync key for ${key.provider}:`, error);
      }
    }

    return config;
  }

  /**
   * Migrate API keys from environment variables to the database
   * This ensures backward compatibility for developers using .env files
   */
  async migrateEnvKeysToDb(systemUserId: string = 'system'): Promise<void> {
    try {
      const { config } = await import('../config/env.js');
      const { modelRegistry } = await import('./llm/models/ModelRegistry.js');
      
      const envKeys: Array<{ provider: IApiKey['provider']; keyName: string; value: string }> = [
        { provider: 'gemini', keyName: 'Gemini (.env)', value: config.geminiApiKey },
        { provider: 'openai', keyName: 'OpenAI (.env)', value: config.openaiApiKey },
        { provider: 'anthropic', keyName: 'Anthropic (.env)', value: config.anthropicApiKey },
        { provider: 'deepseek', keyName: 'DeepSeek (.env)', value: config.deepseekApiKey },
        { provider: 'grok', keyName: 'Grok (.env)', value: config.grokApiKey },
        { provider: 'mistral', keyName: 'Mistral (.env)', value: config.mistralApiKey },
        { provider: 'qwen', keyName: 'Qwen (.env)', value: config.qwenApiKey },
        { provider: 'e2b', keyName: 'E2B Sandbox (.env)', value: config.e2bApiKey },
        { provider: 'huggingface', keyName: 'Hugging Face (.env)', value: config.huggingFaceApiKey }
      ];

      for (const { provider, keyName, value } of envKeys) {
        if (!value || value.trim() === '') continue;

        // Check if provider already has an active key in database
        const existingKey = await this.getActiveKeyForProvider(provider);
        if (existingKey) continue;

        logger.info(`Migrating ${provider} API key from environment variables to database...`);
        
        try {
          await this.createApiKey({ provider, keyName, value }, systemUserId);
          
          // Auto-enable models for this provider
          const allModels = modelRegistry.getAllModels();
          for (const model of allModels) {
            if (model.provider === provider && !model.isEnabled) {
              await modelRegistry.updateModel(model.id, { isEnabled: true, status: 'active' });
              logger.info(`Auto-enabled model ${model.id} since the ${provider} API key was migrated.`);
            }
          }
        } catch (error: unknown) {
          logger.error(`Failed to migrate ${provider} API key:`, error);
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to run environment API key migration:', error);
    }
  }
}

export const apiKeyManagement = new ApiKeyManagementService();










