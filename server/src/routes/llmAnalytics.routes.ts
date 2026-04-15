import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/llm-analytics/trends
 * Get time-series trends for LLM usage
 */
router.get('/trends', async (req: AdminRequest, res, next) => {
  try {
    const TrendsQuerySchema = z.object({
      period: z.enum(['24h', '7d', '30d', '90d']).default('7d'),
      provider: z.string().optional(),
      modelId: z.string().optional(),
      context: z.string().optional()
    });

    const { period, provider, modelId, context } = TrendsQuerySchema.parse(req.query);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Build query
    const query: any = {
      timestamp: { $gte: startDate, $lte: endDate }
    };
    if (provider) query.provider = provider;
    if (modelId) query.modelId = modelId;
    if (context) query.context = context;

    // Aggregate by time buckets
    const usageData = await LLMUsage.find(query)
      .sort({ timestamp: 1 })
      .lean();

    // Group by hour/day depending on period
    const groupBy = period === '24h' ? 'hour' : 'day';
    const grouped: Record<string, {
      calls: number;
      tokens: number;
      cost: number;
      latency: number[];
      errors: number;
      byProvider: Record<string, any>;
      byModel: Record<string, any>;
      byContext?: Record<string, any>;
    }> = {};

    usageData.forEach(usage => {
      const date = new Date(usage.timestamp);
      let key: string;

      if (groupBy === 'hour') {
        key = `${date.toISOString().slice(0, 13)}:00:00`;
      } else {
        key = date.toISOString().slice(0, 10);
      }

      if (!grouped[key]) {
        grouped[key] = {
          calls: 0,
          tokens: 0,
          cost: 0,
          latency: [],
          errors: 0,
          byProvider: {},
          byModel: {},
          byContext: {}
        };
      }

      grouped[key].calls++;
      grouped[key].tokens += usage.totalTokens;
      grouped[key].cost += usage.totalCost;
      if (usage.latencyMs) grouped[key].latency.push(usage.latencyMs);
      if (!usage.success) grouped[key].errors++;

      // By provider
      if (!grouped[key].byProvider[usage.provider]) {
        grouped[key].byProvider[usage.provider] = { calls: 0, cost: 0 };
      }
      grouped[key].byProvider[usage.provider].calls++;
      grouped[key].byProvider[usage.provider].cost += usage.totalCost;

      // By model
      if (!grouped[key].byModel[usage.modelId]) {
        grouped[key].byModel[usage.modelId] = { calls: 0, cost: 0 };
      }
      grouped[key].byModel[usage.modelId].calls++;
      grouped[key].byModel[usage.modelId].cost += usage.totalCost;

      // By context
      const context = usage.context || 'other';
      if (!grouped[key].byContext) grouped[key].byContext! = {};
      if (!grouped[key].byContext![context]) {
        grouped[key].byContext![context] = { calls: 0, cost: 0 };
      }
      grouped[key].byContext![context].calls++;
      grouped[key].byContext![context].cost += usage.totalCost;
    });

    // Convert to array format
    const trends = Object.entries(grouped)
      .map(([date, data]) => {
        if (!data) return null;
        return {
          date,
          calls: data.calls,
          tokens: data.tokens,
          cost: data.cost,
          avgLatency: data.latency.length > 0
            ? data.latency.reduce((a, b) => a + b, 0) / data.latency.length
            : 0,
          errorRate: data.calls > 0 ? (data.errors / data.calls) * 100 : 0,
          byProvider: data.byProvider,
          byModel: data.byModel,
          byContext: (data as any).byContext || {}
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        period,
        trends,
        summary: {
          totalCalls: trends.reduce((sum, t) => sum + t.calls, 0),
          totalTokens: trends.reduce((sum, t) => sum + t.tokens, 0),
          totalCost: trends.reduce((sum, t) => sum + t.cost, 0),
          avgLatency: trends.reduce((sum, t) => sum + t.avgLatency, 0) / trends.length || 0,
          totalErrors: trends.reduce((sum, t) => sum + (t.calls * t.errorRate / 100), 0)
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get LLM trends:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-analytics/model-comparison
 * Compare models across different metrics
 */
router.get('/model-comparison', async (req: AdminRequest, res, next) => {
  try {
    const DateRangeSchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional()
    });

    const { startDate, endDate } = DateRangeSchema.parse(req.query);

    const query: any = {};
    if (startDate) query.timestamp = { ...query.timestamp, $gte: new Date(startDate) };
    if (endDate) query.timestamp = { ...query.timestamp, $lte: new Date(endDate) };

    const usageData = await LLMUsage.find(query).lean();

    // Group by model
    const modelStats: Record<string, {
      calls: number;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      totalCost: number;
      avgLatency: number[];
      errors: number;
      provider: string;
    }> = {};

    usageData.forEach(usage => {
      if (!modelStats[usage.modelId]) {
        modelStats[usage.modelId] = {
          calls: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          avgLatency: [],
          errors: 0,
          provider: usage.provider
        };
      }

      modelStats[usage.modelId].calls++;
      modelStats[usage.modelId].totalTokens += usage.totalTokens;
      modelStats[usage.modelId].inputTokens += usage.inputTokens;
      modelStats[usage.modelId].outputTokens += usage.outputTokens;
      modelStats[usage.modelId].totalCost += usage.totalCost;
      if (usage.latencyMs) modelStats[usage.modelId].avgLatency.push(usage.latencyMs);
      if (!usage.success) modelStats[usage.modelId].errors++;
    });

    // Calculate averages and metrics
    const comparison = Object.entries(modelStats).map(([modelId, stats]) => ({
      modelId,
      provider: stats.provider,
      calls: stats.calls,
      totalTokens: stats.totalTokens,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      totalCost: stats.totalCost,
      avgCostPerCall: stats.calls > 0 ? stats.totalCost / stats.calls : 0,
      avgTokensPerCall: stats.calls > 0 ? stats.totalTokens / stats.calls : 0,
      avgLatency: stats.avgLatency.length > 0
        ? stats.avgLatency.reduce((a, b) => a + b, 0) / stats.avgLatency.length
        : 0,
      errorRate: stats.calls > 0 ? (stats.errors / stats.calls) * 100 : 0,
      successRate: stats.calls > 0 ? ((stats.calls - stats.errors) / stats.calls) * 100 : 100
    }));

    res.json({
      success: true,
      data: {
        models: comparison.sort((a, b) => b.calls - a.calls)
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get model comparison:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-analytics/cost-analysis
 * Detailed cost analysis over time
 */
router.get('/cost-analysis', async (req: AdminRequest, res, next) => {
  try {
    const CostAnalysisSchema = z.object({
      period: z.enum(['7d', '30d', '90d']).default('30d'),
      groupBy: z.enum(['hour', 'day', 'month']).default('day')
    });

    const { period, groupBy } = CostAnalysisSchema.parse(req.query);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    const usageData = await LLMUsage.find({
      timestamp: { $gte: startDate, $lte: endDate }
    }).lean();

    // Group by time period and provider/model
    const costAnalysis: Record<string, {
      date: string;
      totalCost: number;
      byProvider: Record<string, number>;
      byModel: Record<string, number>;
      inputCost: number;
      outputCost: number;
    }> = {};

    usageData.forEach(usage => {
      const date = new Date(usage.timestamp);
      let key: string;

      if (groupBy === 'hour') {
        key = `${date.toISOString().slice(0, 13)}:00:00`;
      } else if (groupBy === 'day') {
        key = date.toISOString().slice(0, 10);
      } else {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        key = `${date.getFullYear()}-${month}`;
      }

      if (!costAnalysis[key]) {
        costAnalysis[key] = {
          date: key,
          totalCost: 0,
          byProvider: {},
          byModel: {},
          inputCost: 0,
          outputCost: 0
        };
      }

      costAnalysis[key].totalCost += usage.totalCost;
      costAnalysis[key].inputCost += usage.inputCost || 0;
      costAnalysis[key].outputCost += usage.outputCost || 0;

      costAnalysis[key].byProvider[usage.provider] =
        (costAnalysis[key].byProvider[usage.provider] || 0) + usage.totalCost;

      costAnalysis[key].byModel[usage.modelId] =
        (costAnalysis[key].byModel[usage.modelId] || 0) + usage.totalCost;
    });

    const analysis = Object.values(costAnalysis)
      .map(item => ({
        ...item,
        byProvider: Object.entries(item.byProvider).map(([provider, cost]) => ({ provider, cost })),
        byModel: Object.entries(item.byModel).map(([model, cost]) => ({ model, cost }))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate projections
    const avgDailyCost = analysis.length > 0
      ? analysis.reduce((sum, item) => sum + item.totalCost, 0) / analysis.length
      : 0;
    const projectedMonthly = avgDailyCost * 30;
    const projectedYearly = avgDailyCost * 365;

    res.json({
      success: true,
      data: {
        period,
        groupBy,
        analysis,
        projections: {
          avgDailyCost,
          projectedMonthly,
          projectedYearly
        },
        totals: {
          totalCost: analysis.reduce((sum, item) => sum + item.totalCost, 0),
          inputCost: analysis.reduce((sum, item) => sum + item.inputCost, 0),
          outputCost: analysis.reduce((sum, item) => sum + item.outputCost, 0)
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get cost analysis:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-analytics/performance
 * Performance metrics for LLM calls
 */
router.get('/performance', async (req: AdminRequest, res, next) => {
  try {
    const PerformanceSchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      modelId: z.string().optional(),
      provider: z.string().optional()
    });

    const { startDate, endDate, modelId, provider } = PerformanceSchema.parse(req.query);

    const query: any = {};
    if (startDate) query.timestamp = { ...query.timestamp, $gte: new Date(startDate) };
    if (endDate) query.timestamp = { ...query.timestamp, $lte: new Date(endDate) };
    if (modelId) query.modelId = modelId;
    if (provider) query.provider = provider;

    const usageData = await LLMUsage.find(query).lean();

    const latencies = usageData
      .filter(u => u.latencyMs !== undefined && u.latencyMs !== null)
      .map(u => u.latencyMs!);

    const successful = usageData.filter(u => u.success).length;
    const failed = usageData.length - successful;

    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    res.json({
      success: true,
      data: {
        totalCalls: usageData.length,
        successfulCalls: successful,
        failedCalls: failed,
        successRate: usageData.length > 0 ? (successful / usageData.length) * 100 : 0,
        latency: {
          avg: latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0,
          min: latencies[0] || 0,
          max: latencies[latencies.length - 1] || 0,
          p50,
          p95,
          p99
        },
        tokenEfficiency: usageData.length > 0
          ? usageData.reduce((sum, u) => sum + u.totalTokens, 0) / usageData.length
          : 0
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get performance metrics:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-analytics/context-breakdown
 * Get usage breakdown by context (wizard vs workspace)
 */
router.get('/context-breakdown', async (req: AdminRequest, res, next) => {
  try {
    const ContextBreakdownSchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional()
    });

    const { startDate, endDate } = ContextBreakdownSchema.parse(req.query);

    const query: any = {};
    if (startDate) query.timestamp = { ...query.timestamp, $gte: new Date(startDate) };
    if (endDate) query.timestamp = { ...query.timestamp, $lte: new Date(endDate) };

    const usageData = await LLMUsage.find(query).lean();

    // Group by context
    const contextStats: Record<string, {
      calls: number;
      totalTokens: number;
      totalCost: number;
      inputTokens: number;
      outputTokens: number;
      avgLatency: number[];
      errors: number;
      byModel: Record<string, { calls: number; cost: number }>;
      byProvider: Record<string, { calls: number; cost: number }>;
    }> = {};

    usageData.forEach(usage => {
      const context = usage.context || 'other';

      if (!contextStats[context]) {
        contextStats[context] = {
          calls: 0,
          totalTokens: 0,
          totalCost: 0,
          inputTokens: 0,
          outputTokens: 0,
          avgLatency: [],
          errors: 0,
          byModel: {},
          byProvider: {}
        };
      }

      contextStats[context].calls++;
      contextStats[context].totalTokens += usage.totalTokens;
      contextStats[context].totalCost += usage.totalCost;
      contextStats[context].inputTokens += usage.inputTokens;
      contextStats[context].outputTokens += usage.outputTokens;
      if (usage.latencyMs) contextStats[context].avgLatency.push(usage.latencyMs);
      if (!usage.success) contextStats[context].errors++;

      // By model
      if (!contextStats[context].byModel[usage.modelId]) {
        contextStats[context].byModel[usage.modelId] = { calls: 0, cost: 0 };
      }
      contextStats[context].byModel[usage.modelId].calls++;
      contextStats[context].byModel[usage.modelId].cost += usage.totalCost;

      // By provider
      if (!contextStats[context].byProvider[usage.provider]) {
        contextStats[context].byProvider[usage.provider] = { calls: 0, cost: 0 };
      }
      contextStats[context].byProvider[usage.provider].calls++;
      contextStats[context].byProvider[usage.provider].cost += usage.totalCost;
    });

    // Format response
    const breakdown = Object.entries(contextStats).map(([context, stats]) => ({
      context,
      calls: stats.calls,
      totalTokens: stats.totalTokens,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      totalCost: stats.totalCost,
      avgCostPerCall: stats.calls > 0 ? stats.totalCost / stats.calls : 0,
      avgLatency: stats.avgLatency.length > 0
        ? stats.avgLatency.reduce((a, b) => a + b, 0) / stats.avgLatency.length
        : 0,
      errorRate: stats.calls > 0 ? (stats.errors / stats.calls) * 100 : 0,
      successRate: stats.calls > 0 ? ((stats.calls - stats.errors) / stats.calls) * 100 : 100,
      byModel: Object.entries(stats.byModel).map(([modelId, data]) => ({
        modelId,
        calls: data.calls,
        cost: data.cost
      })),
      byProvider: Object.entries(stats.byProvider).map(([provider, data]) => ({
        provider,
        calls: data.calls,
        cost: data.cost
      }))
    }));

    res.json({
      success: true,
      data: {
        breakdown,
        total: {
          calls: breakdown.reduce((sum, c) => sum + c.calls, 0),
          totalTokens: breakdown.reduce((sum, c) => sum + c.totalTokens, 0),
          totalCost: breakdown.reduce((sum, c) => sum + c.totalCost, 0)
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get context breakdown:', error);
    next(error);
  }
});

export default router;
