/**
 * AI Optimization Routes
 * API endpoints for AI-powered process optimization
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { aiOptimizationService } from '../services/aiOptimization.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/ai-optimization/analyze
 * Analyze a process
 */
router.post('/analyze', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId } = req.body;

    if (!improvementId) {
      throw new AppError('Improvement ID is required', 400);
    }

    const analysis = await aiOptimizationService.analyzeProcess(improvementId);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/ai-optimization/suggest
 * Get optimization suggestions
 */
router.post('/suggest', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId } = req.body;

    if (!improvementId) {
      throw new AppError('Improvement ID is required', 400);
    }

    const suggestions = await aiOptimizationService.suggestOptimizations(improvementId);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/ai-optimization/test-variation
 * Test a process variation
 */
router.post('/test-variation', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, variation } = req.body;

    if (!improvementId || !variation) {
      throw new AppError('Improvement ID and variation are required', 400);
    }

    const result = await aiOptimizationService.testVariation(improvementId, variation);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/ai-optimization/predict
 * Predict process outcome
 */
router.post('/predict', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, context } = req.body;

    if (!improvementId) {
      throw new AppError('Improvement ID is required', 400);
    }

    const prediction = await aiOptimizationService.predictOutcome(improvementId, context || {});

    res.json({
      success: true,
      data: prediction
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/ai-optimization/auto-optimize
 * Auto-optimize a process
 */
router.post('/auto-optimize', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId } = req.body;

    if (!improvementId) {
      throw new AppError('Improvement ID is required', 400);
    }

    const result = await aiOptimizationService.autoOptimize(improvementId);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
















