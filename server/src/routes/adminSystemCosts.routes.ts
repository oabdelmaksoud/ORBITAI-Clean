import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { systemCostTrackingService } from '../services/systemCostTracking.service.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

/**
 * GET /api/admin/system-costs/breakdown
 * Get comprehensive system cost breakdown
 */
router.get('/breakdown', async (req: AdminRequest, res, next) => {
  try {
    const {
      startDate,
      endDate,
      provider,
      modelId,
      includeSystemCalls,
      includeUserCalls,
      groupBy
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (provider) options.provider = provider;
    if (modelId) options.modelId = modelId;
    if (includeSystemCalls !== undefined) {
      options.includeSystemCalls = includeSystemCalls === 'true';
    }
    if (includeUserCalls !== undefined) {
      options.includeUserCalls = includeUserCalls === 'true';
    }
    if (groupBy) {
      options.groupBy = groupBy as 'day' | 'hour' | 'week' | 'month';
    }

    const breakdown = await systemCostTrackingService.getSystemCostBreakdown(options);

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/system-costs/summary
 * Get cost summary for a period
 */
router.get('/summary', async (req: AdminRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const summary = await systemCostTrackingService.getCostSummary(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/system-costs/current-period
 * Get cost summary for current period (today, this week, this month)
 */
router.get('/current-period', async (_req: AdminRequest, res, next) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todaySummary, weekSummary, monthSummary] = await Promise.all([
      systemCostTrackingService.getCostSummary(today, now),
      systemCostTrackingService.getCostSummary(weekStart, now),
      systemCostTrackingService.getCostSummary(monthStart, now)
    ]);

    res.json({
      success: true,
      data: {
        today: todaySummary,
        week: weekSummary,
        month: monthSummary
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;




