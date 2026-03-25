import express from 'express';
import { Notification } from '../models/Notification.model.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/notifications
 * Get notifications for the current admin user
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const userId = req.admin?.id || req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    const query: any = {
      $or: [
        { userId: userId }, // User-specific notifications
        { userId: null }    // System-wide notifications
      ]
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({
      ...query,
      isRead: false
    });

    res.json({
      success: true,
      data: {
        notifications: notifications.map(n => ({
          id: n._id.toString(),
          title: n.title,
          message: n.message,
          type: n.type,
          category: n.category,
          isRead: n.isRead,
          link: n.link,
          metadata: n.metadata,
          createdAt: n.createdAt
        })),
        unreadCount
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', async (req: AdminRequest, res, next) => {
  try {
    const userId = req.admin?.id || req.user?.id;

    const count = await Notification.countDocuments({
      $or: [
        { userId: userId },
        { userId: null }
      ],
      isRead: false
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', async (req: AdminRequest, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', async (req: AdminRequest, res, next) => {
  try {
    const userId = req.admin?.id || req.user?.id;

    await Notification.updateMany(
      {
        $or: [
          { userId: userId },
          { userId: null }
        ],
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/admin/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req: AdminRequest, res, next) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
















