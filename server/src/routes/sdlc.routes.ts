/**
 * SDLC Methodology Routes
 * API endpoints for SDLC methodology recommendation and sprint estimation
 */

import express from 'express';
import { sdlcMatchingService } from '../services/sdlcMatching.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize SDLC matching service
 * POST /api/sdlc/initialize
 */
router.post('/initialize', async (req, res, next) => {
  try {
    await sdlcMatchingService.initialize();
    res.json({
      success: true,
      message: 'SDLC matching service initialized',
    });
  } catch (error: any) {
    logger.error('SDLC initialization failed:', error);
    next(error);
  }
});

/**
 * Recommend SDLC methodology
 * POST /api/sdlc/recommend
 */
router.post('/recommend', async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      projectType,
      industry,
      standards,
      complexity,
      teamSize,
      timeline,
      requirements,
    } = req.body;

    if (!name || !description) {
      res.status(400).json({
        success: false,
        message: 'name and description are required',
      });
      return;
    }

    const recommendation = await sdlcMatchingService.recommendMethodology({
      name,
      description,
      category,
      projectType,
      industry,
      standards,
      complexity,
      teamSize,
      timeline,
      requirements,
    });

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error: any) {
    logger.error('SDLC recommendation failed:', error);
    next(error);
  }
});

/**
 * Estimate sprint count
 * POST /api/sdlc/estimate-sprints
 */
router.post('/estimate-sprints', async (req, res, next) => {
  try {
    const {
      methodology,
      name,
      description,
      category,
      projectType,
      industry,
      complexity,
      teamSize,
      timeline,
      requirements,
    } = req.body;

    if (!methodology) {
      res.status(400).json({
        success: false,
        message: 'methodology is required',
      });
      return;
    }

    const metadata = sdlcMatchingService.extractProjectMetadata({
      name: name || '',
      description: description || '',
      category,
      projectType,
      industry,
      complexity,
      teamSize,
      timeline,
      requirements,
    });

    const estimation = await sdlcMatchingService.estimateSprints(
      methodology,
      metadata,
      {
        name: name || '',
        description: description || '',
        category,
        projectType,
        industry,
        complexity,
        teamSize,
        timeline,
        requirements,
      }
    );

    res.json({
      success: true,
      data: estimation,
    });
  } catch (error: any) {
    logger.error('Sprint estimation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Sprint estimation failed',
      error: error.message,
    });
  }
});

/**
 * Auto-configure SDLC
 * POST /api/sdlc/auto-configure
 */
router.post('/auto-configure', async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      projectType,
      industry,
      standards,
      complexity,
      teamSize,
      timeline,
      requirements,
    } = req.body;

    if (!name || !description) {
      res.status(400).json({
        success: false,
        message: 'name and description are required',
      });
      return;
    }

    const config = await sdlcMatchingService.autoConfigureSDLC({
      name,
      description,
      category,
      projectType,
      industry,
      standards,
      complexity,
      teamSize,
      timeline,
      requirements,
    });

    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    logger.error('SDLC auto-configuration failed:', error);
    res.status(500).json({
      success: false,
      message: 'SDLC auto-configuration failed',
      error: error.message,
    });
  }
});

export default router;

