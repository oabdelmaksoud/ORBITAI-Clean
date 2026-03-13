/**
 * Process Simulation Routes
 * API endpoints for process simulation and testing
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { processSimulationService } from '../services/processSimulation.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/process-simulation/simulate
 * Simulate a process
 */
router.post('/simulate', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, scenarios } = req.body;

    if (!improvementId || !scenarios || !Array.isArray(scenarios)) {
      throw new AppError('Improvement ID and scenarios array are required', 400);
    }

    const results = await processSimulationService.simulate(improvementId, scenarios);

    res.json({
      success: true,
      data: results
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/process-simulation/what-if
 * Perform what-if analysis
 */
router.post('/what-if', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, changes } = req.body;

    if (!improvementId || !changes) {
      throw new AppError('Improvement ID and changes are required', 400);
    }

    const result = await processSimulationService.whatIfAnalysis(improvementId, changes);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/process-simulation/predict
 * Predict process performance
 */
router.post('/predict', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, context } = req.body;

    if (!improvementId) {
      throw new AppError('Improvement ID is required', 400);
    }

    const prediction = await processSimulationService.predictPerformance(improvementId, context || {});

    res.json({
      success: true,
      data: prediction
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















