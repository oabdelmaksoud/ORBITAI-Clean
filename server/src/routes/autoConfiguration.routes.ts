/**
 * Auto-Configuration Routes
 * API endpoints for AI-powered configuration optimization
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { autoConfigurationService } from '../services/autoConfiguration.service.js';
import { rlRouterService } from '../services/llmRouterRL.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// User-facing routes
const userRouter = express.Router();
userRouter.use(authenticateToken);

// Admin routes
const adminRouter = express.Router();
adminRouter.use(authenticateToken);
adminRouter.use(requireAdmin);

/**
 * GET /api/v1/auto-config/analyze
 * Analyze configuration and get recommendations
 */
userRouter.get('/analyze', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;
    const analysis = await autoConfigurationService.analyzeConfiguration(
      req.user!.id,
      projectId as string | undefined
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: unknown) {
    logger.error('Failed to analyze configuration:', error);
    next(error);
  }
});

/**
 * POST /api/v1/auto-config/apply
 * Apply recommended configuration changes
 */
userRouter.post('/apply', async (req: AuthRequest, res, next) => {
  try {
    const { recommendations } = req.body;
    
    if (!Array.isArray(recommendations)) {
      res.status(400).json({
        success: false,
        message: 'Recommendations must be an array'
      });
      return;
    }

    const result = await autoConfigurationService.applyRecommendations(
      recommendations,
      req.user!.id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error('Failed to apply recommendations:', error);
    next(error);
  }
});

/**
 * POST /api/v1/auto-config/auto-configure
 * Automatically configure system based on analysis
 */
userRouter.post('/auto-configure', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.body;
    const result = await autoConfigurationService.autoConfigure(
      req.user!.id,
      projectId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error('Failed to auto-configure:', error);
    next(error);
  }
});

/**
 * GET /api/admin/rl-router/stats
 * Get RL router statistics (admin only)
 */
adminRouter.get('/rl-router/stats', async (_req: AdminRequest, res, next) => {
  try {
    const stats = rlRouterService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: unknown) {
    logger.error('Failed to get RL router stats:', error);
    next(error);
  }
});

// Mount routers
router.use(userRouter);
router.use('/admin', adminRouter);

export default router;




