/**
 * Hosting Routes
 * Manages hosting plans and hosted projects
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { hostingService } from '../services/hosting.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/hosting/plans
 * Get available hosting plans
 */
router.get('/plans', async (req: AuthRequest, res, next) => {
  try {
    const { projectType, platform } = req.query;

    const plans = await hostingService.getHostingPlans(
      projectType as string,
      platform as string
    );

    res.json({
      success: true,
      plans
    });
  } catch (error: unknown) {
    logger.error('Failed to get hosting plans:', error);
    next(error);
  }
});

/**
 * POST /api/hosting/create
 * Create hosting for a project
 */
router.post('/create', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id || '';
    const { projectId, platform, environment, hostingPlanId } = req.body;

    if (!projectId || !platform || !environment) {
      throw new AppError('projectId, platform, and environment are required', 400);
    }

    const hostedProject = await hostingService.createHosting(userId, {
      projectId,
      platform,
      environment,
      hostingPlanId
    });

    res.json({
      success: true,
      hostedProject
    });
  } catch (error: unknown) {
    logger.error('Failed to create hosting:', error);
    next(error);
  }
});

/**
 * GET /api/hosting/projects
 * Get user's hosted projects
 */
router.get('/projects', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id || '';
    const hostedProjects = await hostingService.getUserHostedProjects(userId);

    res.json({
      success: true,
      hostedProjects
    });
  } catch (error: unknown) {
    logger.error('Failed to get hosted projects:', error);
    next(error);
  }
});

/**
 * POST /api/hosting/:id/suspend
 * Suspend hosting
 */
router.post('/:id/suspend', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id || '';
    const { id } = req.params;

    await hostingService.suspendHosting(id, userId);

    res.json({
      success: true,
      message: 'Hosting suspended'
    });
  } catch (error: unknown) {
    logger.error('Failed to suspend hosting:', error);
    next(error);
  }
});

/**
 * POST /api/hosting/:id/terminate
 * Terminate hosting
 */
router.post('/:id/terminate', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id || '';
    const { id } = req.params;

    await hostingService.terminateHosting(id, userId);

    res.json({
      success: true,
      message: 'Hosting terminated'
    });
  } catch (error: unknown) {
    logger.error('Failed to terminate hosting:', error);
    next(error);
  }
});

export default router;




