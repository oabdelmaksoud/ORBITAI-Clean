import express, { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { MaturityAssessmentService } from '../services/maturityAssessment.service.js';
import { logger } from '../utils/logger.js';

const router = Router();
const maturityAssessmentService = new MaturityAssessmentService();

/**
 * POST /api/maturity-assessment/analyze
 * Generate AI-powered maturity assessment
 */
router.post('/analyze', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const {
      projectName,
      projectDescription,
      conversationMessages,
      projectPreview,
      artifacts,
      selectedStandards,
      useInternet,
      hasResearchFindings
    } = req.body;

    const assessment = await maturityAssessmentService.generateAIAssessment({
      projectName,
      projectDescription,
      conversationMessages,
      projectPreview,
      artifacts,
      selectedStandards,
      useInternet,
      hasResearchFindings
    });

    res.json({
      success: true,
      data: { assessment }
    });
  } catch (error: unknown) {
    logger.error('[Maturity Assessment] Route error:', error);
    next(error);
  }
});

export default router;


