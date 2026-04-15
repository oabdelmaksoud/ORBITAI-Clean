/**
 * Compliance Routes
 * API endpoints for compliance checklist management
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { complianceChecklistService } from '../services/complianceChecklist.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * POST /api/v1/compliance/:projectId/:standard/generate
 * Generate compliance checklist
 */
router.post('/:projectId/:standard/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, standard } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const validStandards = ['gdpr', 'hipaa', 'soc2', 'pci_dss', 'iso27001'];
    if (!validStandards.includes(standard)) {
      res.status(400).json({
        success: false,
        message: `Invalid standard. Must be one of: ${validStandards.join(', ')}`
      });
      return;
    }

    logger.info(`Generating ${standard} compliance checklist for project: ${projectId}`);

    const checklist = await complianceChecklistService.generateChecklist(
      projectId,
      standard as any
    );

    res.json({
      success: true,
      data: checklist
    });
  } catch (error: unknown) {
    logger.error('Failed to generate compliance checklist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate compliance checklist',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * GET /api/v1/compliance/:projectId/:standard/validate
 * Validate compliance
 */
router.get('/:projectId/:standard/validate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, standard } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    logger.info(`Validating ${standard} compliance for project: ${projectId}`);

    const report = await complianceChecklistService.validateCompliance(
      projectId,
      standard as any
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error: unknown) {
    logger.error('Failed to validate compliance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate compliance',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

export default router;



