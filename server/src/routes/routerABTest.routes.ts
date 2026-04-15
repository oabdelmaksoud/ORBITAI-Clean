/**
 * Router A/B Test Routes
 * API endpoints for managing LLM router A/B tests
 */

import express, { Request, Response } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
// @ts-ignore TS6192
import { llmRouterAutoTuneService, ABTestConfiguration, PerformanceMetrics } from '../services/llmRouterAutoTune.service.js';
import { llmRouterSettingsService } from '../services/llmRouterSettings.service.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// In-memory storage for A/B tests (in production, use database)
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

const abTestsStorage = new Map<string, ABTestWithVariants>();

/**
 * GET /api/admin/llm-router/ab-tests
 * Get all A/B tests
 */
router.get('/ab-tests', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    
    let tests = Array.from(abTestsStorage.values());
    
    if (status) {
      tests = tests.filter(t => t.status === status);
    }
    
    // Sort by start date, most recent first
    tests.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    res.json({
      success: true,
      data: tests
    });
  } catch (error: unknown) {
    logger.error('Failed to get A/B tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve A/B tests',
      error: (error instanceof Error ? error.message : String(error))
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
    const test = abTestsStorage.get(testId);
    
    if (!test) {
      res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: test
    });
  } catch (error: unknown) {
    logger.error(`Failed to get A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve A/B test',
      error: (error instanceof Error ? error.message : String(error))
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
      res.status(400).json({
        success: false,
        message: 'Test name is required'
      });
      return;
    }
    
    if (!variants || !Array.isArray(variants) || variants.length < 2) {
      res.status(400).json({
        success: false,
        message: 'At least 2 variants are required'
      });
      return;
    }
    
    // Validate traffic percentages sum to 100
    const totalTraffic = variants.reduce((sum: number, v: any) => sum + (v.trafficPercent || 0), 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      res.status(400).json({
        success: false,
        message: 'Variant traffic percentages must sum to 100'
      });
      return;
    }
    
    // Create test
    const testId = `ab-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const test: ABTestWithVariants = {
      id: testId,
      name,
      description,
      status: 'running',
      variants: variants.map((v: any, idx: number) => ({
        id: v.id || `variant-${idx}`,
        name: v.name || `Variant ${String.fromCharCode(65 + idx)}`,
        config: v.config || {},
        trafficPercent: v.trafficPercent || (100 / variants.length)
      })),
      metrics: {},
      startedAt: new Date(),
      createdBy: userId
    };
    
    // Initialize metrics for each variant
    test.variants.forEach(v => {
      test.metrics[v.id] = {
        requests: 0,
        successRate: 100,
        avgLatency: 0,
        avgCost: 0
      };
    });
    
    abTestsStorage.set(testId, test);
    
    // Schedule auto-completion if duration specified
    if (durationHours > 0) {
      setTimeout(() => {
        completeABTestAutomatically(testId);
      }, durationHours * 60 * 60 * 1000);
    }
    
    logger.info(`A/B test created: ${testId} by ${userId}`);
    
    res.status(201).json({
      success: true,
      data: test,
      message: 'A/B test created successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to create A/B test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create A/B test',
      error: (error instanceof Error ? error.message : String(error))
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
    const test = abTestsStorage.get(testId);
    
    if (!test) {
      res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
      return;
    }
    
    if (test.status !== 'running') {
      res.status(400).json({
        success: false,
        message: `Cannot complete test with status: ${test.status}`
      });
      return;
    }
    
    // Calculate final metrics and determine winner
    await calculateTestMetrics(test);
    
    // Determine winner based on composite score
    let bestScore = -Infinity;
    let winnerId: string | undefined;
    
    for (const variant of test.variants) {
      const metrics = test.metrics[variant.id];
      if (metrics) {
        // Composite score: success rate (40%) + inverse latency (30%) + inverse cost (30%)
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
    
    test.status = 'completed';
    test.completedAt = new Date();
    test.winner = winnerId;
    
    logger.info(`A/B test ${testId} completed. Winner: ${winnerId}`);
    
    res.json({
      success: true,
      data: test,
      message: `A/B test completed. Winner: ${winnerId || 'No clear winner'}`
    });
  } catch (error: unknown) {
    logger.error(`Failed to complete A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete A/B test',
      error: (error instanceof Error ? error.message : String(error))
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
    const test = abTestsStorage.get(testId);
    
    if (!test) {
      res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
      return;
    }
    
    if (test.status !== 'completed') {
      res.status(400).json({
        success: false,
        message: 'Test must be completed before applying winner'
      });
      return;
    }
    
    if (!test.winner) {
      res.status(400).json({
        success: false,
        message: 'No winner determined for this test'
      });
      return;
    }
    
    const winningVariant = test.variants.find(v => v.id === test.winner);
    if (!winningVariant) {
      res.status(500).json({
        success: false,
        message: 'Winner variant not found'
      });
      return;
    }
    
    // Apply the winning configuration to global settings
    await llmRouterSettingsService.updateGlobalSettings(winningVariant.config);
    
    logger.info(`Applied winning variant ${test.winner} from A/B test ${testId}`);
    
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
      error: (error instanceof Error ? error.message : String(error))
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
    const test = abTestsStorage.get(testId);
    
    if (!test) {
      res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
      return;
    }
    
    if (test.status === 'running') {
      test.status = 'cancelled';
      test.completedAt = new Date();
      logger.info(`A/B test ${testId} cancelled`);
    } else {
      abTestsStorage.delete(testId);
      logger.info(`A/B test ${testId} deleted`);
    }
    
    res.json({
      success: true,
      message: test.status === 'cancelled' ? 'A/B test cancelled' : 'A/B test deleted'
    });
  } catch (error: unknown) {
    logger.error(`Failed to delete A/B test ${req.params.testId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete A/B test',
      error: (error instanceof Error ? error.message : String(error))
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
    const test = abTestsStorage.get(testId);
    
    if (!test) {
      res.status(404).json({
        success: false,
        message: 'A/B test not found'
      });
      return;
    }
    
    // Calculate current metrics
    await calculateTestMetrics(test);
    
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
      error: (error instanceof Error ? error.message : String(error))
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
    // let _currentIndex = 0;
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
  } catch (error: unknown) {
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
  const test = abTestsStorage.get(testId);
  if (!test || test.status !== 'running') {
    return;
  }
  
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
  
  test.status = 'completed';
  test.completedAt = new Date();
  test.winner = winnerId;
  
  logger.info(`A/B test ${testId} auto-completed. Winner: ${winnerId}`);
}

export default router;

