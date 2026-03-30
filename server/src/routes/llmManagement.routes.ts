/**
 * LLM Management Routes - Admin endpoints for managing LLM configuration
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { modelRegistry } from '../services/llm/models/ModelRegistry.js';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { config } from '../config/env.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logger } from '../utils/logger.js';
import { apiKeyProvider } from '../services/apiKeyProvider.service.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/llm/models
 * Get all LLM models and their configuration
 */
router.get('/models', async (_req: AdminRequest, res, next) => {
  try {
    // Ensure registry is initialized from database
    if (!modelRegistry.isInitialized()) {
      await modelRegistry.initialize();
    }
    
    const models = modelRegistry.getAllModels();
    
    // Get provider status from database (preferred) or environment
    // Check all supported providers
    const providerList: Array<{ key: string; provider: any }> = [
      { key: 'gemini', provider: 'gemini' },
      { key: 'openai', provider: 'openai' },
      { key: 'anthropic', provider: 'anthropic' },
      { key: 'deepseek', provider: 'deepseek' },
      { key: 'grok', provider: 'grok' },
      { key: 'mistral', provider: 'mistral' },
      { key: 'qwen', provider: 'qwen' },
      { key: 'openrouter', provider: 'openrouter' },
      { key: 'groq', provider: 'groq' },
      { key: 'vertex', provider: 'vertex' },
      { key: 'azure', provider: 'azure' },
      { key: 'e2b', provider: 'e2b' }
    ];

    const providerStatuses = await Promise.all(
      providerList.map(({ provider }) => apiKeyProvider.getApiKeySource(provider))
    );

    // Build providers object dynamically
    const providers: Record<string, { enabled: boolean; configured: boolean; source: string }> = {};
    providerList.forEach(({ key }, index) => {
      const source = providerStatuses[index];
      providers[key] = {
        enabled: source !== 'none',
        configured: source !== 'none',
        source
      };
    });

    // Add API key configuration status to each model
    // NOTE: We don't auto-disable models here - that would overwrite user choices on every page load
    // The POST /models/:id/enable endpoint already prevents enabling models without API keys
    const modelsWithApiKeyStatus = await Promise.all(
      models.map(async (model) => {
        const providerKey = model.provider.toLowerCase();
        const hasApiKey = await apiKeyProvider.hasApiKey(providerKey as any);
        const apiKeySource = await apiKeyProvider.getApiKeySource(providerKey as any);
        
        return {
          ...model,
          apiKeyConfigured: hasApiKey,
          apiKeySource: apiKeySource
        };
      })
    );

    res.json({
      success: true,
      data: {
        models: modelsWithApiKeyStatus,
        config: {
          enableMultiLLM: config.enableMultiLLM,
          defaultLLMProvider: config.defaultLLMProvider,
          llmRoutingStrategy: config.llmRoutingStrategy,
          providers
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/llm/models/:id
 * Update a model configuration (enable/disable, status, etc.)
 */
router.put('/models/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const model = modelRegistry.getModel(id);
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Allowed updates
    const allowedUpdates: (keyof typeof updates)[] = [
      'isEnabled',
      'status',
      'pricing',
      'performance'
    ];

    const filteredUpdates: any = {};
    allowedUpdates.forEach(key => {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    });

    const success = await modelRegistry.updateModel(id, filteredUpdates);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update model'
      });
    }

    // Verify the save was successful by checking the database
    try {
      const { LLMModelConfig } = await import('../../models/LLMModelConfig.model.js');
      const savedConfig = await LLMModelConfig.findOne({ modelId: id });
      
      if (savedConfig) {
        // Verify isEnabled if it was updated
        if (filteredUpdates.isEnabled !== undefined && savedConfig.isEnabled !== filteredUpdates.isEnabled) {
          logger.error(`Database verification failed for model ${id}: Expected isEnabled=${filteredUpdates.isEnabled}, got ${savedConfig.isEnabled}`);
          return res.status(500).json({
            success: false,
            message: 'Model state was not saved correctly. Please try again.'
          });
        }
        
        // Verify status if it was updated
        if (filteredUpdates.status !== undefined && savedConfig.status !== filteredUpdates.status) {
          logger.error(`Database verification failed for model ${id}: Expected status=${filteredUpdates.status}, got ${savedConfig.status}`);
          return res.status(500).json({
            success: false,
            message: 'Model status was not saved correctly. Please try again.'
          });
        }
        
        logger.info(`Verified model ${id} update saved to database:`, {
          isEnabled: savedConfig.isEnabled,
          status: savedConfig.status,
          updates: filteredUpdates
        });
      }
    } catch (verifyError: any) {
      logger.warn(`Could not verify database save for model ${id}:`, verifyError.message);
      // Continue anyway since the save operation reported success
    }

    await logAudit(req, {
      action: 'llm.model.updated',
      entityType: 'LLM Model',
      entityId: id,
      details: {
        modelId: id,
        updates: filteredUpdates
      }
    });

    logger.info(`Admin ${req.admin?.email} updated LLM model ${id}`);

    // Reload model from database to ensure we return the correct state
    await modelRegistry.initialize();
    const updatedModel = modelRegistry.getModel(id);
    if (!updatedModel) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Add API key configuration status to the model (same as GET /models endpoint)
    const providerKey = updatedModel.provider.toLowerCase();
    const hasApiKey = await apiKeyProvider.hasApiKey(providerKey as any);
    const apiKeySource = await apiKeyProvider.getApiKeySource(providerKey as any);
    
    const modelWithApiKeyStatus = {
      ...updatedModel,
      apiKeyConfigured: hasApiKey,
      apiKeySource: apiKeySource
    };

    res.json({
      success: true,
      data: {
        model: modelWithApiKeyStatus
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/llm/models/:id/enable
 * Enable or disable a model
 */
router.post('/models/:id/enable', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    // Ensure registry is initialized from database
    if (!modelRegistry.isInitialized()) {
      await modelRegistry.initialize();
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean'
      });
    }

    const model = modelRegistry.getModel(id);
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Check if API key is configured for the provider (database first, then env fallback)
    if (enabled) {
      const hasKey = await apiKeyProvider.hasApiKey(model.provider as any);
      const keySource = await apiKeyProvider.getApiKeySource(model.provider as any);
      
      if (!hasKey) {
        const providerNames: Record<string, string> = {
          'openai': 'OpenAI',
          'anthropic': 'Anthropic',
          'gemini': 'Gemini',
          'deepseek': 'DeepSeek',
          'grok': 'Grok',
          'mistral': 'Mistral',
          'qwen': 'Qwen',
          'openrouter': 'OpenRouter',
          'groq': 'Groq',
          'vertex': 'Vertex AI',
          'azure': 'Azure OpenAI'
        };
        
        const providerName = providerNames[model.provider] || model.provider;
        return res.status(400).json({
          success: false,
          message: `${providerName} API key not configured. Please add it via API Keys Management in the Admin Dashboard (recommended for security) or environment variables.`
        });
      }
      
      // Log if using environment variable (less secure)
      if (keySource === 'environment') {
        logger.warn(`⚠️  Model ${model.id} enabled using environment variable API key. Consider migrating to database storage for better security.`);
      }
    }

    const success = await modelRegistry.enableModel(id, enabled);

    if (!success) {
      logger.error(`Failed to enable/disable model ${id}: Database persistence failed`);
      return res.status(500).json({
        success: false,
        message: 'Failed to save model state to database. Please try again or check server logs.'
      });
    }

    // Verify the save was successful by checking the database
    try {
      const { LLMModelConfig } = await import('../../models/LLMModelConfig.model.js');
      const savedConfig = await LLMModelConfig.findOne({ modelId: id });
      
      if (savedConfig && savedConfig.isEnabled !== enabled) {
        logger.error(`Database verification failed for model ${id}: Expected isEnabled=${enabled}, got ${savedConfig.isEnabled}`);
        return res.status(500).json({
          success: false,
          message: 'Model state was not saved correctly. Please try again.'
      });
      }
      
      logger.info(`Verified model ${id} state saved to database: isEnabled=${enabled}`);
    } catch (verifyError: any) {
      logger.warn(`Could not verify database save for model ${id}:`, verifyError.message);
      // Continue anyway since the save operation reported success
    }

    await logAudit(req, {
      action: enabled ? 'llm.model.enabled' : 'llm.model.disabled',
      entityType: 'LLM Model',
      entityId: id,
      details: {
        modelId: id,
        enabled
      }
    });

    logger.info(`Admin ${req.admin?.email} ${enabled ? 'enabled' : 'disabled'} LLM model ${id}`);

    const updatedModel = modelRegistry.getModel(id);
    if (!updatedModel) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }
    
    // Ensure the returned model has the correct isEnabled state
    if (updatedModel.isEnabled !== enabled) {
      logger.warn(`Model ${id} in-memory state (${updatedModel.isEnabled}) doesn't match requested state (${enabled}). Reloading from database.`);
      await modelRegistry.initialize();
      const reloadedModel = modelRegistry.getModel(id);
      if (!reloadedModel) {
        return res.status(404).json({
          success: false,
          message: 'Model not found after reload'
        });
      }
      // Use the reloaded model
      const finalModel = reloadedModel;
      
      // Add API key configuration status to the reloaded model
      const providerKey = finalModel.provider.toLowerCase();
      const hasApiKey = await apiKeyProvider.hasApiKey(providerKey as any);
      const apiKeySource = await apiKeyProvider.getApiKeySource(providerKey as any);
      
      const modelWithApiKeyStatus = {
        ...finalModel,
        apiKeyConfigured: hasApiKey,
        apiKeySource: apiKeySource
      };

      return res.json({
        success: true,
        data: {
          model: modelWithApiKeyStatus,
          message: `Model ${enabled ? 'enabled' : 'disabled'} successfully`
        }
      });
    }

    // Add API key configuration status to the model (same as GET /models endpoint)
    const providerKey = updatedModel.provider.toLowerCase();
    const hasApiKey = await apiKeyProvider.hasApiKey(providerKey as any);
    const apiKeySource = await apiKeyProvider.getApiKeySource(providerKey as any);
    
    const modelWithApiKeyStatus = {
      ...updatedModel,
      apiKeyConfigured: hasApiKey,
      apiKeySource: apiKeySource
    };

    res.json({
      success: true,
      data: {
        model: modelWithApiKeyStatus,
        message: `Model ${enabled ? 'enabled' : 'disabled'} successfully`
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/llm/config
 * Get LLM system configuration
 */
router.get('/config', async (_req: AdminRequest, res, next) => {
  try {
    // Get provider status from database (preferred) or environment
    // Check all supported providers
    const providerList: Array<{ key: string; provider: any }> = [
      { key: 'gemini', provider: 'gemini' },
      { key: 'openai', provider: 'openai' },
      { key: 'anthropic', provider: 'anthropic' },
      { key: 'deepseek', provider: 'deepseek' },
      { key: 'grok', provider: 'grok' },
      { key: 'mistral', provider: 'mistral' },
      { key: 'qwen', provider: 'qwen' },
      { key: 'openrouter', provider: 'openrouter' },
      { key: 'groq', provider: 'groq' },
      { key: 'vertex', provider: 'vertex' },
      { key: 'azure', provider: 'azure' },
      { key: 'e2b', provider: 'e2b' }
    ];

    const providerStatuses = await Promise.all(
      providerList.map(({ provider }) => apiKeyProvider.getApiKeySource(provider))
    );

    // Build providers object dynamically
    const providers: Record<string, { configured: boolean; hasKey: boolean; source: string }> = {};
    providerList.forEach(({ key }, index) => {
      const source = providerStatuses[index];
      providers[key] = {
        configured: source !== 'none',
        hasKey: source !== 'none',
        source
      };
    });

    res.json({
      success: true,
      data: {
        enableMultiLLM: config.enableMultiLLM,
        defaultLLMProvider: config.defaultLLMProvider,
        llmRoutingStrategy: config.llmRoutingStrategy,
        providers
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/llm/test/:id
 * Test a specific model
 */
router.post('/test/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;

    const model = modelRegistry.getModel(id);
    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    // Prevent testing deprecated or maintenance models
    if (model.status === 'deprecated' || model.status === 'maintenance') {
      return res.status(400).json({
        success: false,
        message: `Model is ${model.status}. ${model.status === 'deprecated' ? 'This model is no longer available.' : 'This model is under maintenance and not available for testing.'}`,
        status: model.status
      });
    }

    if (!model.isEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Model is not enabled'
      });
    }

    // Check if API key is configured (database first, then env fallback)
    // Clear cache before checking to ensure we get the latest keys
    apiKeyProvider.clearCache(model.provider as any);
    const apiKeyConfigured = await apiKeyProvider.hasApiKey(model.provider as any);
    const apiKeySource = await apiKeyProvider.getApiKeySource(model.provider as any);
    
    const providerNames: Record<string, string> = {
      'openai': 'OpenAI',
      'anthropic': 'Anthropic',
      'gemini': 'Gemini',
      'deepseek': 'DeepSeek',
      'grok': 'Grok',
      'mistral': 'Mistral',
      'qwen': 'Qwen',
      'openrouter': 'OpenRouter',
      'groq': 'Groq',
      'vertex': 'Vertex AI',
      'azure': 'Azure OpenAI'
    };
    
    const providerName = providerNames[model.provider] || model.provider;
    const apiKeyMessage = apiKeyConfigured 
      ? '' 
      : `${providerName} API key not configured. Please add it via API Keys Management in the Admin Dashboard (recommended for security) or environment variables.`;

    if (!apiKeyConfigured) {
      return res.json({
        success: true, // Keep true so frontend can handle gracefully
        data: {
          model: model.id,
          status: 'test_failed', // Explicitly set to test_failed
          error: apiKeyMessage,
          message: apiKeyMessage || `${providerName} API key not configured. Please add it via API Keys Management.`,
          testResult: {
            response: undefined,
            modelUsed: model.id,
            provider: model.provider,
            tokensUsed: 0,
            fallbackUsed: false
          }
        }
      });
    }

    // Real model testing using LLM Router
    // IMPORTANT: Do NOT use cache for testing - we need to verify the API key actually works
    // Also validate that the API key actually works by catching authentication errors
    try {
      const testPrompt = `Test-${Date.now()}: Respond with "OK" if you can read this message.`; // Add timestamp to prevent cache hits
      
      // Make the test call
      const testResult = await llmRouter.executeWithSpecificModel(
        testPrompt,
        model.modelIdentifier || model.id, // Use modelIdentifier (e.g., 'gemini-3-pro-preview') instead of id
        {
          systemInstruction: 'You are a test assistant. Respond briefly.'
        },
        false, // Don't fallback during testing
        undefined, // No routing context
        'test', // Request type: test
        'other' // Context type
      );
      
      // Additional validation: Check if the response looks valid
      // If we got a response but it's an error message about API keys, fail the test
      if (testResult.text && (
        testResult.text.toLowerCase().includes('api key') ||
        testResult.text.toLowerCase().includes('authentication') ||
        testResult.text.toLowerCase().includes('unauthorized') ||
        testResult.text.toLowerCase().includes('invalid key')
      )) {
        return res.json({
          success: true,
          data: {
            model: model.id,
            status: 'test_failed',
            error: 'API key validation failed. The API key appears to be invalid or expired.',
            message: 'API key validation failed. Please check your API key configuration.',
            testResult: {
              response: testResult.text.substring(0, 100),
              modelUsed: model.id,
              provider: model.provider,
              tokensUsed: testResult.usage?.totalTokens || 0,
              fallbackUsed: false
            }
          }
        });
      }

      // Success - API key is valid and model responded correctly
      res.json({
        success: true,
        data: {
          model: model.id,
          status: 'operational',
          testResult: {
            response: testResult.text.substring(0, 100), // First 100 chars
            modelUsed: testResult.modelUsed,
            provider: testResult.provider,
            tokensUsed: testResult.usage?.totalTokens || 0,
            fallbackUsed: testResult.fallbackUsed || false
          },
          message: `Model test completed successfully. API key is configured${apiKeySource === 'database' ? ' (from database - secure)' : apiKeySource === 'environment' ? ' (from environment variables - consider migrating to database)' : ''}.`
        }
      });
    } catch (testError: any) {
      logger.error(`Model test failed for ${model.id}:`, testError);
      
      // Extract more helpful error message
      let errorMessage = testError.message || 'Unknown error';
      // Don't reformat the error message - keep the original for better debugging
      // The error message should already indicate if it's from database or environment
      if (errorMessage.includes('API error')) {
        // Extract the actual error from "API error: ..."
        const match = errorMessage.match(/API error:\s*(.+)/i);
        if (match) {
          errorMessage = match[1];
        }
      }
      
      // Return success: true but with test_failed status so frontend can handle it gracefully
      res.json({
        success: true,
        data: {
          model: model.id,
          status: 'test_failed',
          error: errorMessage,
          message: errorMessage,
          testResult: {
            response: undefined,
            modelUsed: model.id,
            provider: model.provider,
            tokensUsed: 0,
            fallbackUsed: false
          }
        }
      });
    }
  } catch (error: any) {
    next(error);
  }
});

export default router;

