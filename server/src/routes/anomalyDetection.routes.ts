/**
 * Anomaly Detection Routes
 * API endpoints for detecting and retrieving anomalies
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { anomalyDetectionService } from '../services/anomalyDetection.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// User-facing routes (require auth)
const userRouter = express.Router();
userRouter.use(authenticateToken);

// Admin routes
const adminRouter = express.Router();
adminRouter.use(authenticateToken);
adminRouter.use(requireAdmin);

/**
 * GET /api/v1/anomalies
 * Get anomalies for current user's projects
 */
userRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { hours = '24', projectId } = req.query;
    const hoursNum = parseInt(hours as string) || 24;

    const anomalies = await anomalyDetectionService.detectAnomalies(hoursNum, {
      userId: req.user!.id,
      projectId: projectId as string | undefined
    });

    res.json({
      success: true,
      data: {
        anomalies,
        count: anomalies.length
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get anomalies:', error);
    next(error);
  }
});

/**
 * GET /api/admin/anomalies
 * Get all anomalies (admin only)
 */
adminRouter.get('/', async (req: AdminRequest, res, next) => {
  try {
    const { hours = '24', userId, projectId, modelId, provider } = req.query;
    const hoursNum = parseInt(hours as string) || 24;

    const anomalies = await anomalyDetectionService.detectAnomalies(hoursNum, {
      userId: userId as string | undefined,
      projectId: projectId as string | undefined,
      modelId: modelId as string | undefined,
      provider: provider as string | undefined
    });

    res.json({
      success: true,
      data: {
        anomalies,
        count: anomalies.length
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get anomalies:', error);
    next(error);
  }
});

// Mount routers
router.use(userRouter);
router.use('/admin', adminRouter);

export default router;




