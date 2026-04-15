import { Router } from 'express';
import { Notification } from '../models/Notification.model';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger.js';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

/**
 * GET /api/notifications
 * Get user's notifications
 */
router.get('/', async (req, res) => {
  try {
    const userId = ((req as any).user)._id;
    const { read, type, limit, page } = req.query;

    const options: any = {};
    
    if (read !== undefined) {
      options.read = read === 'true';
    }
    
    if (type) {
      options.type = type as string;
    }
    
    options.limit = parseInt(limit as string) || 20;
    options.skip = (parseInt(page as string) || 0) * options.limit;

    const notifications = await ((Notification as any).getNotifications)(userId, options);
    const totalCount = await Notification.countDocuments({ user: userId });
    const unreadCount = await ((Notification as any).getUnreadCount)(userId);

    res.json({
      notifications,
      totalCount,
      unreadCount,
      page: parseInt(page as string) || 0,
      limit: options.limit
    });
  } catch (error: any) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to get notifications' });
  }
});

/**
 * GET /api/notifications/unread
 * Get unread notification count
 */
router.get('/unread', async (req, res) => {
  try {
    const userId = ((req as any).user)._id;
    const count = await ((Notification as any).getUnreadCount)(userId);

    res.json({ count });
  } catch (error: any) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ error: error.message || 'Failed to get unread count' });
  }
});

/**
 * GET /api/notifications/:id
 * Get notification details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = ((req as any).user)._id;

    const notification = await Notification.findById(id)
      .populate('data.actor', 'name avatar')
      .populate('data.workspace', 'name slug')
      .populate('data.project', 'name');

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    // Check if notification belongs to user
    if (!notification.user.equals(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(notification);
  } catch (error: any) {
    logger.error('Get notification error:', error);
    res.status(500).json({ error: error.message || 'Failed to get notification' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = ((req as any).user)._id;

    const notification = await Notification.findById(id);

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    // Check if notification belongs to user
    if (!notification.user.equals(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await ((notification as any).markAsRead)();

    res.json(notification);
  } catch (error: any) {
    logger.error('Mark as read error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark as read' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', async (req, res) => {
  try {
    const userId = ((req as any).user)._id;

    const result = await ((Notification as any).markAllAsRead)(userId);

    res.json({ 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error: any) {
    logger.error('Mark all as read error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = ((req as any).user)._id;

    const notification = await Notification.findById(id);

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    // Check if notification belongs to user
    if (!notification.user.equals(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await notification.deleteOne();

    res.json({ message: 'Notification deleted successfully' });
  } catch (error: any) {
    logger.error('Delete notification error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete notification' });
  }
});

/**
 * DELETE /api/notifications
 * Delete all read notifications
 */
router.delete('/', async (req, res) => {
  try {
    const userId = ((req as any).user)._id;

    const result = await Notification.deleteMany({
      user: userId,
      read: true
    });

    res.json({ 
      message: 'Read notifications deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    logger.error('Delete read notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete notifications' });
  }
});

/**
 * POST /api/notifications/test
 * Create a test notification (for development)
 */
router.post('/test', async (req, res) => {
  try {
    const userId = ((req as any).user)._id;
    const { type, title, message, data } = req.body;

    const notification = await ((Notification as any).createNotification)(
      userId,
      type || 'mention',
      title || 'Test notification',
      message || 'This is a test notification',
      data
    );

    res.status(201).json(notification);
  } catch (error: any) {
    logger.error('Create test notification error:', error);
    res.status(500).json({ error: error.message || 'Failed to create test notification' });
  }
});

export default router;
