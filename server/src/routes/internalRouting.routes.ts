/**
 * Internal Routing Admin API Routes
 * Manage AI-powered internal task routing configuration
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { internalTaskRouter } from '../services/internalTaskRouter.service.js';
import { InternalRoutingConfig } from '../models/InternalRoutingConfig.model.js';
import { InternalRoutingHistory } from '../models/InternalRoutingHistory.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/internal-routing/config
 * Get current internal routing configuration
 */
router.get('/config', async (req: AdminRequest, res) => {
  try {
    const config = await internalTaskRouter.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error: unknown) {
    logger.error('Failed to get internal routing config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get configuration'
    });
  }
});

/**
 * PUT /api/admin/internal-routing/config
 * Update internal routing configuration
 */
router.put('/config', async (req: AdminRequest, res) => {
  try {
    const updates = req.body;
    
    // Validate tier configurations if provided
    if (updates.tiers) {
      for (const tier of updates.tiers) {
        if (!['economy', 'standard', 'premium'].includes(tier.name)) {
          return res.status(400).json({
            success: false,
            error: `Invalid tier name: ${tier.name}`
          });
        }
        if (!tier.models || tier.models.length === 0) {
          return res.status(400).json({
            success: false,
            error: `Tier ${tier.name} must have at least one model`
          });
        }
      }
    }
    
    const config = await internalTaskRouter.updateConfig(updates);
    
    logger.info(`[InternalRouting] Config updated by admin ${req.admin?.email}`);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: unknown) {
    logger.error('Failed to update internal routing config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update configuration'
    });
  }
});

/**
 * POST /api/admin/internal-routing/test
 * Test routing decision for a sample task
 */
router.post('/test', async (req: AdminRequest, res) => {
  try {
    const { prompt, taskType, agentRole, requiredCapabilities, isUserFacing, isCritical, context } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required for testing'
      });
    }
    
    const decision = await internalTaskRouter.routeTask({
      prompt,
      taskType,
      agentRole,
      requiredCapabilities,
      isUserFacing,
      isCritical,
      context
    });
    
    res.json({
      success: true,
      data: {
        selectedModel: {
          id: decision.selectedModel.id,
          name: decision.selectedModel.name,
          provider: decision.selectedModel.provider,
          pricing: decision.selectedModel.pricing
        },
        tier: decision.tier,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        estimatedCost: decision.estimatedCost,
        factors: decision.factors,
        alternativeModels: decision.alternativeModels.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider
        }))
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to test routing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test routing'
    });
  }
});

/**
 * GET /api/admin/internal-routing/statistics
 * Get routing statistics for a time range
 */
router.get('/statistics', async (req: AdminRequest, res) => {
  try {
    const { startDate, endDate, days } = req.query;
    
    let start: Date;
    let end: Date = new Date();
    
    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const daysNum = parseInt(days as string) || 7;
      start = new Date();
      start.setDate(start.getDate() - daysNum);
    }
    
    const statistics = await internalTaskRouter.getStatistics({ start, end });
    
    res.json({
      success: true,
      data: {
        timeRange: { start, end },
        ...statistics
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get routing statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
    });
  }
});

/**
 * GET /api/admin/internal-routing/history
 * Get routing decision history
 */
router.get('/history', async (req: AdminRequest, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      tier, 
      taskType, 
      context,
      modelId,
      limit = '100',
      offset = '0'
    } = req.query;
    
    const query: any = {};
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }
    
    if (tier) query.selectedTier = tier;
    if (taskType) query.taskType = taskType;
    if (context) query.context = context;
    if (modelId) query.selectedModelId = modelId;
    
    const [history, total] = await Promise.all([
      InternalRoutingHistory.find(query)
        .sort({ timestamp: -1 })
        .skip(parseInt(offset as string))
        .limit(parseInt(limit as string))
        .lean(),
      InternalRoutingHistory.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        history,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + parseInt(limit as string)
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get routing history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get history'
    });
  }
});

/**
 * GET /api/admin/internal-routing/analytics
 * Get detailed analytics for routing decisions
 */
router.get('/analytics', async (req: AdminRequest, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    const endDate = new Date();
    
    // Get tier success rates
    const tierStats = await InternalRoutingHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$selectedTier',
          totalDecisions: { $sum: 1 },
          successfulDecisions: {
            $sum: { $cond: [{ $eq: ['$outcome.success', true] }, 1, 0] }
          },
          avgConfidence: { $avg: '$confidence' },
          avgEstimatedCost: { $avg: '$estimatedCost' },
          avgActualCost: { $avg: '$outcome.actualCost' },
          avgLatency: { $avg: '$outcome.actualLatencyMs' }
        }
      },
      {
        $project: {
          tier: '$_id',
          totalDecisions: 1,
          successfulDecisions: 1,
          successRate: {
            $cond: [
              { $eq: ['$totalDecisions', 0] },
              0,
              { $divide: ['$successfulDecisions', '$totalDecisions'] }
            ]
          },
          avgConfidence: 1,
          avgEstimatedCost: 1,
          avgActualCost: 1,
          avgLatency: 1
        }
      }
    ]);
    
    // Get complexity distribution
    const complexityStats = await InternalRoutingHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$complexity',
          count: { $sum: 1 },
          avgCost: { $avg: { $ifNull: ['$outcome.actualCost', '$estimatedCost'] } }
        }
      }
    ]);
    
    // Get daily trends
    const dailyTrends = await InternalRoutingHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          decisions: { $sum: 1 },
          totalCost: { $sum: { $ifNull: ['$outcome.actualCost', '$estimatedCost'] } },
          avgConfidence: { $avg: '$confidence' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Get top models
    const topModels = await InternalRoutingHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$selectedModelId',
          count: { $sum: 1 },
          totalCost: { $sum: { $ifNull: ['$outcome.actualCost', '$estimatedCost'] } },
          successRate: {
            $avg: { $cond: [{ $eq: ['$outcome.success', true] }, 1, 0] }
          }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Calculate cost savings
    const costData = await InternalRoutingHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$tokenEstimate' },
          actualCost: { $sum: { $ifNull: ['$outcome.actualCost', '$estimatedCost'] } }
        }
      }
    ]);
    
    // Estimate premium cost (using average premium pricing of $10/1M tokens)
    const premiumCostPer1M = 10;
    const totalTokens = costData.length > 0 ? costData[0].totalTokens : 0;
    const actualCost = costData.length > 0 ? costData[0].actualCost : 0;
    const premiumCost = (totalTokens / 1_000_000) * premiumCostPer1M;
    const costSavings = Math.max(0, premiumCost - actualCost);
    const savingsPercentage = premiumCost > 0 ? (costSavings / premiumCost) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        timeRange: { start: startDate, end: endDate, days: daysNum },
        tierStats,
        complexityStats,
        dailyTrends,
        topModels,
        costAnalysis: {
          totalTokens,
          actualCost,
          premiumCost,
          costSavings,
          savingsPercentage
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get routing analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get analytics'
    });
  }
});

/**
 * POST /api/admin/internal-routing/clear-cache
 * Clear the configuration cache
 */
router.post('/clear-cache', async (req: AdminRequest, res) => {
  try {
    internalTaskRouter.clearCache();
    
    logger.info(`[InternalRouting] Cache cleared by admin ${req.admin?.email}`);
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear cache'
    });
  }
});

/**
 * DELETE /api/admin/internal-routing/history
 * Clear routing history (with optional date range)
 */
router.delete('/history', async (req: AdminRequest, res) => {
  try {
    const { beforeDate } = req.query;
    
    const query: any = {};
    if (beforeDate) {
      query.timestamp = { $lt: new Date(beforeDate as string) };
    }
    
    const result = await InternalRoutingHistory.deleteMany(query);
    
    logger.info(`[InternalRouting] Deleted ${result.deletedCount} history records by admin ${req.admin?.email}`);
    
    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to delete history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete history'
    });
  }
});

export default router;




