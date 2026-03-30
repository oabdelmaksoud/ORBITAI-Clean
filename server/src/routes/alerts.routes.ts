import express from 'express';
import { AlertRule } from '../models/AlertRule.model.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/alerts/rules
 * Get all alert rules
 */
router.get('/rules', async (req: AdminRequest, res, next) => {
  try {
    const isActive = req.query.isActive as string;
    const query: any = {};

    if (isActive !== undefined) query.isActive = isActive === 'true';

    const rules = await AlertRule.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        rules: rules.map(r => ({
          id: r._id.toString(),
          name: r.name,
          description: r.description,
          condition: r.condition,
          channels: r.channels,
          severity: r.severity,
          escalation: r.escalation,
          isActive: r.isActive,
          lastTriggered: r.lastTriggered,
          triggerCount: r.triggerCount,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/alerts/rules
 * Create a new alert rule
 */
router.post('/rules', async (req: AdminRequest, res, next) => {
  try {
    const { name, description, condition, channels, severity, escalation } = req.body;

    if (!name || !condition || !condition.metric || !condition.operator || condition.threshold === undefined) {
      throw new AppError('Name, condition (metric, operator, threshold) are required', 400);
    }

    const rule = new AlertRule({
      name,
      description,
      condition,
      channels: channels || {},
      severity: severity || 'medium',
      escalation: escalation || { enabled: false },
      isActive: true
    });

    await rule.save();

    logger.info(`Admin ${req.admin?.email} created alert rule ${rule.name}`);

    res.status(201).json({
      success: true,
      data: {
        rule: {
          id: rule._id.toString(),
          name: rule.name,
          condition: rule.condition,
          channels: rule.channels,
          severity: rule.severity,
          isActive: rule.isActive
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/alerts/rules/:id
 * Update an alert rule
 */
router.put('/rules/:id', async (req: AdminRequest, res, next) => {
  try {
    const rule = await AlertRule.findById(req.params.id);

    if (!rule) {
      throw new AppError('Alert rule not found', 404);
    }

    const { name, description, condition, channels, severity, escalation, isActive } = req.body;

    if (name !== undefined) rule.name = name;
    if (description !== undefined) rule.description = description;
    if (condition !== undefined) rule.condition = condition;
    if (channels !== undefined) rule.channels = channels;
    if (severity !== undefined) rule.severity = severity;
    if (escalation !== undefined) rule.escalation = escalation;
    if (isActive !== undefined) rule.isActive = isActive;

    await rule.save();

    logger.info(`Admin ${req.admin?.email} updated alert rule ${rule.name}`);

    res.json({
      success: true,
      data: {
        rule: {
          id: rule._id.toString(),
          name: rule.name,
          condition: rule.condition,
          channels: rule.channels,
          severity: rule.severity,
          isActive: rule.isActive
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/admin/alerts/rules/:id
 * Delete an alert rule
 */
router.delete('/rules/:id', async (req: AdminRequest, res, next) => {
  try {
    const rule = await AlertRule.findByIdAndDelete(req.params.id);

    if (!rule) {
      throw new AppError('Alert rule not found', 404);
    }

    logger.info(`Admin ${req.admin?.email} deleted alert rule ${rule.name}`);

    res.json({
      success: true,
      message: 'Alert rule deleted'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/alerts/rules/:id/test
 * Test an alert rule
 */
router.post('/rules/:id/test', async (req: AdminRequest, res, next) => {
  try {
    const rule = await AlertRule.findById(req.params.id);

    if (!rule) {
      throw new AppError('Alert rule not found', 404);
    }

    // This would trigger the alert (implementation depends on your alert system)
    // For now, just return success
    res.json({
      success: true,
      message: 'Test alert sent'
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
















