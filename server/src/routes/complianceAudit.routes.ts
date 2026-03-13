/**
 * Compliance & Audit Routes
 * API endpoints for compliance checking and audits
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { complianceAuditService } from '../services/complianceAudit.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/compliance/check
 * Check compliance against standards
 */
router.post('/check', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, standardIds } = req.body;

    if (!improvementId) {
      throw new AppError('Improvement ID is required', 400);
    }

    const report = await complianceAuditService.checkCompliance(improvementId, standardIds);

    res.json({
      success: true,
      data: report
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/compliance/schedule
 * Schedule automated audit
 */
router.post('/schedule', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, frequency } = req.body;

    if (!improvementId || !frequency) {
      throw new AppError('Improvement ID and frequency are required', 400);
    }

    const schedule = await complianceAuditService.scheduleAudit(improvementId, frequency);

    res.json({
      success: true,
      data: schedule
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/compliance/regulations/:id
 * Map process to regulations
 */
router.get('/regulations/:id', async (req: AdminRequest, res, next) => {
  try {
    const mappings = await complianceAuditService.mapToRegulations(req.params.id);

    res.json({
      success: true,
      data: mappings
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















