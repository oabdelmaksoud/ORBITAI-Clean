/**
 * Community Sharing Routes
 * API endpoints for marketplace and sharing
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { communitySharingService } from '../services/communitySharing.service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/community/publish
 * Publish improvement to marketplace
 */
router.post('/publish', async (req: AdminRequest, res, next) => {
  try {
    const { improvementId, license, organizationId } = req.body;

    if (!improvementId) {
      throw new AppError('Improvement ID is required', 400);
    }

    const listing = await communitySharingService.publishToMarketplace(
      improvementId,
      req.user!.id,
      { license, organizationId }
    );

    res.status(201).json({
      success: true,
      data: listing
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/community/marketplace
 * Search marketplace
 */
router.get('/marketplace', async (req: AdminRequest, res, next) => {
  try {
    const { query, category, minRating, tags, limit, offset } = req.query;

    const result = await communitySharingService.searchMarketplace({
      query: query as string,
      category: category as string,
      minRating: minRating ? parseFloat(minRating as string) : undefined,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/community/rate
 * Rate an improvement
 */
router.post('/rate', async (req: AdminRequest, res, next) => {
  try {
    const { listingId, rating, comment } = req.body;

    if (!listingId || !rating) {
      throw new AppError('Listing ID and rating are required', 400);
    }

    await communitySharingService.rateImprovement(listingId, req.user!.id, rating, comment);

    res.json({
      success: true,
      message: 'Rating submitted'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/community/fork
 * Fork an improvement
 */
router.post('/fork', async (req: AdminRequest, res, next) => {
  try {
    const { listingId, customizations } = req.body;

    if (!listingId) {
      throw new AppError('Listing ID is required', 400);
    }

    const result = await communitySharingService.forkImprovement(
      listingId,
      req.user!.id,
      customizations || {}
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/community/import
 * Import from marketplace
 */
router.post('/import', async (req: AdminRequest, res, next) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      throw new AppError('Listing ID is required', 400);
    }

    const importedId = await communitySharingService.importFromMarketplace(listingId, req.user!.id);

    res.json({
      success: true,
      data: { improvementId: importedId }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/community/stats
 * Get marketplace statistics
 */
router.get('/stats', async (_req: AdminRequest, res, next) => {
  try {
    const stats = await communitySharingService.getMarketplaceStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















