/**
 * Router A/B Test Routes
 * API endpoints for managing LLM router A/B tests.
 * Tests are persisted to MongoDB (ABTest.model.ts) — no longer in-memory.
 */

import express, { Request, Response } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { llmRouterAutoTuneService } from '../services/llmRouterAutoTune.service.js';
import { llmRouterSettingsService } from '../services/llmRouterSettings.service.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { ABTest, IABTest } from '../models/ABTest.model.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(requireAdmin);

// ─── Helpers ────────────────────────────────────────────────────────────────

function winnerScore(metrics: { successRate: number; avgLatency: number; avgCost: number }): number {
  const normalizedLatency = Math.min(metrics.avgLatency / 5000, 1);
  const normalizedCost = Math.min(metrics.avgCost / 0.1, 1);
  return (metrics.successRate / 100) * 0.4 + (1 - normalizedLatency) * 0.3 + (1 - normalizedCost) * 0.3;
}

async function calculateTestMetrics(test: IABTest): Promise<void> {
  try {
    const startTime = new Date(test.startedAt);
    const endTime = test.completedAt ? new Date(test.completedAt) : new Date();

    const usageData = await LLMUsage.find({
      timestamp: { $gte: startTime, $lte: endTime },
    }).lean();

    if (usageData.length === 0) return;

    const variantAssignments: Record<string, typeof usageData> = {};
    test.variants.forEach(v => { variantAssignments[v.id] = []; });

    usageData.forEach((usage, idx) => {
      let cumulative = 0;
      const rand = (idx % 100) / 100;
      for (const variant of test.variants) {
        cumulative += variant.trafficPercent / 100;
        if (rand < cumulative) {
          variantAssignments[variant.id].push(usage);
          break;
        }
      }
    });

    const updatedMetrics: Record<string, any> = {};
    for (const variant of test.variants) {
      const records = variantAssignments[variant.id];
      if (records.length === 0) {
        updatedMetrics[variant.id] = { requests: 0, successRate: 100, avgLatency: 0, avgCost: 0 };
        continue;
      }
      const successCount = records.filter(u => u.success).length;
      const latencies = records.filter(u => u.latencyMs).map(u => u.latencyMs!);
      const costs = records.map(u => u.totalCost);
      updatedMetrics[variant.id] = {
        requests: records.length,
        successRate: (successCount / records.length) * 100,
        avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        avgCost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
      };
    }

    await ABTest.updateOne({ testId: test.testId }, { $set: { metrics: updatedMetrics } });
    test.metrics = updatedMetrics;
  } catch (error) {
    logger.error('Failed to calculate test metrics:', error);
  }
}

function calcSignificance(test: IABTest) {
  const variants = test.variants;
  if (variants.length < 2) {
    return { isSignificant: false, confidence: 0, recommendedAction: 'Need at least 2 variants' };
  }
  const metrics = variants.map(v => test.metrics[v.id]);
  const totalRequests = metrics.reduce((sum, m) => sum + (m?.requests ?? 0), 0);

  if (totalRequests < 100) {
    return {
      isSignificant: false,
      confidence: Math.min((totalRequests / 100) * 50, 50),
      recommendedAction: 'Need more data (minimum 100 requests recommended)',
    };
  }

  const rates = metrics.map(m => m?.successRate ?? 100);
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rates.length;
  const isSignificant = variance > 25;
  const confidence = Math.min(90 + (variance / 100) * 10, 99);

  let recommendedAction = 'Continue collecting data';
  if (isSignificant && totalRequests >= 1000) {
    const best = variants[rates.indexOf(Math.max(...rates))];
    recommendedAction = `Consider applying ${best.name} as winner`;
  }

  return { isSignificant, confidence, recommendedAction };
}

async function autoComplete(testId: string): Promise<void> {
  const test = await ABTest.findOne({ testId, status: 'running' });
  if (!test) return;

  await calculateTestMetrics(test);

  let bestScore = -Infinity;
  let winnerId: string | undefined;
  for (const variant of test.variants) {
    const m = test.metrics[variant.id];
    if (m && m.requests > 0) {
      const s = winnerScore(m);
      if (s > bestScore) { bestScore = s; winnerId = variant.id; }
    }
  }

  await ABTest.updateOne(
    { testId },
    { $set: { status: 'completed', completedAt: new Date(), winner: winnerId } }
  );
  logger.info(`A/B test ${testId} auto-completed. Winner: ${winnerId}`);
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/llm-router/ab-tests
 */
router.get('/ab-tests', async (req: Request, res: Response) => {
  try {
    const filter: Record<string, any> = {};
    if (req.query.status) filter.status = req.query.status;

    const tests = await ABTest.find(filter).sort({ startedAt: -1 }).lean();
    res.json({ success: true, data: tests });
  } catch (error: any) {
    logger.error('Failed to get A/B tests:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve A/B tests', error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ab-tests/:testId
 */
router.get('/ab-tests/:testId', async (req: Request, res: Response) => {
  try {
    const test = await ABTest.findOne({ testId: req.params.testId }).lean();
    if (!test) return res.status(404).json({ success: false, message: 'A/B test not found' });
    res.json({ success: true, data: test });
  } catch (error: any) {
    logger.error(`Failed to get A/B test ${req.params.testId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to retrieve A/B test', error: error.message });
  }
});

/**
 * POST /api/admin/llm-router/ab-tests
 */
router.post('/ab-tests', async (req: Request, res: Response) => {
  try {
    const { name, description, variants, durationHours = 24 } = req.body;
    const userId = (req as any).user?.id || 'admin';

    if (!name) return res.status(400).json({ success: false, message: 'Test name is required' });
    if (!variants || !Array.isArray(variants) || variants.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 variants are required' });
    }

    const totalTraffic = variants.reduce((sum: number, v: any) => sum + (v.trafficPercent || 0), 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      return res.status(400).json({ success: false, message: 'Variant traffic percentages must sum to 100' });
    }

    const testId = `ab-${uuidv4()}`;
    const builtVariants = variants.map((v: any, idx: number) => ({
      id: v.id || `variant-${idx}`,
      name: v.name || `Variant ${String.fromCharCode(65 + idx)}`,
      config: v.config || {},
      trafficPercent: v.trafficPercent || 100 / variants.length,
    }));

    const initialMetrics: Record<string, any> = {};
    builtVariants.forEach(v => {
      initialMetrics[v.id] = { requests: 0, successRate: 100, avgLatency: 0, avgCost: 0 };
    });

    const test = await ABTest.create({
      testId,
      name,
      description,
      status: 'running',
      variants: builtVariants,
      metrics: initialMetrics,
      startedAt: new Date(),
      createdBy: userId,
    });

    if (durationHours > 0) {
      setTimeout(() => autoComplete(testId), durationHours * 60 * 60 * 1000);
    }

    logger.info(`A/B test created: ${testId} by ${userId}`);
    res.status(201).json({ success: true, data: test, message: 'A/B test created successfully' });
  } catch (error: any) {
    logger.error('Failed to create A/B test:', error);
    res.status(500).json({ success: false, message: 'Failed to create A/B test', error: error.message });
  }
});

/**
 * POST /api/admin/llm-router/ab-tests/:testId/complete
 */
router.post('/ab-tests/:testId/complete', async (req: Request, res: Response) => {
  try {
    const test = await ABTest.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ success: false, message: 'A/B test not found' });
    if (test.status !== 'running') {
      return res.status(400).json({ success: false, message: `Cannot complete test with status: ${test.status}` });
    }

    await calculateTestMetrics(test);

    let bestScore = -Infinity;
    let winnerId: string | undefined;
    for (const variant of test.variants) {
      const m = test.metrics[variant.id];
      if (m && m.requests > 0) {
        const s = winnerScore(m);
        if (s > bestScore) { bestScore = s; winnerId = variant.id; }
      }
    }

    test.status = 'completed';
    test.completedAt = new Date();
    test.winner = winnerId;
    await test.save();

    logger.info(`A/B test ${test.testId} completed. Winner: ${winnerId}`);
    res.json({ success: true, data: test, message: `A/B test completed. Winner: ${winnerId || 'No clear winner'}` });
  } catch (error: any) {
    logger.error(`Failed to complete A/B test ${req.params.testId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to complete A/B test', error: error.message });
  }
});

/**
 * POST /api/admin/llm-router/ab-tests/:testId/apply-winner
 */
router.post('/ab-tests/:testId/apply-winner', async (req: Request, res: Response) => {
  try {
    const test = await ABTest.findOne({ testId: req.params.testId }).lean();
    if (!test) return res.status(404).json({ success: false, message: 'A/B test not found' });
    if (test.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Test must be completed before applying winner' });
    }
    if (!test.winner) {
      return res.status(400).json({ success: false, message: 'No winner determined for this test' });
    }

    const winningVariant = test.variants.find(v => v.id === test.winner);
    if (!winningVariant) {
      return res.status(500).json({ success: false, message: 'Winner variant not found' });
    }

    await llmRouterSettingsService.updateGlobalSettings(winningVariant.config);
    logger.info(`Applied winning variant ${test.winner} from A/B test ${test.testId}`);

    res.json({
      success: true,
      message: `Applied winning configuration from variant: ${winningVariant.name}`,
      appliedConfig: winningVariant.config,
    });
  } catch (error: any) {
    logger.error(`Failed to apply winner for A/B test ${req.params.testId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to apply winning configuration', error: error.message });
  }
});

/**
 * DELETE /api/admin/llm-router/ab-tests/:testId
 */
router.delete('/ab-tests/:testId', async (req: Request, res: Response) => {
  try {
    const test = await ABTest.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ success: false, message: 'A/B test not found' });

    if (test.status === 'running') {
      await ABTest.updateOne({ testId: req.params.testId }, { $set: { status: 'cancelled', completedAt: new Date() } });
      logger.info(`A/B test ${req.params.testId} cancelled`);
      return res.json({ success: true, message: 'A/B test cancelled' });
    }

    await ABTest.deleteOne({ testId: req.params.testId });
    logger.info(`A/B test ${req.params.testId} deleted`);
    res.json({ success: true, message: 'A/B test deleted' });
  } catch (error: any) {
    logger.error(`Failed to delete A/B test ${req.params.testId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to delete A/B test', error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ab-tests/:testId/metrics
 */
router.get('/ab-tests/:testId/metrics', async (req: Request, res: Response) => {
  try {
    const test = await ABTest.findOne({ testId: req.params.testId });
    if (!test) return res.status(404).json({ success: false, message: 'A/B test not found' });

    await calculateTestMetrics(test);
    const significance = calcSignificance(test);

    res.json({
      success: true,
      data: {
        testId: test.testId,
        status: test.status,
        metrics: test.metrics,
        significance,
        runtime: { started: test.startedAt, duration: Date.now() - new Date(test.startedAt).getTime() },
      },
    });
  } catch (error: any) {
    logger.error(`Failed to get metrics for A/B test ${req.params.testId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to retrieve test metrics', error: error.message });
  }
});

export default router;
