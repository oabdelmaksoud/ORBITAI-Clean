import express from 'express';
import { ActivityEvent } from '../models/ActivityEvent.model.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { sanitizePagination } from '../middleware/validate.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/activity
 * Get activity events (real-time feed)
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const { limit } = sanitizePagination(req.query);
    const type = req.query.type as string;
    const userId = req.query.userId as string;
    const entityType = req.query.entityType as string;
    const since = req.query.since as string; // ISO timestamp

    const query: any = {};

    if (type) query.type = type;
    if (userId) query.userId = userId;
    if (entityType) query.entityType = entityType;
    if (since) {
      query.timestamp = { $gte: new Date(since) };
    }

    const events = await ActivityEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: {
        events: events.map(e => ({
          id: e._id.toString(),
          type: e.type,
          userId: e.userId,
          userEmail: e.userEmail,
          entityType: e.entityType,
          entityId: e.entityId,
          details: e.details,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
          location: e.location,
          timestamp: e.timestamp
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/activity/stats
 * Get activity statistics
 */
router.get('/stats', async (req: AdminRequest, res, next) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [last24h, last7d, last30d, byType, byEntityType, topUsers, topIPs] = await Promise.all([
      ActivityEvent.countDocuments({ timestamp: { $gte: last24Hours } }),
      ActivityEvent.countDocuments({ timestamp: { $gte: last7Days } }),
      ActivityEvent.countDocuments({ timestamp: { $gte: last30Days } }),
      ActivityEvent.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      ActivityEvent.aggregate([
        { $match: { entityType: { $exists: true } } },
        { $group: { _id: '$entityType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      ActivityEvent.aggregate([
        { $match: { userId: { $exists: true } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      ActivityEvent.aggregate([
        { $match: { ipAddress: { $exists: true } } },
        { $group: { _id: '$ipAddress', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        last24Hours: last24h,
        last7Days: last7d,
        last30Days: last30d,
        byType: byType.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byEntityType: byEntityType.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topUsers: topUsers.map((item: any) => ({
          userId: item._id,
          count: item.count
        })),
        topIPs: topIPs.map((item: any) => ({
          ipAddress: item._id,
          count: item.count
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
















