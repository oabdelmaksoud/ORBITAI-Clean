/**
 * Process Analytics Routes
 * API endpoints for process improvement analytics
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { processAnalyticsService } from '../services/processAnalytics.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/process-analytics
 * Get comprehensive analytics
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let timeRange: { start: Date; end: Date } | undefined;
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };
    }

    const analytics = await processAnalyticsService.getAnalytics(timeRange);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/process-analytics/roi/:id
 * Calculate ROI for an improvement
 */
router.get('/roi/:id', async (req: AdminRequest, res, next) => {
  try {
    const roi = await processAnalyticsService.calculateROI(req.params.id);

    res.json({
      success: true,
      data: roi
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
















