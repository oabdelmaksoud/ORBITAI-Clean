import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { RateLimitRule } from '../models/RateLimitRule.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminRateLimiter);

/**
 * GET /api/admin/rate-limits
 * List all rate limit rules
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const { scope, isActive } = req.query;
    const query: any = {};
    
    if (scope) {
      query.scope = scope;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const rules = await RateLimitRule.find(query)
      .sort({ priority: -1, createdAt: -1 });
    
    res.json({
      success: true,
      data: { rules }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/rate-limits
 * Create rate limit rule
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const { name, description, scope, scopeValue, limit, windowMs, priority } = req.body;

    if (!name || !scope || !limit || !windowMs) {
      return res.status(400).json({
        success: false,
        error: 'name, scope, limit, and windowMs are required'
      });
    }

    // Validate scope-specific requirements
    if ((scope === 'user' || scope === 'plan' || scope === 'ip' || scope === 'endpoint') && !scopeValue) {
      return res.status(400).json({
        success: false,
        error: `scopeValue is required for scope type '${scope}'`
      });
    }

    const rule = new RateLimitRule({
      name,
      description,
      scope,
      scopeValue,
      limit,
      windowMs,
      priority: priority || 0,
      isActive: true,
      createdBy: req.admin!.id
    });

    await rule.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'rate_limit_create',
      entityType: 'rate_limit',
      details: {
        ruleId: rule._id.toString(),
        name,
        scope,
        limit,
        windowMs
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/rate-limits/:id
 * Update rate limit rule
 */
router.put('/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rule = await RateLimitRule.findById(id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rate limit rule not found'
      });
    }

    Object.assign(rule, updates);
    await rule.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'rate_limit_update',
      entityType: 'rate_limit',
      details: {
        ruleId: id,
        updates
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/rate-limits/:id
 * Delete rate limit rule
 */
router.delete('/:id', async (req: AdminRequest, res, next) => {
  try {
    const { id } = req.params;

    const rule = await RateLimitRule.findById(id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rate limit rule not found'
      });
    }

    await RateLimitRule.deleteOne({ _id: id });

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'rate_limit_delete',
      entityType: 'rate_limit',
      details: {
        ruleId: id
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      message: 'Rate limit rule deleted'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/rate-limits/user/:userId
 * Get user's rate limits
 */
router.get('/user/:userId', async (req: AdminRequest, res, next) => {
  try {
    const { userId } = req.params;

    const rules = await RateLimitRule.find({
      $or: [
        { scope: 'global' },
        { scope: 'user', scopeValue: userId }
      ],
      isActive: true
    }).sort({ priority: -1 });

    res.json({
      success: true,
      data: { rules }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/rate-limits/user/:userId
 * Set user's rate limits
 */
router.post('/user/:userId', async (req: AdminRequest, res, next) => {
  try {
    const { userId } = req.params;
    const { limit, windowMs, name } = req.body;

    if (!limit || !windowMs) {
      return res.status(400).json({
        success: false,
        error: 'limit and windowMs are required'
      });
    }

    // Find or create user-specific rule
    let rule = await RateLimitRule.findOne({
      scope: 'user',
      scopeValue: userId
    });

    if (rule) {
      rule.limit = limit;
      rule.windowMs = windowMs;
      if (name) rule.name = name;
      rule.isActive = true;
    } else {
      rule = new RateLimitRule({
        name: name || `User ${userId} Rate Limit`,
        scope: 'user',
        scopeValue: userId,
        limit,
        windowMs,
        isActive: true,
        createdBy: req.admin!.id
      });
    }

    await rule.save();

    // Log audit
    await AuditLog.create({
      userId: req.admin!.id,
      action: 'rate_limit_set_user',
      entityType: 'rate_limit',
      details: {
        userId,
        limit,
        windowMs
      },
      ipAddress: 'admin-console',
      userAgent: 'admin-console',
      success: true
    });

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/rate-limits/stats
 * Rate limit statistics
 */
router.get('/stats', async (_req: AdminRequest, res, next) => {
  try {
    const [total, active, byScope] = await Promise.all([
      RateLimitRule.countDocuments(),
      RateLimitRule.countDocuments({ isActive: true }),
      RateLimitRule.aggregate([
        {
          $group: {
            _id: '$scope',
            count: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byScope
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;




