/**
 * Admin LLM Router Settings Routes
 * API endpoints for managing LLM router configuration
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { llmRouterSettingsService } from '../services/llmRouterSettings.service.js';
import { RoutingRule } from '../models/RoutingRule.model.js';
import { LLMRouterSettings } from '../models/LLMRouterSettings.model.js';
import { routingEngine } from '../services/llm/RoutingEngine.js';
import { routerMetricsService } from '../services/routerMetrics.service.js';
import { costForecastingService } from '../services/costForecasting.service.js';
import { RoutingDecisionLog } from '../models/RoutingDecisionLog.model.js';
import { UsageQuota } from '../models/UsageQuota.model.js';
import { logger } from '../utils/logger.js';
import { toApiError } from '../errors/ApiError.js';
import { z } from 'zod';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/llm-router/settings
 * Get all router settings (global + all user overrides)
 */
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const globalSettings = await llmRouterSettingsService.getGlobalSettings();
    const userSettings = await LLMRouterSettings.find({ scope: 'user' })
      .populate('routingRules')
      .populate('userId', 'name email')
      .lean();

    res.json({
      success: true,
      data: {
        global: globalSettings,
        users: userSettings
      }
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get router settings:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve router settings',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/settings/global
 * Get global router settings
 */
router.get('/settings/global', async (_req: Request, res: Response) => {
  try {
    const settings = await llmRouterSettingsService.getGlobalSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get global router settings:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve global router settings',
      error: apiError.message
    });
  }
});

/**
 * PUT /api/admin/llm-router/settings/global
 * Update global router settings
 */
router.put('/settings/global', async (req: Request, res: Response) => {
  try {
    const settings = req.body;

    // Validate settings
    const validation = llmRouterSettingsService.validateSettings(settings);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings',
        errors: validation.errors
      });
    }

    const updated = await llmRouterSettingsService.updateGlobalSettings(settings);

    // Clear the routing engine cache so changes take effect immediately
    routingEngine.clearCache();

    res.json({
      success: true,
      data: updated,
      message: 'Global router settings updated successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to update global router settings:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to update global router settings',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/settings/user/:userId
 * Get user-specific router settings
 */
router.get('/settings/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const settings = await llmRouterSettingsService.getUserSettings(userId);
    res.json({
      success: true,
      data: settings
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to get user router settings for ${req.params.userId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user router settings',
      error: apiError.message
    });
  }
});

/**
 * PUT /api/admin/llm-router/settings/user/:userId
 * Update user-specific router settings
 */
router.put('/settings/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const settings = req.body;

    // Validate settings
    const validation = llmRouterSettingsService.validateSettings(settings);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings',
        errors: validation.errors
      });
    }

    const updated = await llmRouterSettingsService.updateUserSettings(userId, settings);

    // Clear the routing engine cache for this user so changes take effect immediately
    routingEngine.clearCache(userId);

    res.json({
      success: true,
      data: updated,
      message: 'User router settings updated successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to update user router settings for ${req.params.userId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to update user router settings',
      error: apiError.message
    });
  }
});

/**
 * POST /api/admin/llm-router/settings/user/:userId/reset
 * Reset user settings to global defaults
 */
router.post('/settings/user/:userId/reset', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await llmRouterSettingsService.resetUserSettings(userId);

    // Clear the routing engine cache for this user so changes take effect immediately
    routingEngine.clearCache(userId);

    res.json({
      success: true,
      message: 'User router settings reset to global defaults'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to reset user router settings for ${req.params.userId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to reset user router settings',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/rules
 * Get routing rules, optionally filtered by routerType
 * 
 * IMPORTANT: This endpoint is for END USER ROUTER rules only.
 * - Defaults to routerType='end-user' if not specified
 * - Internal Router uses /api/admin/internal-router/config (different endpoint)
 * - These routers are completely independent
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const RulesQuerySchema = z.object({
      routerType: z.enum(['end-user', 'internal']).optional()
    });

    const { routerType } = RulesQuerySchema.parse(req.query);
    const query: any = {};

    // Filter by routerType if provided
    if (routerType) {
      query.routerType = routerType;
    }

    const rules = await RoutingRule.find(query)
      .sort({ priority: -1 })
      .lean();
    res.json({
      success: true,
      data: rules
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get routing rules:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve routing rules',
      error: apiError.message
    });
  }
});

/**
 * POST /api/admin/llm-router/rules
 * Create a new routing rule
 * 
 * IMPORTANT: This endpoint is for END USER ROUTER rules only.
 * - Defaults to routerType='end-user' if not specified
 * - Internal Router uses /api/admin/internal-router/config (different endpoint)
 * - These routers are completely independent
 */
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const ruleData = req.body;

    // Ensure routerType is set (default to 'end-user' for backward compatibility)
    if (!ruleData.routerType) {
      ruleData.routerType = 'end-user';
    }

    // Validate routerType
    if (ruleData.routerType !== 'end-user' && ruleData.routerType !== 'internal') {
      return res.status(400).json({
        success: false,
        message: 'Invalid routerType. Must be "end-user" or "internal"'
      });
    }

    const rule = await RoutingRule.create(ruleData);

    // Clear the routing engine cache so the new rule takes effect immediately
    routingEngine.clearCache();

    res.status(201).json({
      success: true,
      data: rule,
      message: 'Routing rule created successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to create routing rule:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to create routing rule',
      error: apiError.message
    });
  }
});

/**
 * PUT /api/admin/llm-router/rules/:ruleId
 * Update a routing rule
 */
router.put('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const ruleData = req.body;

    const rule = await RoutingRule.findByIdAndUpdate(
      ruleId,
      ruleData,
      { new: true, runValidators: true }
    );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Routing rule not found'
      });
    }

    // Clear the routing engine cache so the updated rule takes effect immediately
    routingEngine.clearCache();

    res.json({
      success: true,
      data: rule,
      message: 'Routing rule updated successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to update routing rule ${req.params.ruleId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to update routing rule',
      error: apiError.message
    });
  }
});

/**
 * DELETE /api/admin/llm-router/rules/:ruleId
 * Delete a routing rule
 */
router.delete('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    const rule = await RoutingRule.findByIdAndDelete(ruleId);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Routing rule not found'
      });
    }

    // Remove rule from all settings that reference it
    await LLMRouterSettings.updateMany(
      { routingRules: ruleId },
      { $pull: { routingRules: ruleId } }
    );

    // Clear the routing engine cache so the deletion takes effect immediately
    routingEngine.clearCache();

    res.json({
      success: true,
      message: 'Routing rule deleted successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to delete routing rule ${req.params.ruleId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to delete routing rule',
      error: apiError.message
    });
  }
});

/**
 * POST /api/admin/llm-router/rules/test
 * Test a routing rule against a sample task
 */
router.post('/rules/test', async (req: Request, res: Response) => {
  try {
    const { rule, sampleTask } = req.body;

    if (!rule || !sampleTask) {
      return res.status(400).json({
        success: false,
        message: 'Rule and sampleTask are required'
      });
    }

    const result = await llmRouterSettingsService.testRoutingRule(rule, sampleTask);
    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to test routing rule:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to test routing rule',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/analytics
 * Get routing analytics
 */
router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    // TODO: Implement analytics collection
    // For now, return basic stats
    const totalRules = await RoutingRule.countDocuments();
    const enabledRules = await RoutingRule.countDocuments({ enabled: true });
    const globalSettings = await llmRouterSettingsService.getGlobalSettings();
    const userOverrides = await LLMRouterSettings.countDocuments({ scope: 'user' });

    res.json({
      success: true,
      data: {
        totalRules,
        enabledRules,
        globalSettingsEnabled: globalSettings?.enabled || false,
        userOverrides,
        intelligentRoutingEnabled: globalSettings?.enableIntelligentRouting || false,
        costOptimizationEnabled: globalSettings?.enableCostOptimization || false,
        performanceOptimizationEnabled: globalSettings?.enablePerformanceOptimization || false
      }
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get routing analytics:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve routing analytics',
      error: apiError.message
    });
  }
});

// ============ REAL-TIME METRICS ENDPOINTS ============

/**
 * GET /api/admin/llm-router/metrics/realtime
 * Get real-time metrics for dashboard
 */
router.get('/metrics/realtime', async (req: Request, res: Response) => {
  try {
    const RealtimeMetricsSchema = z.object({
      period: z.enum(['5min', '1hour', '24hours']).default('1hour'),
      routerType: z.enum(['end-user', 'internal']).optional()
    });

    const { period, routerType } = RealtimeMetricsSchema.parse(req.query);
    const metrics = await routerMetricsService.getRealTimeMetrics(period, routerType);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get real-time metrics:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve real-time metrics',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/metrics/health
 * Get model health status
 */
router.get('/metrics/health', async (_req: Request, res: Response) => {
  try {
    const health = routerMetricsService.getModelHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get model health:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve model health',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/metrics/model/:modelId
 * Get metrics for a specific model
 */
router.get('/metrics/model/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const MetricsQuerySchema = z.object({
      hours: z.coerce.number().int().positive().default(24)
    });

    const { hours } = MetricsQuerySchema.parse(req.query);

    const metrics = await routerMetricsService.getModelSpecificMetrics(modelId, hours);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to get metrics for model ${req.params.modelId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve model metrics',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/metrics/sparkline/:modelId
 * Get error sparkline data for a model
 */
router.get('/metrics/sparkline/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const SparklineQuerySchema = z.object({
      points: z.coerce.number().int().positive().default(12)
    });

    const { points } = SparklineQuerySchema.parse(req.query);

    const sparkline = await routerMetricsService.getErrorSparkline(modelId, points);

    res.json({
      success: true,
      data: sparkline
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to get sparkline for model ${req.params.modelId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sparkline data',
      error: apiError.message
    });
  }
});

/**
 * POST /api/admin/llm-router/metrics/cache/clear
 * Clear metrics cache
 */
router.post('/metrics/cache/clear', async (_req: Request, res: Response) => {
  try {
    routerMetricsService.clearCache();

    res.json({
      success: true,
      message: 'Metrics cache cleared successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to clear metrics cache:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to clear metrics cache',
      error: apiError.message
    });
  }
});

// ============ COST FORECASTING ENDPOINTS ============

/**
 * GET /api/admin/llm-router/forecast
 * Get cost forecast
 */
router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const ForecastQuerySchema = z.object({
      days: z.coerce.number().int().positive().default(30)
    });

    const { days } = ForecastQuerySchema.parse(req.query);
    const forecast = await costForecastingService.getCostForecast(days);

    res.json({
      success: true,
      data: forecast
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get cost forecast:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cost forecast',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/forecast/anomalies
 * Get cost anomalies
 */
router.get('/forecast/anomalies', async (req: Request, res: Response) => {
  try {
    const AnomaliesQuerySchema = z.object({
      days: z.coerce.number().int().positive().default(30),
      threshold: z.coerce.number().positive().default(2)
    });

    const { days, threshold } = AnomaliesQuerySchema.parse(req.query);

    const anomalies = await costForecastingService.detectAnomalies(days, threshold);

    res.json({
      success: true,
      data: anomalies
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to detect anomalies:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to detect cost anomalies',
      error: apiError.message
    });
  }
});

/**
 * POST /api/admin/llm-router/forecast/what-if
 * Run a what-if scenario
 */
router.post('/forecast/what-if', async (req: Request, res: Response) => {
  try {
    const scenario = req.body;
    const result = await costForecastingService.runWhatIfScenario(scenario);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to run what-if scenario:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to run what-if scenario',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/forecast/breakdown
 * Get cost breakdown by model/provider/task
 */
router.get('/forecast/breakdown', async (req: Request, res: Response) => {
  try {
    const BreakdownQuerySchema = z.object({
      days: z.coerce.number().int().positive().default(7)
    });

    const { days } = BreakdownQuerySchema.parse(req.query);
    const breakdown = await costForecastingService.getCostBreakdown(days);

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get cost breakdown:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cost breakdown',
      error: apiError.message
    });
  }
});

// ============ ROUTING DECISION LOGS ============

/**
 * GET /api/admin/llm-router/decisions
 * Get routing decision logs
 */
router.get('/decisions', async (req: Request, res: Response) => {
  try {
    const DecisionsQuerySchema = z.object({
      limit: z.coerce.number().int().positive().default(50),
      modelId: z.string().optional(),
      userId: z.string().optional(),
      taskType: z.string().optional()
    });

    const { limit, modelId, userId, taskType } = DecisionsQuerySchema.parse(req.query);

    const query: any = {};
    if (modelId) query.selectedModel = modelId;
    if (userId) query.userId = userId;
    if (taskType) query['task.type'] = taskType;

    const decisions = await RoutingDecisionLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: decisions
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get routing decisions:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve routing decisions',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/decisions/:decisionId
 * Get a specific routing decision
 */
router.get('/decisions/:decisionId', async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;

    const decision = await RoutingDecisionLog.findById(decisionId).lean();

    if (!decision) {
      return res.status(404).json({
        success: false,
        message: 'Routing decision not found'
      });
    }

    res.json({
      success: true,
      data: decision
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to get routing decision ${req.params.decisionId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve routing decision',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/decisions/export
 * Export routing decisions as CSV or JSON
 */
router.get('/decisions/export', async (req: Request, res: Response) => {
  try {
    const ExportQuerySchema = z.object({
      format: z.string().default('json'),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    });

    const { format, startDate, endDate } = ExportQuerySchema.parse(req.query);
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const decisions = await RoutingDecisionLog.find({
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: -1 }).lean();

    if (format === 'csv') {
      // Generate CSV
      const headers = ['timestamp', 'requestId', 'userId', 'taskType', 'complexity', 'selectedModel', 'selectedProvider', 'confidence', 'decisionTimeMs', 'estimatedCost', 'actualCost', 'success'];
      const rows = decisions.map(d => [
        d.timestamp,
        d.requestId,
        d.userId || '',
        d.task.type,
        d.task.complexity,
        d.selectedModel,
        d.selectedProvider,
        d.confidence,
        d.decisionTimeMs,
        d.estimatedCost,
        d.actualCost || '',
        d.success !== undefined ? d.success : ''
      ].join(','));

      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=routing-decisions.csv');
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: decisions
      });
    }
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to export routing decisions:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to export routing decisions',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/decisions/stats
 * Get decision statistics
 */
router.get('/decisions/stats', async (req: Request, res: Response) => {
  try {
    const StatsQuerySchema = z.object({
      days: z.coerce.number().int().positive().default(7)
    });

    const { days } = StatsQuerySchema.parse(req.query);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalStats, modelStats, taskStats] = await Promise.all([
      RoutingDecisionLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalDecisions: { $sum: 1 },
            avgDecisionTime: { $avg: '$decisionTimeMs' },
            avgConfidence: { $avg: '$confidence' },
            successCount: {
              $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] }
            }
          }
        }
      ]),
      RoutingDecisionLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: '$selectedModel',
            count: { $sum: 1 },
            avgConfidence: { $avg: '$confidence' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      RoutingDecisionLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: '$task.type',
            count: { $sum: 1 },
            avgDecisionTime: { $avg: '$decisionTimeMs' }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total: totalStats[0] || { totalDecisions: 0, avgDecisionTime: 0, avgConfidence: 0, successCount: 0 },
        byModel: modelStats,
        byTaskType: taskStats
      }
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get decision stats:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve decision statistics',
      error: apiError.message
    });
  }
});

// ============ QUOTA MANAGEMENT ENDPOINTS ============

/**
 * GET /api/admin/llm-router/quotas
 * Get all quotas
 */
router.get('/quotas', async (req: Request, res: Response) => {
  try {
    const QuotaQuerySchema = z.object({
      targetType: z.enum(['user', 'project', 'global']).optional(),
      targetId: z.string().optional()
    });

    const { targetType, targetId } = QuotaQuerySchema.parse(req.query);

    const query: any = {};
    if (targetType) query.targetType = targetType;
    if (targetId) query.targetId = targetId;

    const quotas = await UsageQuota.find(query)
      .sort({ targetType: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: quotas
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to get quotas:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quotas',
      error: apiError.message
    });
  }
});

/**
 * POST /api/admin/llm-router/quotas
 * Create a new quota
 */
router.post('/quotas', async (req: Request, res: Response) => {
  try {
    const quotaData = req.body;

    // Validate required fields
    if (!quotaData.targetType) {
      return res.status(400).json({
        success: false,
        message: 'targetType is required'
      });
    }

    // Initialize currentUsage if not provided
    if (!quotaData.currentUsage) {
      quotaData.currentUsage = {
        daily: { cost: 0, tokens: 0, requests: 0, lastReset: new Date() },
        weekly: { cost: 0, tokens: 0, requests: 0, lastReset: new Date() },
        monthly: { cost: 0, tokens: 0, requests: 0, lastReset: new Date() }
      };
    }

    const quota = await UsageQuota.create(quotaData);

    res.status(201).json({
      success: true,
      data: quota,
      message: 'Quota created successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error('Failed to create quota:', apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to create quota',
      error: apiError.message
    });
  }
});

/**
 * PUT /api/admin/llm-router/quotas/:quotaId
 * Update a quota
 */
router.put('/quotas/:quotaId', async (req: Request, res: Response) => {
  try {
    const { quotaId } = req.params;
    const quotaData = req.body;

    const quota = await UsageQuota.findByIdAndUpdate(
      quotaId,
      quotaData,
      { new: true, runValidators: true }
    );

    if (!quota) {
      return res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
    }

    res.json({
      success: true,
      data: quota,
      message: 'Quota updated successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to update quota ${req.params.quotaId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to update quota',
      error: apiError.message
    });
  }
});

/**
 * DELETE /api/admin/llm-router/quotas/:quotaId
 * Delete a quota
 */
router.delete('/quotas/:quotaId', async (req: Request, res: Response) => {
  try {
    const { quotaId } = req.params;

    const quota = await UsageQuota.findByIdAndDelete(quotaId);

    if (!quota) {
      return res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
    }

    res.json({
      success: true,
      message: 'Quota deleted successfully'
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to delete quota ${req.params.quotaId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quota',
      error: apiError.message
    });
  }
});

/**
 * GET /api/admin/llm-router/quotas/:quotaId
 * Get a specific quota
 */
router.get('/quotas/:quotaId', async (req: Request, res: Response) => {
  try {
    const { quotaId } = req.params;

    const quota = await UsageQuota.findById(quotaId).lean();

    if (!quota) {
      return res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
    }

    res.json({
      success: true,
      data: quota
    });
  } catch (error: unknown) {
    const apiError = toApiError(error);
    logger.error(`Failed to get quota ${req.params.quotaId}:`, apiError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quota',
      error: apiError.message
    });
  }
});

export default router;


