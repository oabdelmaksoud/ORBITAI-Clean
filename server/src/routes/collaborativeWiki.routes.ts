/**
 * Collaborative Wiki Routes
 * API endpoints for collaborative document management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { collaborativeWikiService } from '../services/collaborativeWiki.service.js';
import { CollaborativeDocument } from '../models/CollaborativeDocument.model.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/collaborative-wiki
 * List all documents
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const { status, category, search } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      filter.$text = { $search: search as string };
    }

    const documents = await CollaborativeDocument.find(filter)
      .sort({ 'statistics.views': -1, updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: documents
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/collaborative-wiki/:id
 * Get specific document
 */
router.get('/:id', async (req: AdminRequest, res, next) => {
  try {
    const document = await CollaborativeDocument.findOne({ id: req.params.id });
    
    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Update view statistics
    document.statistics.views += 1;
    document.statistics.lastViewed = new Date();
    await document.save();

    res.json({
      success: true,
      data: document
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/collaborative-wiki
 * Create new document
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const { title, content, contentType } = req.body;

    if (!title || !content) {
      throw new AppError('Title and content are required', 400);
    }

    const document = await collaborativeWikiService.createDocument(
      title,
      content,
      contentType || 'markdown',
      req.user!.id,
      req.user!.name || 'Admin'
    );

    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/collaborative-wiki/:id
 * Update document
 */
router.put('/:id', async (req: AdminRequest, res, next) => {
  try {
    const { content, changeSummary } = req.body;

    if (!content) {
      throw new AppError('Content is required', 400);
    }

    const document = await collaborativeWikiService.updateDocument(
      req.params.id,
      content,
      req.user!.id,
      req.user!.name || 'Admin',
      changeSummary
    );

    res.json({
      success: true,
      data: document
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/collaborative-wiki/:id/comments
 * Add comment
 */
router.post('/:id/comments', async (req: AdminRequest, res, next) => {
  try {
    const { content, position } = req.body;

    if (!content) {
      throw new AppError('Comment content is required', 400);
    }

    const comment = await collaborativeWikiService.addComment(
      req.params.id,
      req.user!.id,
      req.user!.name || 'Admin',
      content,
      position
    );

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/collaborative-wiki/:id/comments/:commentId/reply
 * Reply to comment
 */
router.post('/:id/comments/:commentId/reply', async (req: AdminRequest, res, next) => {
  try {
    const { content } = req.body;

    if (!content) {
      throw new AppError('Reply content is required', 400);
    }

    await collaborativeWikiService.replyToComment(
      req.params.id,
      req.params.commentId,
      req.user!.id,
      req.user!.name || 'Admin',
      content
    );

    res.json({
      success: true,
      message: 'Reply added'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/collaborative-wiki/:id/versions/:version
 * Get document version
 */
router.get('/:id/versions/:version', async (req: AdminRequest, res, next) => {
  try {
    const version = parseInt(req.params.version);
    const content = await collaborativeWikiService.getDocumentVersion(req.params.id, version);

    if (!content) {
      throw new AppError('Version not found', 404);
    }

    res.json({
      success: true,
      data: { version, content }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/collaborative-wiki/:id/compare
 * Compare versions
 */
router.get('/:id/compare', async (req: AdminRequest, res, next) => {
  try {
    const { version1, version2 } = req.query;

    if (!version1 || !version2) {
      throw new AppError('Both version1 and version2 are required', 400);
    }

    const comparison = await collaborativeWikiService.compareVersions(
      req.params.id,
      parseInt(version1 as string),
      parseInt(version2 as string)
    );

    res.json({
      success: true,
      data: comparison
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/collaborative-wiki/:id/lock
 * Lock document
 */
router.post('/:id/lock', async (req: AdminRequest, res, next) => {
  try {
    await collaborativeWikiService.lockDocument(req.params.id, req.user!.id);

    res.json({
      success: true,
      message: 'Document locked'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/collaborative-wiki/:id/unlock
 * Unlock document
 */
router.post('/:id/unlock', async (req: AdminRequest, res, next) => {
  try {
    await collaborativeWikiService.unlockDocument(req.params.id, req.user!.id);

    res.json({
      success: true,
      message: 'Document unlocked'
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
















