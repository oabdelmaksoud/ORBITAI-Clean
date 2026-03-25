import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { usageTracker } from '../services/llm/UsageTracker.js';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';

const router = express.Router();

// User-facing routes (require auth but not admin)
const userRouter = express.Router();
userRouter.use(authenticateToken);

// Admin routes require admin role
const adminRouter = express.Router();
adminRouter.use(authenticateToken);
adminRouter.use(requireAdmin);

/**
 * GET /api/v1/llm-usage/project/:projectId
 * Get project-specific usage stats (user-facing, requires project ownership)
 */
userRouter.get('/project/:projectId', async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    // Validate ObjectId format before querying database
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    // Verify project belongs to user
    const project = await Project.findOne({
      _id: projectId,
      userId: userId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get usage stats for this project
    const stats = await usageTracker.getUsageStats({
      projectId: projectId,
      userId: userId
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get project LLM usage:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-usage/live
 * Get live/real-time LLM usage (last 5 minutes)
 */
adminRouter.get('/live', async (_req: AdminRequest, res, next) => {
  try {
    const minutes = parseInt(_req.query.minutes as string) || 5;
    const liveUsage = await usageTracker.getLiveUsage(minutes);
    
    res.json({
      success: true,
      data: liveUsage
    });
  } catch (error: any) {
    logger.error('Failed to get live LLM usage:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-usage/stats
 * Get LLM usage statistics for a time period
 */
adminRouter.get('/stats', async (req: AdminRequest, res, next) => {
  try {
    const { startDate, endDate, userId, projectId, provider, modelId } = req.query;
    
    const options: any = {};
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (userId) options.userId = userId as string;
    if (projectId) options.projectId = projectId as string;
    if (provider) options.provider = provider as string;
    if (modelId) options.modelId = modelId as string;
    
    const stats = await usageTracker.getUsageStats(options);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get LLM usage stats:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-usage/cost-breakdown
 * Get cost breakdown by time period
 */
adminRouter.get('/cost-breakdown', async (req: AdminRequest, res, next) => {
  try {
    const period = (req.query.period as 'today' | 'week' | 'month') || 'today';
    const breakdown = await usageTracker.getCostBreakdown(period);
    
    res.json({
      success: true,
      data: breakdown
    });
  } catch (error: any) {
    logger.error('Failed to get cost breakdown:', error);
    next(error);
  }
});

/**
 * GET /api/admin/llm-usage/recent
 * Get recent LLM usage calls
 */
adminRouter.get('/recent', async (req: AdminRequest, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const { LLMUsage } = await import('../models/LLMUsage.model.js');
    
    const recentCalls = await LLMUsage.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .select('modelId provider modelIdentifier inputTokens outputTokens totalTokens totalCost timestamp success requestType agentRole taskType latencyMs');
    
    res.json({
      success: true,
      data: {
        calls: recentCalls
      }
    });
  } catch (error: any) {
    logger.error('Failed to get recent LLM usage:', error);
    next(error);
  }
});

// Mount admin router to main router
router.use(adminRouter);

// Export default router (admin routes) and user router separately
export default router;
export { userRouter };

