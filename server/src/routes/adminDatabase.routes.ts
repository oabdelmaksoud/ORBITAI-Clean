import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { adminDatabaseService } from '../services/adminDatabase.service.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

/**
 * GET /api/admin/database/collections
 * List all collections in the database
 */
router.get('/collections', async (_req: AdminRequest, res, next) => {
  try {
    const collections = await adminDatabaseService.getCollections();
    res.json({
      success: true,
      data: { collections }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/database/stats/:collection
 * Get collection statistics
 */
router.get('/stats/:collection', async (req: AdminRequest, res, next) => {
  try {
    const { collection } = req.params;
    const stats = await adminDatabaseService.getCollectionStats(collection);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/database/schema/:collection
 * Get collection schema (sample document structure)
 */
router.get('/schema/:collection', async (req: AdminRequest, res, next) => {
  try {
    const { collection } = req.params;
    const schema = await adminDatabaseService.getCollectionSchema(collection);
    res.json({
      success: true,
      data: schema
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/database/query
 * Execute MongoDB query
 */
router.post('/query', async (req: AdminRequest, res, next) => {
  try {
    const { collection, query, projection, limit, skip, sort, readOnly } = req.body;

    if (!collection) {
      return res.status(400).json({
        success: false,
        error: 'Collection name is required'
      });
    }

    const result = await adminDatabaseService.executeQuery(
      {
        collection,
        query: query || {},
        projection,
        limit,
        skip,
        sort,
        readOnly
      },
      req.admin!.id,
      req.admin!.email
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/database/update
 * Update database records
 */
router.post('/update', async (req: AdminRequest, res, next) => {
  try {
    const { collection, filter, update, options } = req.body;

    if (!collection || !filter || !update) {
      return res.status(400).json({
        success: false,
        error: 'Collection, filter, and update are required'
      });
    }

    const result = await adminDatabaseService.updateRecords(
      {
        collection,
        filter,
        update,
        options
      },
      req.admin!.id,
      req.admin!.email
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/database/delete
 * Delete database records
 */
router.post('/delete', async (req: AdminRequest, res, next) => {
  try {
    const { collection, filter, limit } = req.body;

    if (!collection || !filter) {
      return res.status(400).json({
        success: false,
        error: 'Collection and filter are required'
      });
    }

    const result = await adminDatabaseService.deleteRecords(
      {
        collection,
        filter,
        limit
      },
      req.admin!.id,
      req.admin!.email
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/database/backup-collection
 * Backup a collection
 */
router.post('/backup-collection', async (req: AdminRequest, res, next) => {
  try {
    const { collection } = req.body;

    if (!collection) {
      return res.status(400).json({
        success: false,
        error: 'Collection name is required'
      });
    }

    const backup = await adminDatabaseService.backupCollection(
      collection,
      req.admin!.id
    );

    res.json({
      success: true,
      data: backup
    });
  } catch (error) {
    next(error);
  }
});

export default router;




