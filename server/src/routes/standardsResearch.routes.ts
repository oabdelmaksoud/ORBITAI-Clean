/**
 * Standards Research Routes
 * API endpoints for researching standards using internet search
 */

import express from 'express';
import { standardsResearchService } from '../services/standardsResearch.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize standards research service
 * POST /api/standards-research/initialize
 */
router.post('/initialize', async (req, res, _next) => {
  try {
    await standardsResearchService.initialize();
    res.json({
      success: true,
      message: 'Standards research service initialized',
    });
  } catch (error: unknown) {
    logger.error('Standards research initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize standards research service',
      error: error.message,
    });
  }
});

/**
 * Research a standard
 * POST /api/standards-research/research
 */
router.post('/research', async (req, res, _next) => {
  try {
    const {
      standardId,
      standardName,
      researchType,
      context,
      projectType,
      industry,
    } = req.body;

    if (!standardId && !standardName) {
      res.status(400).json({
        success: false,
        message: 'standardId or standardName is required',
      });
      return;
    }

    const result = await standardsResearchService.researchStandard({
      standardId,
      standardName,
      researchType: researchType || 'general',
      context,
      projectType,
      industry,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Standards research failed:', error);
    res.status(500).json({
      success: false,
      message: 'Standards research failed',
      error: error.message,
    });
  }
});

/**
 * Research audit procedures
 * POST /api/standards-research/audit
 */
router.post('/audit', async (req, res, _next) => {
  try {
    const {
      standardId,
      standardName,
      projectType,
      industry,
      projectDescription,
    } = req.body;

    if (!standardId && !standardName) {
      res.status(400).json({
        success: false,
        message: 'standardId or standardName is required',
      });
      return;
    }

    const result = await standardsResearchService.researchAuditProcedures(
      standardId || '',
      standardName || '',
      {
        projectType,
        industry,
        projectDescription,
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Audit research failed:', error);
    res.status(500).json({
      success: false,
      message: 'Audit research failed',
      error: error.message,
    });
  }
});

/**
 * Research compliance criteria
 * POST /api/standards-research/compliance
 */
router.post('/compliance', async (req, res, _next) => {
  try {
    const {
      standardId,
      standardName,
      projectType,
      industry,
      projectDescription,
    } = req.body;

    if (!standardId && !standardName) {
      res.status(400).json({
        success: false,
        message: 'standardId or standardName is required',
      });
      return;
    }

    const result = await standardsResearchService.researchComplianceCriteria(
      standardId || '',
      standardName || '',
      {
        projectType,
        industry,
        projectDescription,
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Compliance research failed:', error);
    res.status(500).json({
      success: false,
      message: 'Compliance research failed',
      error: error.message,
    });
  }
});

/**
 * Research evaluation methods
 * POST /api/standards-research/evaluation
 */
router.post('/evaluation', async (req, res, _next) => {
  try {
    const {
      standardId,
      standardName,
      projectType,
      industry,
      projectDescription,
    } = req.body;

    if (!standardId && !standardName) {
      res.status(400).json({
        success: false,
        message: 'standardId or standardName is required',
      });
      return;
    }

    const result = await standardsResearchService.researchEvaluationMethods(
      standardId || '',
      standardName || '',
      {
        projectType,
        industry,
        projectDescription,
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Evaluation research failed:', error);
    res.status(500).json({
      success: false,
      message: 'Evaluation research failed',
      error: error.message,
    });
  }
});

/**
 * Get comprehensive audit research
 * POST /api/standards-research/comprehensive
 */
router.post('/comprehensive', async (req, res, _next) => {
  try {
    const {
      standardId,
      standardName,
      projectType,
      industry,
      projectDescription,
    } = req.body;

    if (!standardId && !standardName) {
      res.status(400).json({
        success: false,
        message: 'standardId or standardName is required',
      });
      return;
    }

    const result = await standardsResearchService.getComprehensiveAuditResearch(
      standardId || '',
      standardName || '',
      {
        projectType,
        industry,
        projectDescription,
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Comprehensive research failed:', error);
    res.status(500).json({
      success: false,
      message: 'Comprehensive research failed',
      error: error.message,
    });
  }
});

export default router;
















