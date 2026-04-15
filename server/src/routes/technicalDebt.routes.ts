/**
 * Technical Debt Routes
 * API endpoints for technical debt tracking
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { technicalDebtService } from '../services/technicalDebt.service.js';
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
 * POST /api/v1/technical-debt/:projectId/identify
 * Identify technical debt
 */
router.post('/:projectId/identify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { artifactId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    logger.info(`Identifying technical debt for project: ${projectId}`);

    const debtItems = await technicalDebtService.identifyDebt(projectId, artifactId);

    res.json({
      success: true,
      data: {
        identified: debtItems.length,
        items: debtItems.map(d => ({
          id: d._id.toString(),
          category: d.category,
          severity: d.severity,
          description: d.description,
          debtScore: d.debtScore
        }))
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to identify technical debt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to identify technical debt',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * GET /api/v1/technical-debt/:projectId/report
 * Get technical debt report
 */
router.get('/:projectId/report', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    logger.info(`Getting technical debt report for project: ${projectId}`);

    const report = await technicalDebtService.generateReport(projectId);

    res.json({
      success: true,
      data: report
    });
  } catch (error: unknown) {
    logger.error('Failed to get technical debt report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get technical debt report',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * POST /api/v1/technical-debt/:debtId/resolve
 * Resolve technical debt
 */
router.post('/:debtId/resolve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { debtId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    logger.info(`Resolving technical debt: ${debtId}`);

    await technicalDebtService.resolveDebt(debtId, userId);

    res.json({
      success: true,
      message: 'Technical debt resolved'
    });
  } catch (error: unknown) {
    logger.error('Failed to resolve technical debt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve technical debt',
      error: (error instanceof Error ? error.message : String(error))
    });
  }
});

export default router;



