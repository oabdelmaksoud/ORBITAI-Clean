/**
 * Quality Standards Routes
 * API endpoints for standards matching and auto-enrollment
 */

import express from 'express';
import { standardsMatchingService } from '../services/standardsMatching.service.js';
import { QualityStandard } from '../models/QualityStandard.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize standards matching service
 * POST /api/standards/initialize
 */
router.post('/initialize', async (req, res, next) => {
  try {
    await standardsMatchingService.initialize();
    res.json({
      success: true,
      message: 'Standards matching service initialized',
    });
  } catch (error: any) {
    logger.error('Standards initialization failed:', error);
    next(error);
  }
});

/**
 * Find matching standards for a project
 * POST /api/standards/match
 */
router.post('/match', async (req, res, next) => {
  try {
    const {
      name,
      description,
      methodology,
      category,
      projectType,
      industry,
      region,
      tags,
      maxResults,
      minScore,
      includeOptional,
    } = req.body;

    if (!name || !description) {
      res.status(400).json({
        success: false,
        message: 'name and description are required',
      });
      return;
    }

    const recommendation = await standardsMatchingService.findMatchingStandards(
      {
        name,
        description,
        methodology,
        category,
        projectType,
        industry,
        region,
        tags,
      },
      {
        maxResults: maxResults || 10,
        minScore: minScore || 0.3,
        includeOptional: includeOptional ?? true,
      }
    );

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error: any) {
    logger.error('Standards matching failed:', error);
    next(error);
  }
});

/**
 * Auto-enroll standards for a project
 * POST /api/standards/auto-enroll
 */
router.post('/auto-enroll', async (req, res, next) => {
  try {
    const {
      name,
      description,
      methodology,
      category,
      projectType,
      industry,
      region,
      tags,
      autoEnrollRequired,
      autoEnrollRecommended,
      maxStandards,
    } = req.body;

    if (!name || !description) {
      res.status(400).json({
        success: false,
        message: 'name and description are required',
      });
      return;
    }

    const enrolled = await standardsMatchingService.autoEnrollStandards(
      {
        name,
        description,
        methodology,
        category,
        projectType,
        industry,
        region,
        tags,
      },
      {
        autoEnrollRequired: autoEnrollRequired ?? true,
        autoEnrollRecommended: autoEnrollRecommended ?? true,
        maxStandards: maxStandards || 5,
      }
    );

    res.json({
      success: true,
      data: {
        enrolledStandards: enrolled,
        count: enrolled.length,
      },
    });
  } catch (error: any) {
    logger.error('Auto-enrollment failed:', error);
    next(error);
  }
});

/**
 * Search for standards
 * POST /api/standards/search
 */
router.post('/search', async (req, res, next) => {
  try {
    const { query, filters } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'query is required',
      });
      return;
    }

    const matches = await standardsMatchingService.searchStandards(query, filters);

    res.json({
      success: true,
      data: matches,
    });
  } catch (error: any) {
    logger.error('Standards search failed:', error);
    next(error);
  }
});

/**
 * Get all standards
 * GET /api/standards
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, projectType, industry, complianceLevel, isActive } = req.query;

    const query: any = {};

    if (category) {
      query.category = { $in: Array.isArray(category) ? category : [category] };
    }
    if (projectType) {
      query.projectTypes = { $in: Array.isArray(projectType) ? projectType : [projectType] };
    }
    if (industry) {
      query.industries = { $in: Array.isArray(industry) ? industry : [industry] };
    }
    if (complianceLevel) {
      query.complianceLevel = complianceLevel;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    } else {
      query.isActive = true; // Default to active only
    }

    const standards = await QualityStandard.find(query).sort({ name: 1 }).exec();

    res.json({
      success: true,
      data: standards,
      count: standards.length,
    });
  } catch (error: any) {
    logger.error('Failed to get standards:', error);
    next(error);
  }
});

/**
 * Get standard by ID
 * GET /api/standards/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const standard = await QualityStandard.findOne({ id }).exec();

    if (!standard) {
      res.status(404).json({
        success: false,
        message: 'Standard not found',
      });
      return;
    }

    res.json({
      success: true,
      data: standard,
    });
  } catch (error: any) {
    logger.error('Failed to get standard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get standard',
      error: error.message,
    });
  }
});

export default router;
















