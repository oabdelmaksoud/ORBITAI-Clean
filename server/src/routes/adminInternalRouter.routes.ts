/**
 * Admin Internal Router Routes
 * API endpoints for managing internal/system task routing configuration
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { internalTaskRouter } from '../services/internalTaskRouter.service.js';
import { InternalRoutingConfig} from '../models/InternalRoutingConfig.model.js';
import { InternalRoutingHistory } from '../models/InternalRoutingHistory.model.js';
import { modelRegistry } from '../services/llm/models/ModelRegistry.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/internal-router/config
 * Get current internal router configuration
 */
router.get('/config', async (_req, res) => {
  try {
    const config = await internalTaskRouter.getConfig();
    
    res.json({
      success: true,
      data: {
        config,
        availableModels: modelRegistry.getActiveModels().map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          capabilities: m.capabilities,
          pricing: m.pricing
        }))
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get internal router config:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to get configuration' }
    });
  }
});

/**
 * PUT /api/admin/internal-router/config
 * Update internal router configuration
 */
router.put('/config', async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate updates
    if (updates.minConfidenceThreshold !== undefined) {
      if (updates.minConfidenceThreshold < 0 || updates.minConfidenceThreshold > 1) {
        res.status(400).json({
          success: false,
          error: { message: 'minConfidenceThreshold must be between 0 and 1' }
        });
        return;
      }
    }
    
    if (updates.budgetLimits) {
      if (updates.budgetLimits.dailyLimit < 0 || 
          updates.budgetLimits.monthlyLimit < 0 || 
          updates.budgetLimits.perTaskLimit < 0) {
        res.status(400).json({
          success: false,
          error: { message: 'Budget limits cannot be negative' }
        });
        return;
      }
    }
    
    const config = await internalTaskRouter.updateConfig(updates);
    
    logger.info(`Internal router config updated by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      data: { config }
    });
  } catch (error: unknown) {
    logger.error('Failed to update internal router config:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to update configuration' }
    });
  }
});

/**
 * GET /api/admin/internal-router/statistics
 * Get routing statistics for a time range
 */
router.get('/statistics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const statistics = await internalTaskRouter.getStatistics({ start, end });
    
    res.json({
      success: true,
      data: {
        statistics,
        timeRange: { start, end }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get internal router statistics:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to get statistics' }
    });
  }
});

/**
 * GET /api/admin/internal-router/history
 * Get routing decision history
 */
router.get('/history', async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '50',
      tier,
      taskType,
      startDate,
      endDate 
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;
    
    const query: any = {};
    
    if (tier) query.selectedTier = tier;
    if (taskType) query.taskType = taskType;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }
    
    const [history, total] = await Promise.all([
      InternalRoutingHistory.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      InternalRoutingHistory.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get internal router history:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to get history' }
    });
  }
});

/**
 * POST /api/admin/internal-router/test
 * Test routing for a sample task
 */
router.post('/test', async (req, res) => {
  try {
    const { prompt, taskType, agentRole, requiredCapabilities, context } = req.body;
    
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: { message: 'prompt is required' }
      });
      return;
    }
    
    const decision = await internalTaskRouter.routeTask({
      prompt,
      taskType,
      agentRole,
      requiredCapabilities,
      context
    });
    
    res.json({
      success: true,
      data: { decision }
    });
  } catch (error: unknown) {
    logger.error('Failed to test internal routing:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to test routing' }
    });
  }
});

/**
 * POST /api/admin/internal-router/tiers
 * Add or update a tier configuration
 */
router.post('/tiers', async (req, res) => {
  try {
    const tierConfig = req.body;
    
    // Validate tier config
    if (!tierConfig.name || !['economy', 'standard', 'premium'].includes(tierConfig.name)) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid tier name. Must be economy, standard, or premium' }
      });
      return;
    }
    
    if (!tierConfig.models || !Array.isArray(tierConfig.models) || tierConfig.models.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Tier must have at least one model' }
      });
      return;
    }
    
    const config = await internalTaskRouter.getConfig();
    const existingTiers = config.tiers || [];
    
    // Update or add tier
    const tierIndex = existingTiers.findIndex(t => t.name === tierConfig.name);
    if (tierIndex >= 0) {
      existingTiers[tierIndex] = tierConfig;
    } else {
      existingTiers.push(tierConfig);
    }
    
    const updatedConfig = await internalTaskRouter.updateConfig({ tiers: existingTiers });
    
    logger.info(`Tier ${tierConfig.name} updated by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      data: { config: updatedConfig }
    });
  } catch (error: unknown) {
    logger.error('Failed to update tier:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to update tier' }
    });
  }
});

/**
 * POST /api/admin/internal-router/task-overrides
 * Add or update a task type override
 */
router.post('/task-overrides', async (req, res) => {
  try {
    const override = req.body;
    
    if (!override.taskType) {
      res.status(400).json({
        success: false,
        error: { message: 'taskType is required' }
      });
      return;
    }
    
    if (!override.preferredTier || !['economy', 'standard', 'premium'].includes(override.preferredTier)) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid preferredTier. Must be economy, standard, or premium' }
      });
      return;
    }
    
    const config = await internalTaskRouter.getConfig();
    const existingOverrides = config.taskTypeOverrides || [];
    
    // Update or add override
    const overrideIndex = existingOverrides.findIndex(o => o.taskType === override.taskType);
    if (overrideIndex >= 0) {
      existingOverrides[overrideIndex] = override;
    } else {
      existingOverrides.push(override);
    }
    
    const updatedConfig = await internalTaskRouter.updateConfig({ taskTypeOverrides: existingOverrides });
    
    logger.info(`Task type override for ${override.taskType} updated by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      data: { config: updatedConfig }
    });
  } catch (error: unknown) {
    logger.error('Failed to update task override:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to update task override' }
    });
  }
});

/**
 * DELETE /api/admin/internal-router/task-overrides/:taskType
 * Delete a task type override
 */
router.delete('/task-overrides/:taskType', async (req, res) => {
  try {
    const { taskType } = req.params;
    
    const config = await internalTaskRouter.getConfig();
    const existingOverrides = config.taskTypeOverrides || [];
    
    const filteredOverrides = existingOverrides.filter(o => o.taskType !== taskType);
    
    if (filteredOverrides.length === existingOverrides.length) {
      res.status(404).json({
        success: false,
        error: { message: 'Task type override not found' }
      });
      return;
    }
    
    const updatedConfig = await internalTaskRouter.updateConfig({ taskTypeOverrides: filteredOverrides });
    
    logger.info(`Task type override for ${taskType} deleted by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      data: { config: updatedConfig }
    });
  } catch (error: unknown) {
    logger.error('Failed to delete task override:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to delete task override' }
    });
  }
});

/**
 * POST /api/admin/internal-router/context-overrides
 * Add or update a context override
 */
router.post('/context-overrides', async (req, res) => {
  try {
    const override = req.body;
    
    if (!override.context) {
      res.status(400).json({
        success: false,
        error: { message: 'context is required' }
      });
      return;
    }
    
    if (!override.preferredTier || !['economy', 'standard', 'premium'].includes(override.preferredTier)) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid preferredTier. Must be economy, standard, or premium' }
      });
      return;
    }
    
    const config = await internalTaskRouter.getConfig();
    const existingOverrides = config.contextOverrides || [];
    
    // Update or add override
    const overrideIndex = existingOverrides.findIndex(o => o.context === override.context);
    if (overrideIndex >= 0) {
      existingOverrides[overrideIndex] = override;
    } else {
      existingOverrides.push(override);
    }
    
    const updatedConfig = await internalTaskRouter.updateConfig({ contextOverrides: existingOverrides });
    
    logger.info(`Context override for ${override.context} updated by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      data: { config: updatedConfig }
    });
  } catch (error: unknown) {
    logger.error('Failed to update context override:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to update context override' }
    });
  }
});

/**
 * DELETE /api/admin/internal-router/context-overrides/:context
 * Delete a context override
 */
router.delete('/context-overrides/:context', async (req, res) => {
  try {
    const { context } = req.params;
    
    const config = await internalTaskRouter.getConfig();
    const existingOverrides = config.contextOverrides || [];
    
    const filteredOverrides = existingOverrides.filter(o => o.context !== context);
    
    if (filteredOverrides.length === existingOverrides.length) {
      res.status(404).json({
        success: false,
        error: { message: 'Context override not found' }
      });
      return;
    }
    
    const updatedConfig = await internalTaskRouter.updateConfig({ contextOverrides: filteredOverrides });
    
    logger.info(`Context override for ${context} deleted by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      data: { config: updatedConfig }
    });
  } catch (error: unknown) {
    logger.error('Failed to delete context override:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to delete context override' }
    });
  }
});

/**
 * POST /api/admin/internal-router/clear-cache
 * Clear the configuration cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    internalTaskRouter.clearCache();
    
    logger.info(`Internal router cache cleared by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to clear cache' }
    });
  }
});

/**
 * POST /api/admin/internal-router/reset
 * Reset configuration to defaults
 */
router.post('/reset', async (req, res) => {
  try {
    // Delete existing config
    await InternalRoutingConfig.deleteMany({});
    
    // Clear cache to force reload of defaults
    internalTaskRouter.clearCache();
    
    // Get fresh config (will create defaults)
    const config = await internalTaskRouter.getConfig();
    
    logger.info(`Internal router config reset by admin ${(req as any).user?.email}`);
    
    res.json({
      success: true,
      data: { config }
    });
  } catch (error: unknown) {
    logger.error('Failed to reset config:', error);
    res.status(500).json({
      success: false,
      error: { message: (error instanceof Error ? error.message : String(error)) || 'Failed to reset configuration' }
    });
  }
});

export default router;

