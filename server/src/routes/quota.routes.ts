/**
 * Quota Management Routes
 * API endpoints for managing usage quotas
 */

import express, { Request, Response } from 'express';
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
router.get('/', async (req: AdminRequest, res: Response) => {
  try {
    const quotas = await quotaEnforcementService.getAllQuotas();
    
    res.json({
      success: true,
      data: quotas
    });
  } catch (error: any) {
    logger.error('Failed to get quotas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quotas',
      error: error.message
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
      return res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
    }
    
    const quota = await quotaEnforcementService.getQuota('user', quotaId);
    
    if (!quota) {
      // Try project and global
      const projectQuota = await quotaEnforcementService.getQuota('project', quotaId);
      if (projectQuota) {
        return res.json({
          success: true,
          data: projectQuota
        });
      }
      
      const globalQuota = await quotaEnforcementService.getQuota('global');
      if (globalQuota && globalQuota._id.toString() === quotaId) {
        return res.json({
          success: true,
          data: globalQuota
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
    }
    
    res.json({
      success: true,
      data: quota
    });
  } catch (error: any) {
    logger.error(`Failed to get quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quota',
      error: error.message
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
      return res.status(400).json({
        success: false,
        message: 'Invalid targetType. Must be "user", "project", or "global"'
      });
    }
    
    if (targetType !== 'global' && !targetId) {
      return res.status(400).json({
        success: false,
        message: 'targetId is required for user and project quotas'
      });
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
  } catch (error: any) {
    logger.error('Failed to create/update quota:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update quota',
      error: error.message
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
      return res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
    }
    
    // First, find the quota to get its targetType and targetId
    const quotas = await quotaEnforcementService.getAllQuotas();
    const quota = quotas.find(q => q._id.toString() === quotaId);
    
    if (!quota) {
      return res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
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
  } catch (error: any) {
    logger.error(`Failed to update quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quota',
      error: error.message
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
      return res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
    }
    
    const deleted = await quotaEnforcementService.deleteQuota(quotaId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Quota not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Quota deleted successfully'
    });
  } catch (error: any) {
    logger.error(`Failed to delete quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quota',
      error: error.message
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
      return res.status(400).json({
        success: false,
        message: 'Invalid quota ID'
      });
    }
    
    const validPeriods = ['daily', 'weekly', 'monthly', 'all'];
    const resetPeriod = period && validPeriods.includes(period) ? period : 'all';
    
    await quotaEnforcementService.resetUsage(quotaId, resetPeriod as 'daily' | 'weekly' | 'monthly' | 'all');
    
    res.json({
      success: true,
      message: `Quota usage reset for ${resetPeriod} period`
    });
  } catch (error: any) {
    logger.error(`Failed to reset quota ${req.params.quotaId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset quota usage',
      error: error.message
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
      return res.status(400).json({
        success: false,
        message: 'Invalid targetType. Must be "user", "project", or "global"'
      });
    }
    
    const quota = await quotaEnforcementService.getQuota(
      targetType as 'user' | 'project' | 'global',
      targetType === 'global' ? undefined : targetId
    );
    
    if (!quota) {
      return res.status(404).json({
        success: false,
        message: 'Quota not found for this target'
      });
    }
    
    res.json({
      success: true,
      data: quota
    });
  } catch (error: any) {
    logger.error(`Failed to get quota for ${req.params.targetType}:${req.params.targetId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quota',
      error: error.message
    });
  }
});

export default router;


