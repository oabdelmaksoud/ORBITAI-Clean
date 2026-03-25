/**
 * Model Benchmark Routes
 * API endpoints for running and viewing model benchmarks
 */

import express, { Request, Response } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { modelBenchmarkService } from '../services/modelBenchmark.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

/**
 * POST /api/admin/llm-router/benchmark/run
 * Run a benchmark for a specific model
 */
router.post('/benchmark/run', async (req: Request, res: Response) => {
  try {
    const { modelId, taskType, timeoutMs, iterations } = req.body;

    if (!modelId || !taskType) {
      return res.status(400).json({
        success: false,
        message: 'modelId and taskType are required'
      });
    }

    // Check if benchmark is already running
    if (modelBenchmarkService.isBenchmarkRunning(modelId, taskType)) {
      return res.status(409).json({
        success: false,
        message: 'Benchmark already running for this model/task combination'
      });
    }

    const result = await modelBenchmarkService.runBenchmark({
      modelId,
      taskType,
      timeoutMs,
      iterations
    });

    res.json({
      success: true,
      data: result,
      message: 'Benchmark completed successfully'
    });
  } catch (error: any) {
    logger.error('Failed to run benchmark:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run benchmark',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/llm-router/benchmark/results
 * Get benchmark results
 */
router.get('/benchmark/results', async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId as string | undefined;
    const taskType = req.query.taskType as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const results = await modelBenchmarkService.getBenchmarkResults(modelId, taskType, limit);

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    logger.error('Failed to get benchmark results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve benchmark results',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/llm-router/benchmark/summary/:modelId
 * Get benchmark summary for a model
 */
router.get('/benchmark/summary/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const taskType = req.query.taskType as string | undefined;

    const summary = await modelBenchmarkService.getBenchmarkSummary(modelId, taskType);

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    logger.error(`Failed to get benchmark summary for ${req.params.modelId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve benchmark summary',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/llm-router/benchmark/compare/:taskType
 * Compare models for a specific task type
 */
router.get('/benchmark/compare/:taskType', async (req: Request, res: Response) => {
  try {
    const { taskType } = req.params;

    const comparison = await modelBenchmarkService.compareModels(taskType);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error: any) {
    logger.error(`Failed to compare models for ${req.params.taskType}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare models',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/llm-router/benchmark/trends/:modelId/:taskType
 * Get historical benchmark trends
 */
router.get('/benchmark/trends/:modelId/:taskType', async (req: Request, res: Response) => {
  try {
    const { modelId, taskType } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const trends = await modelBenchmarkService.getHistoricalTrends(modelId, taskType, days);

    res.json({
      success: true,
      data: trends
    });
  } catch (error: any) {
    logger.error(`Failed to get trends for ${req.params.modelId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve benchmark trends',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/llm-router/benchmark/task-types
 * Get available task types for benchmarking
 */
router.get('/benchmark/task-types', async (req: Request, res: Response) => {
  try {
    const taskTypes = modelBenchmarkService.getAvailableTaskTypes();

    res.json({
      success: true,
      data: taskTypes
    });
  } catch (error: any) {
    logger.error('Failed to get task types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve task types',
      error: error.message
    });
  }
});

export default router;

