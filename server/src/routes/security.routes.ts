import express from 'express';
import { SecurityEvent } from '../models/SecurityEvent.model.js';
import { Session } from '../models/Session.model.js';
import { IPWhitelist } from '../models/IPWhitelist.model.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/security/events
 * Get security events with filters
 */
router.get('/events', async (req: AdminRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string;
    const severity = req.query.severity as string;
    const resolved = req.query.resolved as string;
    const ipAddress = req.query.ipAddress as string;

    const query: any = {};

    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (resolved !== undefined) query.resolved = resolved === 'true';
    if (ipAddress) query.ipAddress = ipAddress;

    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      SecurityEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityEvent.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        events: events.map(e => ({
          id: e._id.toString(),
          type: e.type,
          severity: e.severity,
          userId: e.userId,
          email: e.email,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
          location: e.location,
          details: e.details,
          resolved: e.resolved,
          resolvedAt: e.resolvedAt,
          resolvedBy: e.resolvedBy,
          createdAt: e.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/security/events/stats
 * Get security event statistics
 */
router.get('/events/stats', async (_req: AdminRequest, res, next) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, unresolved, last24h, last7d, last30d, byType, bySeverity] = await Promise.all([
      SecurityEvent.countDocuments({}),
      SecurityEvent.countDocuments({ resolved: false }),
      SecurityEvent.countDocuments({ createdAt: { $gte: last24Hours } }),
      SecurityEvent.countDocuments({ createdAt: { $gte: last7Days } }),
      SecurityEvent.countDocuments({ createdAt: { $gte: last30Days } }),
      SecurityEvent.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      SecurityEvent.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total,
        unresolved,
        last24Hours: last24h,
        last7Days: last7d,
        last30Days: last30d,
        byType: byType.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/admin/security/events/:id/resolve
 * Mark security event as resolved
 */
router.put('/events/:id/resolve', async (req: AdminRequest, res, next) => {
  try {
    const event = await SecurityEvent.findById(req.params.id);

    if (!event) {
      throw new AppError('Security event not found', 404);
    }

    event.resolved = true;
    event.resolvedAt = new Date();
    event.resolvedBy = req.admin?.id || req.user?.id;
    await event.save();

    res.json({
      success: true,
      message: 'Security event marked as resolved'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/security/sessions
 * Get active sessions
 */
router.get('/sessions', async (req: AdminRequest, res, next) => {
  try {
    const userId = req.query.userId as string;
    const query: any = { isActive: true };

    if (userId) query.userId = userId;

    const sessions = await Session.find(query)
      .sort({ lastActivity: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        sessions: sessions.map(s => ({
          id: s._id.toString(),
          userId: s.userId,
          email: s.email,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          location: s.location,
          lastActivity: s.lastActivity,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt
        }))
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/admin/security/sessions/:id
 * Revoke a session
 */
router.delete('/sessions/:id', async (req: AdminRequest, res, next) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    session.isActive = false;
    await session.save();

    logger.info(`Admin ${req.admin?.email} revoked session ${req.params.id}`);

    res.json({
      success: true,
      message: 'Session revoked'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/security/ip-whitelist
 * Get IP whitelist/blacklist
 */
router.get('/ip-whitelist', async (req: AdminRequest, res, next) => {
  try {
    const type = req.query.type as string;
    const query: any = { isActive: true };

    if (type) query.type = type;

    const ips = await IPWhitelist.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        ips: ips.map(ip => ({
          id: ip._id.toString(),
          ipAddress: ip.ipAddress,
          type: ip.type,
          reason: ip.reason,
          createdBy: ip.createdBy,
          createdAt: ip.createdAt,
          expiresAt: ip.expiresAt
        }))
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/security/ip-whitelist
 * Add IP to whitelist or blacklist
 */
router.post('/ip-whitelist', async (req: AdminRequest, res, next) => {
  try {
    const { ipAddress, type, reason, expiresAt } = req.body;

    if (!ipAddress || !type) {
      throw new AppError('IP address and type are required', 400);
    }

    const ip = new IPWhitelist({
      ipAddress,
      type,
      reason,
      createdBy: req.admin?.id || req.user?.id,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      isActive: true
    });

    await ip.save();

    logger.info(`Admin ${req.admin?.email} added IP ${ipAddress} to ${type}`);

    res.status(201).json({
      success: true,
      data: {
        ip: {
          id: ip._id.toString(),
          ipAddress: ip.ipAddress,
          type: ip.type,
          reason: ip.reason,
          createdAt: ip.createdAt
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/admin/security/ip-whitelist/:id
 * Remove IP from whitelist/blacklist
 */
router.delete('/ip-whitelist/:id', async (req: AdminRequest, res, next) => {
  try {
    const ip = await IPWhitelist.findById(req.params.id);

    if (!ip) {
      throw new AppError('IP entry not found', 404);
    }

    ip.isActive = false;
    await ip.save();

    logger.info(`Admin ${req.admin?.email} removed IP ${ip.ipAddress} from ${ip.type}`);

    res.json({
      success: true,
      message: 'IP entry removed'
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















