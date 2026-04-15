/**
 * NLP Routes
 * API endpoints for natural language processing features
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { nlpService } from '../services/nlp.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/nlp/summarize
 * Summarize content
 */
router.post('/summarize', async (req: AdminRequest, res, next) => {
  try {
    const { content, maxLength } = req.body;

    if (!content || typeof content !== 'string') {
      throw new AppError('Content is required', 400);
    }

    const summary = await nlpService.summarize(content, maxLength || 200);

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/nlp/keywords
 * Extract keywords
 */
router.post('/keywords', async (req: AdminRequest, res, next) => {
  try {
    const { content, maxKeywords } = req.body;

    if (!content || typeof content !== 'string') {
      throw new AppError('Content is required', 400);
    }

    const keywords = await nlpService.extractKeywords(content, maxKeywords || 10);

    res.json({
      success: true,
      data: { keywords }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/nlp/entities
 * Extract entities
 */
router.post('/entities', async (req: AdminRequest, res, next) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      throw new AppError('Content is required', 400);
    }

    const entities = await nlpService.extractEntities(content);

    res.json({
      success: true,
      data: { entities }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/nlp/sentiment
 * Analyze sentiment
 */
router.post('/sentiment', async (req: AdminRequest, res, next) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      throw new AppError('Content is required', 400);
    }

    const sentiment = await nlpService.analyzeSentiment(content);

    res.json({
      success: true,
      data: { sentiment }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/nlp/analyze
 * Comprehensive content analysis
 */
router.post('/analyze', async (req: AdminRequest, res, next) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      throw new AppError('Content is required', 400);
    }

    const analysis = await nlpService.analyzeContent(content);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















