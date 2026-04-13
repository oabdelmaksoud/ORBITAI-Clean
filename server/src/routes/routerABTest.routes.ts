/**
 * Router A/B Test Routes
 * API endpoints for managing LLM router A/B tests
 */

import express, { Request, Response } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { llmRouterAutoTuneService, ABTestConfiguration, PerformanceMetrics } from '../services/llmRouterAutoTune.service.js';
import { llmRouterSettingsService } from '../services/llmRouterSettings.service.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { ABTest, IABTest } from '../models/ABTest.model.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// Type alias kept for internal helper function compatibility
interface ABTestWithVariants {
  id: string;
  name: string;
  description?: string;
  status: 'running' | 'completed' | 'cancelled';
  variants: Array<{
    id: string;
    name: string;
    config: any;
    trafficPercent: number;
  }>;
  metrics: {
    [variantId: string]: {
      requests: number;
      successRate: number;
      avgLatency: number;
      avgCost: number;
    };
  };
  winner?: string;
  startedAt: Date;
  completedAt?: Date;
  createdBy: string;
}

/** Convert a Mongoose ABTest document to the wire-format shape */
function toWireFormat(doc: IABTest): ABTestWithVariants {
  return {
    id: doc.testId,
    name: doc.name,
    description: doc.description,
    status: doc.status,
    variants: doc.variants,
    metrics: doc.metrics as ABTestWithVariants['metrics'],
    winner: doc.winner,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    createdBy: doc.createdBy
  };
}

/**
 * GET /api/admin/llm-router/ab-tests
 * Get all A/B tests
 */
router.get('/ab-tests', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;

    const filter: Record<string, any> = {};
    if (status) {
      filter.status = status;
    }

    const docs = await ABTest.find(filter).sort({ startedAt: -1 }).lean();

    res.json({
      success: true,
      data: docs.map(d => toWireFormat(d as IABTest))
    });
  } catch (error: unknown) {
    logger.error('Failed to get A/B tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve A/B tests',
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/admin/llm-router/ab-tests/:testId
 * Get a specific A/B test
 */
router.get('/ab-tests/:testId', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const doc = await ABTest.findOne({ testId }).lean();

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
    }

    res.json({
      success: true,
      data: toWireFormat(doc as IABTest)
    });
  } catch (error: unknown) {
    logger.error(`Failed to get A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve A/B test',
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/llm-router/ab-tests
 * Create a new A/B test
 */
router.post('/ab-tests', async (req: Request, res: Response) => {
  try {
    const { name, description, variants, durationHours = 24 } = req.body;
    const userId = (req as any).user?.id || 'admin';

    // Validate input
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Test name is required'
      });
    }

    if (!variants || !Array.isArray(variants) || variants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 variants are required'
      });
    }

    // Validate traffic percentages sum to 100
    const totalTraffic = variants.reduce((sum: number, v: any) => sum + (v.trafficPercent || 0), 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Variant traffic percentages must sum to 100'
      });
    }

    const testId = `ab-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const mappedVariants = variants.map((v: any, idx: number) => ({
      id: v.id || `variant-${idx}`,
      name: v.name || `Variant ${String.fromCharCode(65 + idx)}`,
      config: v.config || {},
      trafficPercent: v.trafficPercent || (100 / variants.length)
    }));

    // Initialise per-variant metrics
    const initialMetrics: Record<string, IABTest['metrics'][string]> = {};
    mappedVariants.forEach(v => {
      initialMetrics[v.id] = { requests: 0, successRate: 100, avgLatency: 0, avgCost: 0 };
    });

    const doc = await ABTest.create({
      testId,
      name,
      description,
      status: 'running',
      variants: mappedVariants,
      metrics: initialMetrics,
      startedAt: new Date(),
      createdBy: userId
    });

    // Schedule auto-completion if duration specified
    if (durationHours > 0) {
      setTimeout(() => {
        completeABTestAutomatically(testId);
      }, durationHours * 60 * 60 * 1000);
    }

    logger.info(`A/B test created: ${testId} by ${userId}`);

    res.status(201).json({
      success: true,
      data: toWireFormat(doc),
      message: 'A/B test created successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to create A/B test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create A/B test',
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/llm-router/ab-tests/:testId/complete
 * Complete an A/B test and determine winner
 */
router.post('/ab-tests/:testId/complete', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const doc = await ABTest.findOne({ testId });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
    }

    if (doc.status !== 'running') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete test with status: ${doc.status}`
      });
    }

    const test = toWireFormat(doc);

    // Calculate final metrics and determine winner
    await calculateTestMetrics(test);

    // Determine winner based on composite score
    let bestScore = -Infinity;
    let winnerId: string | undefined;

    for (const variant of test.variants) {
      const metrics = test.metrics[variant.id];
      if (metrics) {
        const normalizedLatency = Math.min(metrics.avgLatency / 5000, 1);
        const normalizedCost = Math.min(metrics.avgCost / 0.1, 1);
        const score =
          (metrics.successRate / 100) * 0.4 +
          (1 - normalizedLatency) * 0.3 +
          (1 - normalizedCost) * 0.3;

        if (score > bestScore && metrics.requests > 0) {
          bestScore = score;
          winnerId = variant.id;
        }
      }
    }

    doc.status = 'completed';
    doc.completedAt = new Date();
    doc.winner = winnerId;
    doc.metrics = test.metrics;
    await doc.save();

    logger.info(`A/B test ${testId} completed. Winner: ${winnerId}`);

    res.json({
      success: true,
      data: toWireFormat(doc),
      message: `A/B test completed. Winner: ${winnerId || 'No clear winner'}`
    });
  } catch (error: unknown) {
    logger.error(`Failed to complete A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete A/B test',
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/admin/llm-router/ab-tests/:testId/apply-winner
 * Apply the winning variant's configuration
 */
router.post('/ab-tests/:testId/apply-winner', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const doc = await ABTest.findOne({ testId }).lean();

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
    }

    if (doc.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Test must be completed before applying winner'
      });
    }

    if (!doc.winner) {
      return res.status(400).json({
        success: false,
        message: 'No winner determined for this test'
      });
    }

    const winningVariant = doc.variants.find(v => v.id === doc.winner);
    if (!winningVariant) {
      return res.status(500).json({
        success: false,
        message: 'Winner variant not found'
      });
    }

    // Apply the winning configuration to global settings
    await llmRouterSettingsService.updateGlobalSettings(winningVariant.config);

    logger.info(`Applied winning variant ${doc.winner} from A/B test ${testId}`);

    res.json({
      success: true,
      message: `Applied winning configuration from variant: ${winningVariant.name}`,
      appliedConfig: winningVariant.config
    });
  } catch (error: unknown) {
    logger.error(`Failed to apply winner for A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply winning configuration',
      error: (error as Error).message
    });
  }
});

/**
 * DELETE /api/admin/llm-router/ab-tests/:testId
 * Cancel/delete an A/B test
 */
router.delete('/ab-tests/:testId', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const doc = await ABTest.findOne({ testId });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
    }

    if (doc.status === 'running') {
      doc.status = 'cancelled';
      doc.completedAt = new Date();
      await doc.save();
      logger.info(`A/B test ${testId} cancelled`);
      res.json({ success: true, message: 'A/B test cancelled' });
    } else {
      await ABTest.deleteOne({ testId });
      logger.info(`A/B test ${testId} deleted`);
      res.json({ success: true, message: 'A/B test deleted' });
    }
  } catch (error: unknown) {
    logger.error(`Failed to delete A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete A/B test',
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/admin/llm-router/ab-tests/:testId/metrics
 * Get real-time metrics for an A/B test
 */
router.get('/ab-tests/:testId/metrics', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const doc = await ABTest.findOne({ testId });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
    }

    const test = toWireFormat(doc);

    // Calculate current metrics
    await calculateTestMetrics(test);

    // Persist updated metrics back to DB
    doc.metrics = test.metrics;
    await doc.save();

    // Calculate statistical significance
    const significance = calculateStatisticalSignificance(test);

    res.json({
      success: true,
      data: {
        testId: test.id,
        status: test.status,
        metrics: test.metrics,
        significance,
        runtime: {
          started: test.startedAt,
          duration: Date.now() - new Date(test.startedAt).getTime()
        }
      }
    });
  } catch (error: unknown) {
    logger.error(`Failed to get metrics for A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve test metrics',
      error: (error as Error).message
    });
  }
});

// Helper functions

async function calculateTestMetrics(test: ABTestWithVariants): Promise<void> {
  try {
    const startTime = new Date(test.startedAt);
    const endTime = test.completedAt ? new Date(test.completedAt) : new Date();
    
    // Get usage data for the test period
    const usageData = await LLMUsage.find({
      timestamp: {
        $gte: startTime,
        $lte: endTime
      }
    }).lean();
    
    if (usageData.length === 0) {
      return;
    }
    
    // Simulate variant assignment (in production, this would be tracked per request)
    // For now, distribute usage data across variants based on traffic percentages
    let currentIndex = 0;
    const variantAssignments: { [key: string]: typeof usageData } = {};
    
    test.variants.forEach(v => {
      variantAssignments[v.id] = [];
    });
    
    // Assign usage records to variants based on traffic split
    usageData.forEach((usage, idx) => {
      let cumulative = 0;
      const rand = (idx % 100) / 100; // Deterministic assignment based on index
      
      for (const variant of test.variants) {
        cumulative += variant.trafficPercent / 100;
        if (rand < cumulative) {
          variantAssignments[variant.id].push(usage);
          break;
        }
      }
    });
    
    // Calculate metrics for each variant
    for (const variant of test.variants) {
      const variantUsage = variantAssignments[variant.id];
      
      if (variantUsage.length === 0) {
        test.metrics[variant.id] = {
          requests: 0,
          successRate: 100,
          avgLatency: 0,
          avgCost: 0
        };
        continue;
      }
      
      const successCount = variantUsage.filter(u => u.success).length;
      const latencies = variantUsage.filter(u => u.latencyMs).map(u => u.latencyMs!);
      const costs = variantUsage.map(u => u.totalCost);
      
      test.metrics[variant.id] = {
        requests: variantUsage.length,
        successRate: (successCount / variantUsage.length) * 100,
        avgLatency: latencies.length > 0 
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
          : 0,
        avgCost: costs.length > 0 
          ? costs.reduce((a, b) => a + b, 0) / costs.length 
          : 0
      };
    }
  } catch (error) {
    logger.error('Failed to calculate test metrics:', error);
  }
}

function calculateStatisticalSignificance(test: ABTestWithVariants): {
  isSignificant: boolean;
  confidence: number;
  recommendedAction: string;
} {
  // Simplified significance calculation
  // In production, use proper statistical tests (chi-squared, t-test, etc.)
  
  const variants = test.variants;
  if (variants.length < 2) {
    return {
      isSignificant: false,
      confidence: 0,
      recommendedAction: 'Need at least 2 variants'
    };
  }
  
  const metrics = variants.map(v => test.metrics[v.id]);
  const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
  
  if (totalRequests < 100) {
    return {
      isSignificant: false,
      confidence: Math.min(totalRequests / 100 * 50, 50),
      recommendedAction: 'Need more data (minimum 100 requests recommended)'
    };
  }
  
  // Calculate variance in success rates
  const successRates = metrics.map(m => m.successRate);
  const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
  const variance = successRates.reduce((sum, rate) => sum + Math.pow(rate - avgSuccessRate, 2), 0) / successRates.length;
  
  // Higher variance = more significant difference
  const isSignificant = variance > 25; // 5% difference squared
  const confidence = Math.min(90 + (variance / 100) * 10, 99);
  
  let recommendedAction = 'Continue collecting data';
  if (isSignificant && totalRequests >= 1000) {
    const bestVariant = variants[successRates.indexOf(Math.max(...successRates))];
    recommendedAction = `Consider applying ${bestVariant.name} as winner`;
  }
  
  return {
    isSignificant,
    confidence,
    recommendedAction
  };
}

async function completeABTestAutomatically(testId: string): Promise<void> {
  const doc = await ABTest.findOne({ testId });
  if (!doc || doc.status !== 'running') {
    return;
  }

  const test = toWireFormat(doc);
  await calculateTestMetrics(test);

  // Determine winner
  let bestScore = -Infinity;
  let winnerId: string | undefined;

  for (const variant of test.variants) {
    const metrics = test.metrics[variant.id];
    if (metrics && metrics.requests > 0) {
      const normalizedLatency = Math.min(metrics.avgLatency / 5000, 1);
      const normalizedCost = Math.min(metrics.avgCost / 0.1, 1);
      const score =
        (metrics.successRate / 100) * 0.4 +
        (1 - normalizedLatency) * 0.3 +
        (1 - normalizedCost) * 0.3;

      if (score > bestScore) {
        bestScore = score;
        winnerId = variant.id;
      }
    }
  }

  doc.status = 'completed';
  doc.completedAt = new Date();
  doc.winner = winnerId;
  doc.metrics = test.metrics;
  await doc.save();

  logger.info(`A/B test ${testId} auto-completed. Winner: ${winnerId}`);
}

export default router;

