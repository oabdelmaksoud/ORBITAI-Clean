/**
 * Quota Management Routes
 * API endpoints for managing usage quotas
 */

import express, { Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { quotaEnforcementService } from '../services/quotaEnforcement.service.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/llm-router/quotas
 * Get all quotas
 */
router.get('/', async (_req: AdminRequest, res: Response) => {
  try {
    const quotas = await quotaEnforcementService.getAllQuotas();
    
    res.json({
      success: true,
      data: quotas
    });
  } catch (error: unknown) {
    logger.error('Failed to get quotas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quotas',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * GET /api/admin/llm-router/quotas/:quotaId
 * Get a specific quota
 */
router.get('/:quotaId', async (req: AdminRequest, res: Response) => {
  try {
    const { quotaId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(quotaId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
      return;
    }
    
    const quota = await quotaEnforcementService.getQuota('user', quotaId);
    
    if (!quota) {
      // Try project and global
      const projectQuota = await quotaEnforcementService.getQuota('project', quotaId);
      if (projectQuota) {
        res.json({
          success: true,
          data: projectQuota
        });
        return;
      }
      
      const globalQuota = await quotaEnforcementService.getQuota('global');
      if (globalQuota && globalQuota._id.toString() === quotaId) {
        res.json({
          success: true,
          data: globalQuota
        });
        return;
      }
      
      res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: quota
    });
  } catch (error: unknown) {
    logger.error(`Failed to get quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quota',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * POST /api/admin/llm-router/quotas
 * Create or update a quota
 */
router.post('/', async (req: AdminRequest, res: Response) => {
  try {
    const { targetType, targetId, ...quotaData } = req.body;
    
    if (!targetType || !['user', 'project', 'global'].includes(targetType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid targetType. Must be "user", "project", or "global"'
      });
      return;
    }
    
    if (targetType !== 'global' && !targetId) {
      res.status(400).json({
        success: false,
        message: 'targetId is required for user and project quotas'
      });
      return;
    }
    
    const quota = await quotaEnforcementService.upsertQuota(
      targetType,
      targetId,
      quotaData
    );
    
    res.status(201).json({
      success: true,
      data: quota,
      message: 'Quota created/updated successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to create/update quota:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update quota',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * PUT /api/admin/llm-router/quotas/:quotaId
 * Update a quota
 */
router.put('/:quotaId', async (req: AdminRequest, res: Response) => {
  try {
    const { quotaId } = req.params;
    const updates = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(quotaId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
      return;
    }
    
    // First, find the quota to get its targetType and targetId
    const quotas = await quotaEnforcementService.getAllQuotas();
    const quota = quotas.find(q => q._id.toString() === quotaId);
    
    if (!quota) {
      res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
      return;
    }
    
    const updated = await quotaEnforcementService.upsertQuota(
      quota.targetType,
      quota.targetId,
      updates
    );
    
    res.json({
      success: true,
      data: updated,
      message: 'Quota updated successfully'
    });
  } catch (error: unknown) {
    logger.error(`Failed to update quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quota',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * DELETE /api/admin/llm-router/quotas/:quotaId
 * Delete a quota
 */
router.delete('/:quotaId', async (req: AdminRequest, res: Response) => {
  try {
    const { quotaId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(quotaId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
      return;
    }
    
    const deleted = await quotaEnforcementService.deleteQuota(quotaId);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Quota deleted successfully'
    });
  } catch (error: unknown) {
    logger.error(`Failed to delete quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quota',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * POST /api/admin/llm-router/quotas/:quotaId/reset
 * Reset usage for a quota
 */
router.post('/:quotaId/reset', async (req: AdminRequest, res: Response) => {
  try {
    const { quotaId } = req.params;
    const { period } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(quotaId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
      return;
    }
    
    const validPeriods = ['daily', 'weekly', 'monthly', 'all'];
    const resetPeriod = period && validPeriods.includes(period) ? period : 'all';
    
    await quotaEnforcementService.resetUsage(quotaId, resetPeriod as 'daily' | 'weekly' | 'monthly' | 'all');
    
    res.json({
      success: true,
      message: `Quota usage reset for ${resetPeriod} period`
    });
  } catch (error: unknown) {
    logger.error(`Failed to reset quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset quota usage',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * GET /api/admin/llm-router/quotas/target/:targetType/:targetId
 * Get quota for a specific target
 */
router.get('/target/:targetType/:targetId', async (req: AdminRequest, res: Response) => {
  try {
    const { targetType, targetId } = req.params;
    
    if (!['user', 'project', 'global'].includes(targetType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid targetType. Must be "user", "project", or "global"'
      });
      return;
    }
    
    const quota = await quotaEnforcementService.getQuota(
      targetType as 'user' | 'project' | 'global',
      targetType === 'global' ? undefined : targetId
    );
    
    if (!quota) {
      res.status(404).json({
        success: false,
        message: 'Quota not found for this target'
      });
      return;
    }
    
    res.json({
      success: true,
      data: quota
    });
  } catch (error: unknown) {
    logger.error(`Failed to get quota for ${req.params.targetType}:${req.params.targetId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quota',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

export default router;


