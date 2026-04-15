/**
 * Model Sync Routes
 * API endpoints for LLM model management and synchronization
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { modelSyncService, FullSyncResult, SyncResult } from '../services/modelSync.service.js';
import { modelRegistry } from '../services/llm/models/ModelRegistry.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Public routes (no auth required) - for discovering providers and registry data
/**
 * GET /api/admin/models/registry
 * Get public model registry - all known models without needing API keys
 * This is public to allow frontend to show available models before configuration
 */
router.get('/registry', async (req: express.Request, res) => {
  try {
    const registry = modelSyncService.getPublicModelRegistry();
    res.json({
      success: true,
      data: {
        providers: registry.providers.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          website: p.website,
          apiDocsUrl: p.apiDocsUrl,
          modelCount: p.models.length
        })),
        models: registry.models,
        totalProviders: registry.providers.length,
        totalModels: registry.models.length
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get model registry:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/models/discover
 * Discover new providers from public sources (OpenRouter)
 */
router.get('/discover', async (req: express.Request, res) => {
  try {
    const discovery = await modelSyncService.discoverNewProviders();
    res.json({
      success: true,
      data: discovery
    });
  } catch (error: unknown) {
    logger.error('Failed to discover providers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/models/with-fallback/:provider
 * Get models for a provider with fallback to registry if no API key
 */
router.get('/with-fallback/:provider', async (req: express.Request, res) => {
  const { provider } = req.params;
  try {
    const result = await modelSyncService.getModelsWithFallback(provider);
    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error(`Failed to get models with fallback for ${provider}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// All remaining routes require admin authentication
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/models/sync/status
 * Get current sync status
 */
router.get('/sync/status', async (req: AdminRequest, res) => {
  try {
    // Use async version to load from DB if not in memory
    const status = await modelSyncService.getSyncStatusAsync();
    res.json({
      success: true,
      data: status
    });
  } catch (error: unknown) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/models/sync/results
 * Get last sync results from database
 */
router.get('/sync/results', async (req: AdminRequest, res) => {
  try {
    const results = await modelSyncService.getLastSyncResults();
    res.json({
      success: true,
      data: results
    });
  } catch (error: unknown) {
    logger.error('Failed to get sync results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/models/sync
 * Trigger a full sync from all providers
 */
router.post('/sync', async (req: AdminRequest, res) => {
  try {
    logger.info(`Model sync triggered by admin: ${req.admin?.email}`);

    const result = await modelSyncService.syncAllProviders();

    // Update the model registry with new models
    await updateModelRegistry(result);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error('Model sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/models/sync/:provider
 * Sync models from a specific provider
 */
router.post('/sync/:provider', async (req: AdminRequest, res) => {
  const { provider } = req.params;

  try {
    logger.info(`Model sync for ${provider} triggered by admin: ${req.admin?.email}`);

    let result: SyncResult;

    switch (provider.toLowerCase()) {
      case 'openai':
        result = await modelSyncService.fetchOpenAIModels();
        break;
      case 'anthropic':
        result = await modelSyncService.fetchAnthropicModels();
        break;
      case 'gemini':
      case 'google':
        result = await modelSyncService.fetchGeminiModels();
        break;
      case 'groq':
        result = await modelSyncService.fetchGroqModels();
        break;
      case 'mistral':
        result = await modelSyncService.fetchMistralModels();
        break;
      case 'openrouter':
        result = await modelSyncService.fetchOpenRouterModels();
        break;
      case 'deepseek':
        result = await modelSyncService.fetchDeepSeekModels();
        break;
      case 'cohere':
        result = await modelSyncService.fetchCohereModels();
        break;
      case 'together':
        result = await modelSyncService.fetchTogetherModels();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown provider: ${provider}. Supported providers: openai, anthropic, gemini, groq, mistral, openrouter, deepseek, cohere, together`
        });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error(`Model sync for ${provider} failed:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/models
 * Get all models from the registry
 */
router.get('/', async (req: AdminRequest, res) => {
  try {
    const models = modelRegistry.getAllModels();
    const providers = modelRegistry.getProviders();

    res.json({
      success: true,
      data: {
        totalModels: models.length,
        providers: providers,
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          modelIdentifier: m.modelIdentifier,
          status: m.status,
          isEnabled: m.isEnabled,
          pricing: m.pricing,
          limits: m.limits,
          capabilities: m.capabilities,
          performance: m.performance
        }))
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get models:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/models/:id
 * Get a specific model by ID
 */
router.get('/:id', async (req: AdminRequest, res) => {
  const { id } = req.params;

  try {
    const model = modelRegistry.getModel(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: `Model not found: ${id}`
      });
    }

    res.json({
      success: true,
      data: model
    });
  } catch (error: unknown) {
    logger.error(`Failed to get model ${id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/models/:id/enable
 * Enable a model
 */
router.put('/:id/enable', async (req: AdminRequest, res) => {
  const { id } = req.params;

  try {
    const model = modelRegistry.getModel(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: `Model not found: ${id}`
      });
    }

    modelRegistry.updateModel(id, { isEnabled: true, status: 'active' });

    logger.info(`Model ${id} enabled by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: `Model ${id} enabled`
    });
  } catch (error: unknown) {
    logger.error(`Failed to enable model ${id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/models/:id/disable
 * Disable a model
 */
router.put('/:id/disable', async (req: AdminRequest, res) => {
  const { id } = req.params;

  try {
    const model = modelRegistry.getModel(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: `Model not found: ${id}`
      });
    }

    modelRegistry.updateModel(id, { isEnabled: false });

    logger.info(`Model ${id} disabled by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: `Model ${id} disabled`
    });
  } catch (error: unknown) {
    logger.error(`Failed to disable model ${id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/models/:id
 * Remove a model from the registry
 */
router.delete('/:id', async (req: AdminRequest, res) => {
  const { id } = req.params;

  try {
    const model = modelRegistry.getModel(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: `Model not found: ${id}`
      });
    }

    modelRegistry.removeModel(id);

    logger.info(`Model ${id} removed by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: `Model ${id} removed`
    });
  } catch (error: unknown) {
    logger.error(`Failed to remove model ${id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/models/scheduler/start
 * Start the monthly sync scheduler
 */
router.post('/scheduler/start', async (req: AdminRequest, res) => {
  try {
    modelSyncService.startMonthlySync();

    logger.info(`Monthly sync scheduler started by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: 'Monthly sync scheduler started'
    });
  } catch (error: unknown) {
    logger.error('Failed to start scheduler:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/models/scheduler/stop
 * Stop the monthly sync scheduler
 */
router.post('/scheduler/stop', async (req: AdminRequest, res) => {
  try {
    modelSyncService.stopMonthlySync();

    logger.info(`Monthly sync scheduler stopped by admin: ${req.admin?.email}`);

    res.json({
      success: true,
      message: 'Monthly sync scheduler stopped'
    });
  } catch (error: unknown) {
    logger.error('Failed to stop scheduler:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to update model registry with sync results
 */
async function updateModelRegistry(syncResult: FullSyncResult): Promise<void> {
  for (const providerResult of syncResult.results) {
    if (!providerResult.success || !providerResult.models) continue;

    const existingModels = modelRegistry.getModelsByProvider(providerResult.provider as any);
    const existingIds = new Set(existingModels.map(m => m.modelIdentifier));
    const newIds = new Set(providerResult.models.map(m => m.modelIdentifier));

    // Add new models (skip deprecated models - they will be removed)
    for (const model of providerResult.models) {
      // Skip deprecated models - don't add them
      if (model.isDeprecated) {
        continue;
      }

      if (!existingIds.has(model.modelIdentifier)) {
        try {
          await modelRegistry.registerModel({
            id: model.id,
            name: model.name,
            provider: model.provider as any,
            modelIdentifier: model.modelIdentifier,
            capabilities: {
              structuredOutput: model.capabilities?.jsonMode || false,
              codeGeneration: true,
              longContext: (model.contextWindow || 0) > 32000,
              fastResponse: model.provider === 'groq',
              streaming: model.capabilities?.streaming || true,
              functionCalling: model.capabilities?.functionCalling || false
            },
            limits: {
              maxTokens: model.contextWindow || 8192,
              maxContextLength: model.contextWindow || 8192
            },
            pricing: {
              inputCostPer1MTokens: model.inputPricePerMillion || 1.00,
              outputCostPer1MTokens: model.outputPricePerMillion || 3.00
            },
            performance: {
              avgLatencyMs: 1000,
              reliability: 0.98
            },
            recommendedFor: {
              agentRoles: [],
              taskTypes: [],
              complexity: ['moderate']
            },
            status: model.isDeprecated ? 'deprecated' : 'active',
            isEnabled: false // New models start disabled
          });
          providerResult.modelsAdded++;
          logger.info(`Added new model: ${model.id}`);
        } catch (error) {
          logger.warn(`Failed to add model ${model.id}:`, error);
        }
      } else {
        // Update existing model pricing/info
        const existingModel = existingModels.find(m => m.modelIdentifier === model.modelIdentifier);
        if (existingModel) {
          modelRegistry.updateModel(existingModel.id, {
            pricing: {
              inputCostPer1MTokens: model.inputPricePerMillion || existingModel.pricing.inputCostPer1MTokens,
              outputCostPer1MTokens: model.outputPricePerMillion || existingModel.pricing.outputCostPer1MTokens
            },
            status: model.isDeprecated ? 'deprecated' : existingModel.status
          });
          providerResult.modelsUpdated++;
        }
      }
    }

    // Mark discontinued models as deprecated
    for (const existingModel of existingModels) {
      if (!newIds.has(existingModel.modelIdentifier) && existingModel.status === 'active') {
        modelRegistry.updateModel(existingModel.id, {
          status: 'deprecated',
          isEnabled: false
        });
        providerResult.modelsDisabled++;
        logger.info(`Disabled discontinued model: ${existingModel.id}`);
      }
    }

    // Remove deprecated models
    // 1. Models marked as deprecated in the sync results
    // 2. Existing deprecated models that are no longer in the provider's model list
    for (const existingModel of existingModels) {
      let shouldRemove = false;

      // Check if this model is marked as deprecated in the new sync results
      const deprecatedInSync = providerResult.models?.some(m =>
        m.modelIdentifier === existingModel.modelIdentifier && m.isDeprecated === true
      );

      // Also remove existing deprecated models that are no longer in the provider's list
      const stillInProviderList = newIds.has(existingModel.modelIdentifier);
      const isCurrentlyDeprecated = existingModel.status === 'deprecated';

      if (deprecatedInSync || (isCurrentlyDeprecated && !stillInProviderList)) {
        shouldRemove = true;
      }

      if (shouldRemove) {
        try {
          // Remove from registry
          modelRegistry.removeModel(existingModel.id);

          // Remove from database
          const { LLMModelConfig } = await import('../../models/LLMModelConfig.model.js');
          await LLMModelConfig.deleteOne({ modelId: existingModel.id });

          providerResult.modelsRemoved = (providerResult.modelsRemoved || 0) + 1;
          logger.info(`Removed deprecated model: ${existingModel.id} (${existingModel.name})`);
        } catch (error) {
          logger.warn(`Failed to remove deprecated model ${existingModel.id}:`, error);
        }
      }
    }
  }
}

export default router;
