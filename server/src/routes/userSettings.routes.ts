import express from 'express';
import { UserSettings } from '../models/UserSettings.model.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { userApiKeyEncryption } from '../services/userApiKeyEncryption.service.js';
import { apiKeyProvider } from '../services/apiKeyProvider.service.js';
import { modelRegistry } from '../services/llm/models/ModelRegistry.js';
import { OllamaService } from '../services/llm/providers/OllamaService.js';
import { VLLMService } from '../services/llm/providers/VLLMService.js';
import { OpenAICompatibleService } from '../services/llm/providers/OpenAICompatibleService.js';
import rateLimit from 'express-rate-limit';

// Rate limiter for LLM config test endpoint (prevent abuse)
const testRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many test requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/user/settings
 * Get user settings
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    
    let settings = await UserSettings.findOne({ userId }).lean();
    
    // If no settings exist, create default
    if (!settings) {
      const newSettings = new UserSettings({
        userId,
        currentProjectId: null,
        preferences: {},
        shareLinks: {},
        shareTokens: {}
      });
      await newSettings.save();
      settings = newSettings.toObject();
    }
    
    res.json({
      success: true,
      data: {
        settings: {
          currentProjectId: settings.currentProjectId || null,
          preferences: settings.preferences || {},
          shareLinks: settings.shareLinks || {},
          shareTokens: settings.shareTokens || {}
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/user/settings
 * Update user settings
 */
router.put('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { currentProjectId, preferences, shareLinks, shareTokens } = req.body;
    
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = new UserSettings({
        userId,
        currentProjectId: currentProjectId || null,
        preferences: preferences || {},
        shareLinks: shareLinks || {},
        shareTokens: shareTokens || {}
      });
    } else {
      if (currentProjectId !== undefined) {
        settings.currentProjectId = currentProjectId;
      }
      if (preferences !== undefined) {
        settings.preferences = { ...settings.preferences, ...preferences };
      }
      if (shareLinks !== undefined) {
        settings.shareLinks = { ...settings.shareLinks, ...shareLinks };
      }
      if (shareTokens !== undefined) {
        settings.shareTokens = { ...settings.shareTokens, ...shareTokens };
      }
    }
    
    await settings.save();
    
    logger.info(`User ${userId} updated settings`);
    
    res.json({
      success: true,
      data: {
        settings: {
          currentProjectId: settings.currentProjectId,
          preferences: settings.preferences,
          shareLinks: settings.shareLinks,
          shareTokens: settings.shareTokens
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PATCH /api/user/settings/preference
 * Update a specific preference
 */
router.patch('/preference', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { key, value } = req.body;
    
    if (!key) {
      throw new AppError('Preference key is required', 400);
    }
    
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = new UserSettings({
        userId,
        preferences: { [key]: value }
      });
    } else {
      if (!settings.preferences) {
        settings.preferences = {};
      }
      settings.preferences[key] = value;
    }
    
    await settings.save();
    
    res.json({
      success: true,
      data: {
        preference: { [key]: value }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/user/settings/migrate
 * Migrate localStorage data to database
 */
router.post('/migrate', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { localStorageData } = req.body;
    
    if (!localStorageData || typeof localStorageData !== 'object') {
      throw new AppError('localStorageData is required', 400);
    }
    
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = new UserSettings({
        userId,
        currentProjectId: localStorageData.currentProjectId || null,
        preferences: localStorageData.preferences || {},
        shareLinks: localStorageData.shareLinks || {},
        shareTokens: localStorageData.shareTokens || {}
      });
    } else {
      // Merge with existing settings
      if (localStorageData.currentProjectId) {
        settings.currentProjectId = localStorageData.currentProjectId;
      }
      if (localStorageData.preferences) {
        settings.preferences = { ...settings.preferences, ...localStorageData.preferences };
      }
      if (localStorageData.shareLinks) {
        settings.shareLinks = { ...settings.shareLinks, ...localStorageData.shareLinks };
      }
      if (localStorageData.shareTokens) {
        settings.shareTokens = { ...settings.shareTokens, ...localStorageData.shareTokens };
      }
    }
    
    await settings.save();
    
    logger.info(`User ${userId} migrated localStorage data to database`);
    
    res.json({
      success: true,
      message: 'Settings migrated successfully',
      data: {
        settings: {
          currentProjectId: settings.currentProjectId,
          preferences: settings.preferences,
          shareLinks: settings.shareLinks,
          shareTokens: settings.shareTokens
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/user/settings/llm-config
 * Get user's LLM configuration
 */
router.get('/llm-config', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    // Authorization: Users can only access their own LLM config (enforced by authenticateToken middleware)
    
    const settings = await UserSettings.findOne({ userId }).lean();
    
    if (!settings || !settings.llmConfig) {
      return res.json({
        success: true,
        data: {
          llmConfig: {
            apiKeys: [],
            localLLMs: [],
            apiKeyPreference: 'user_then_platform',
            defaultModels: {}
          }
        }
      });
    }
    
    // Don't send encrypted API keys to frontend - only send provider names
    const apiKeysInfo = (settings.llmConfig.apiKeys || []).map((key: any) => ({
      provider: key.provider,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed
    }));
    
    res.json({
      success: true,
      data: {
        llmConfig: {
          apiKeys: apiKeysInfo,
          localLLMs: settings.llmConfig.localLLMs || [],
          apiKeyPreference: settings.llmConfig.apiKeyPreference || 'user_then_platform',
          defaultModels: settings.llmConfig.defaultModels || {}
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/user/settings/llm-config
 * Update user's LLM configuration
 */
router.put('/llm-config', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    // Authorization: Users can only update their own LLM config (enforced by authenticateToken middleware)
    const { apiKeys, localLLMs, apiKeyPreference, defaultModels } = req.body;
    
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = new UserSettings({ userId });
    }
    
    if (!settings.llmConfig) {
      settings.llmConfig = {
        apiKeys: [],
        localLLMs: [],
        apiKeyPreference: 'user_then_platform',
        defaultModels: {}
      };
    }
    
    // Update API keys (encrypt before storing)
    if (apiKeys && Array.isArray(apiKeys)) {
      const encryptedApiKeys = await Promise.all(
        apiKeys.map(async (key: any) => {
          if (!key.provider || !key.apiKey) {
            throw new AppError('Provider and API key are required', 400);
          }
          
          // Validate format
          const validation = userApiKeyEncryption.validateApiKeyFormat(key.provider, key.apiKey);
          if (!validation.valid) {
            throw new AppError(validation.error || 'Invalid API key format', 400);
          }
          
          // Encrypt the API key
          const encrypted = userApiKeyEncryption.encryptApiKey(userId, key.apiKey);
          
          return {
            provider: key.provider,
            apiKey: encrypted,
            createdAt: key.createdAt || new Date(),
            lastUsed: key.lastUsed
          };
        })
      );
      
      settings.llmConfig.apiKeys = encryptedApiKeys;
      
      // Clear cache for updated providers
      apiKeys.forEach((key: any) => {
        apiKeyProvider.clearUserCache(userId, key.provider as any);
      });
    }
    
    // Update local LLMs
    if (localLLMs && Array.isArray(localLLMs)) {
      settings.llmConfig.localLLMs = localLLMs.map((llm: any) => ({
        type: llm.type,
        baseUrl: llm.baseUrl,
        models: llm.models || [],
        enabled: llm.enabled !== undefined ? llm.enabled : true,
        createdAt: llm.createdAt || new Date(),
        lastTested: llm.lastTested
      }));
      
      // Register/discover models for user
      modelRegistry.clearUserModels(userId);
      for (const llm of localLLMs) {
        if (llm.enabled !== false) {
          try {
            await modelRegistry.registerDiscoveredModels(userId, llm.type, llm.baseUrl);
          } catch (error: any) {
            logger.warn(`Failed to discover models for ${llm.type} at ${llm.baseUrl}:`, error);
            // Continue with other LLMs even if one fails
          }
        }
      }
    }
    
    // Update API key preference
    if (apiKeyPreference) {
      if (!['user', 'platform', 'user_then_platform'].includes(apiKeyPreference)) {
        throw new AppError('Invalid API key preference', 400);
      }
      settings.llmConfig.apiKeyPreference = apiKeyPreference;
    }
    
    // Update default models
    if (defaultModels && typeof defaultModels === 'object') {
      settings.llmConfig.defaultModels = { ...settings.llmConfig.defaultModels, ...defaultModels };
    }
    
    await settings.save();
    
    logger.info(`User ${userId} updated LLM configuration`);
    
    // Return updated config (without encrypted keys)
    const apiKeysInfo = (settings.llmConfig.apiKeys || []).map((key: any) => ({
      provider: key.provider,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed
    }));
    
    res.json({
      success: true,
      data: {
        llmConfig: {
          apiKeys: apiKeysInfo,
          localLLMs: settings.llmConfig.localLLMs || [],
          apiKeyPreference: settings.llmConfig.apiKeyPreference,
          defaultModels: settings.llmConfig.defaultModels || {}
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/user/settings/llm-config/test
 * Test API key or local LLM connection
 * Rate limited to prevent abuse
 */
router.post('/llm-config/test', testRateLimiter, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { type, provider, apiKey, localLLMType, baseUrl } = req.body;
    
    if (type === 'api_key') {
      if (!provider) {
        throw new AppError('Provider is required', 400);
      }
      
      let apiKeyToTest: string | null = null;
      
      // If apiKey is provided, use it (for new keys being tested)
      if (apiKey) {
        apiKeyToTest = apiKey;
      } else {
        // If no apiKey provided, test the saved key from database
        const settings = await UserSettings.findOne({ userId }).lean();
        if (settings?.llmConfig?.apiKeys) {
          const savedKey = settings.llmConfig.apiKeys.find((k: any) => k.provider === provider);
          if (savedKey && savedKey.apiKey) {
            try {
              // Decrypt the saved key
              apiKeyToTest = userApiKeyEncryption.decryptApiKey(userId, savedKey.apiKey);
            } catch (error: any) {
              return res.json({
                success: false,
                error: 'Failed to decrypt saved API key'
              });
            }
          }
        }
      }
      
      if (!apiKeyToTest) {
        return res.json({
          success: false,
          error: 'No API key found to test. Please provide an API key or save one first.'
        });
      }
      
      // Validate format
      const validation = userApiKeyEncryption.validateApiKeyFormat(provider, apiKeyToTest);
      if (!validation.valid) {
        return res.json({
          success: false,
          error: validation.error || 'Invalid API key format'
        });
      }
      
      // Test the API key (basic format check for now)
      const testResult = await userApiKeyEncryption.testApiKey(provider, apiKeyToTest);
      
      // Update lastUsed timestamp if testing saved key
      if (!apiKey && testResult.valid) {
        const settings = await UserSettings.findOne({ userId });
        if (settings && settings.llmConfig) {
          const keyIndex = settings.llmConfig.apiKeys.findIndex(
            (k: any) => k.provider === provider
          );
          if (keyIndex >= 0) {
            settings.llmConfig.apiKeys[keyIndex].lastUsed = new Date();
            await settings.save();
          }
        }
      }
      
      return res.json({
        success: testResult.valid,
        error: testResult.error
      });
    } else if (type === 'local_llm') {
      if (!localLLMType || !baseUrl) {
        throw new AppError('Local LLM type and base URL are required', 400);
      }
      
      try {
        let testResult: { success: boolean; error?: string; models?: string[] };
        
        if (localLLMType === 'ollama') {
          const ollamaService = new OllamaService(baseUrl);
          testResult = await ollamaService.testConnection();
        } else if (localLLMType === 'vllm') {
          const vllmService = new VLLMService(baseUrl);
          testResult = await vllmService.testConnection();
        } else if (localLLMType === 'openai_compatible') {
          const openAIService = new OpenAICompatibleService(baseUrl);
          testResult = await openAIService.testConnection();
        } else {
          throw new AppError('Invalid local LLM type', 400);
        }
        
        // Update lastTested timestamp if successful
        if (testResult.success && userId) {
          const settings = await UserSettings.findOne({ userId });
          if (settings && settings.llmConfig) {
            const llmIndex = settings.llmConfig.localLLMs.findIndex(
              (llm: any) => llm.type === localLLMType && llm.baseUrl === baseUrl
            );
            if (llmIndex >= 0) {
              settings.llmConfig.localLLMs[llmIndex].lastTested = new Date();
              await settings.save();
            }
          }
        }
        
        return res.json({
          success: testResult.success,
          error: testResult.error,
          models: testResult.models
        });
      } catch (error: any) {
        return res.json({
          success: false,
          error: error.message || 'Connection test failed'
        });
      }
    } else {
      throw new AppError('Invalid test type', 400);
    }
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/user/settings/llm-config/api-key/:provider
 * Delete a user's API key for a provider
 */
router.delete('/llm-config/api-key/:provider', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const provider = req.params.provider;
    // Authorization: Users can only delete their own API keys (enforced by authenticateToken middleware)
    
    // Validate provider name to prevent injection
    const validProviders = ['openai', 'anthropic', 'deepseek', 'grok', 'mistral', 'qwen', 'groq', 'openrouter', 'gemini', 'ollama', 'vllm', 'openai_compatible'];
    if (!validProviders.includes(provider.toLowerCase())) {
      throw new AppError('Invalid provider', 400);
    }
    
    const settings = await UserSettings.findOne({ userId });
    
    if (!settings || !settings.llmConfig) {
      return res.json({
        success: true,
        message: 'API key not found'
      });
    }
    
    // Remove the API key
    settings.llmConfig.apiKeys = (settings.llmConfig.apiKeys || []).filter(
      (key: any) => key.provider !== provider
    );
    
    await settings.save();
    
    // Clear cache
    apiKeyProvider.clearUserCache(userId, provider as any);
    
    logger.info(`User ${userId} deleted API key for provider ${provider}`);
    
    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/user/settings/llm-config/local-llm
 * Delete a user's local LLM configuration
 */
router.delete('/llm-config/local-llm', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { type, baseUrl } = req.body;
    
    if (!type || !baseUrl) {
      throw new AppError('Type and baseUrl are required', 400);
    }
    
    // Authorization: Users can only delete their own local LLMs (enforced by authenticateToken middleware)
    
    const settings = await UserSettings.findOne({ userId });
    
    if (!settings || !settings.llmConfig) {
      return res.json({
        success: true,
        message: 'Local LLM not found'
      });
    }
    
    // Remove the local LLM
    const initialLength = settings.llmConfig.localLLMs?.length || 0;
    settings.llmConfig.localLLMs = (settings.llmConfig.localLLMs || []).filter(
      (llm: any) => !(llm.type === type && llm.baseUrl === baseUrl)
    );
    
    if (settings.llmConfig.localLLMs.length === initialLength) {
      return res.json({
        success: false,
        message: 'Local LLM not found'
      });
    }
    
    await settings.save();
    
    // Clear user models from registry
    modelRegistry.clearUserModels(userId);
    
    // Re-register remaining local LLMs
    for (const llm of settings.llmConfig.localLLMs) {
      if (llm.enabled !== false) {
        try {
          await modelRegistry.registerDiscoveredModels(userId, llm.type, llm.baseUrl);
        } catch (error: any) {
          logger.warn(`Failed to discover models for ${llm.type} at ${llm.baseUrl}:`, error);
        }
      }
    }
    
    logger.info(`User ${userId} deleted local LLM: ${type} at ${baseUrl}`);
    
    res.json({
      success: true,
      message: 'Local LLM deleted successfully'
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;










