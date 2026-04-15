import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { ModerationQueue } from '../models/ModerationQueue.model.js';
import { Project } from '../models/Project.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';
import mongoose from 'mongoose';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

/**
 * GET /api/admin/moderation/pending
 * Get pending moderation items
 */
router.get('/pending', async (req: AdminRequest, res, next) => {
  try {
    const { page = 1, limit = 20, entityType, status = 'pending' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const query: any = { status };
    if (entityType) {
      query.entityType = entityType;
    }

    const [items, total] = await Promise.all([
      ModerationQueue.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      ModerationQueue.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/moderation/approve/:id
 * Approve content
 */
router.post('/approve/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const item = await ModerationQueue.findById(id);

    if (!item) {
      res.status(404).json({
        success: false,
        error: 'Moderation item not found'
      });
      return;
    }

    item.status = 'approved';
    item.reviewedBy = req.admin!.id;
    item.reviewedAt = new Date();
    await item.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'moderation_approve',
      entityType: item.entityType,
      details: {
        moderationId: id,
        entityId: item.entityId
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      message: 'Content approved',
      data: item
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/moderation/reject/:id
 * Reject content with reason
 */
router.post('/reject/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
      return;
    }

    const item = await ModerationQueue.findById(id);

    if (!item) {
      res.status(404).json({
        success: false,
        error: 'Moderation item not found'
      });
      return;
    }

    item.status = 'rejected';
    item.reviewedBy = req.admin!.id;
    item.reviewedAt = new Date();
    item.rejectionReason = reason;
    await item.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'moderation_reject',
      entityType: item.entityType,
      details: {
        moderationId: id,
        entityId: item.entityId,
        reason
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      message: 'Content rejected',
      data: item
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/moderation/flag/:id
 * Flag content for review
 */
router.post('/flag/:id', async (req: AdminRequest, res, next) => {
  try {
    // @ts-ignore TS6133
    const { _id } = req.params;
    const { entityType, entityId, reason, flagType = 'manual' } = req.body;

    if (!entityType || !entityId || !reason) {
      res.status(400).json({
        success: false,
        error: 'entityType, entityId, and reason are required'
      });
      return;
    }

    // Find or create moderation queue item
    let item = await ModerationQueue.findOne({
      entityType,
      entityId
    });

    if (!item) {
      item = new ModerationQueue({
        entityType,
        entityId,
        status: 'flagged',
        flaggedBy: req.admin!.id,
        flaggedReason: reason,
        autoFlagged: false
      });
    } else {
      item.status = 'flagged';
      item.flaggedBy = req.admin!.id;
      item.flaggedReason = reason;
    }

    // Add flag
    item.flags.push({
      type: flagType,
      reason,
      flaggedAt: new Date(),
      flaggedBy: req.admin!.id
    });

    await item.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'moderation_flag',
      entityType,
      details: {
        entityId,
        reason,
        flagType
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      message: 'Content flagged for review',
      data: item
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/moderation/projects
 * List projects needing moderation
 */
router.get('/projects', async (req: AdminRequest, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get projects that are flagged or pending moderation
    const moderationItems = await ModerationQueue.find({
      entityType: 'project',
      status: { $in: ['pending', 'flagged'] }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string));

    const projectIds = moderationItems.map(item => new mongoose.Types.ObjectId(item.entityId));
    const projects = await Project.find({
      _id: { $in: projectIds }
    });

    res.json({
      success: true,
      data: {
        projects: projects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          description: p.description,
          userId: p.userId,
          moderationStatus: moderationItems.find(m => m.entityId === p._id.toString())?.status
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: moderationItems.length
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/moderation/bulk-action
 * Bulk moderation actions
 */
router.post('/bulk-action', async (req: AdminRequest, res, next) => {
  try {
    const { action, itemIds, reason } = req.body;

    if (!action || !Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'action and itemIds array are required'
      });
      return;
    }

    const items = await ModerationQueue.find({
      _id: { $in: itemIds }
    });

    if (items.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No items found'
      });
      return;
    }

    const updates: any[] = [];
    for (const item of items) {
      if (action === 'approve') {
        item.status = 'approved';
        item.reviewedBy = req.admin!.id;
        item.reviewedAt = new Date();
      } else if (action === 'reject') {
        item.status = 'rejected';
        item.reviewedBy = req.admin!.id;
        item.reviewedAt = new Date();
        item.rejectionReason = reason || 'Bulk rejection';
      }
      updates.push(item.save());
    }

    await Promise.all(updates);

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: `moderation_bulk_${action}`,
      entityType: 'moderation',
      details: {
        action,
        itemIds,
        count: items.length,
        reason
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      message: `${items.length} items ${action}d`,
      data: { count: items.length }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/moderation/stats
 * Moderation statistics
 */
router.get('/stats', async (_req: AdminRequest, res, next) => {
  try {
    const [pending, approved, rejected, flagged, byType] = await Promise.all([
      ModerationQueue.countDocuments({ status: 'pending' }),
      ModerationQueue.countDocuments({ status: 'approved' }),
      ModerationQueue.countDocuments({ status: 'rejected' }),
      ModerationQueue.countDocuments({ status: 'flagged' }),
      ModerationQueue.aggregate([
        {
          $group: {
            _id: '$entityType',
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            approved: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            flagged: {
              $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          pending,
          approved,
          rejected,
          flagged,
          total: pending + approved + rejected + flagged
        },
        byType
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;




