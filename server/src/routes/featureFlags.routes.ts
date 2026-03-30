import express from 'express';
import mongoose from 'mongoose';
import { FeatureFlag } from '../models/FeatureFlag.model.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logger } from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Get current environment
 */
function getCurrentEnvironment(): string {
  const env = config.nodeEnv || process.env.NODE_ENV || 'development';
  // Normalize environment names
  if (env === 'prod' || env === 'production') return 'production';
  if (env === 'stage' || env === 'staging') return 'staging';
  if (env === 'dev' || env === 'development') return 'development';
  if (env === 'test' || env === 'testing') return 'test';
  return env.toLowerCase();
}

const router = express.Router();

/**
 * GET /api/admin/feature-flags/check/:key
 * Check if a feature is enabled (public endpoint, no admin required)
 * Role parameter is optional for backward compatibility but not used
 * 
 * This route MUST be defined BEFORE the authentication middleware
 * to allow public access without authentication.
 */
router.get('/check/:key', async (req, res, next) => {
  try {
    const role = req.query.role as string;
    const normalizedRole = role?.toLowerCase().trim() || 'public';
    const normalizedKey = req.params.key.toLowerCase().trim();
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - default to enabled for backward compatibility
      return res.json({
        success: true,
        data: {
          enabled: true,
          reason: 'MongoDB not connected, defaulting to enabled'
        }
      });
    }
    
    const flag = await FeatureFlag.findOne({ 
      featureKey: normalizedKey
    }).lean();

    if (!flag) {
      // If flag doesn't exist, default to enabled (backward compatibility)
      return res.json({
        success: true,
        data: {
          enabled: true,
          reason: 'Feature flag not found, defaulting to enabled'
        }
      });
    }

    // First check: if isActive is false, feature is disabled for everyone
    if (!flag.isActive) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          featureKey: flag.featureKey,
          featureName: flag.featureName,
          isActive: false,
          reason: 'Feature flag is inactive'
        }
      });
    }

    // Second check: environment-specific activation
    // If enabledEnvironments is empty/null, feature is active in all environments
    const currentEnv = getCurrentEnvironment();
    
    if (flag.enabledEnvironments && flag.enabledEnvironments.length > 0) {
      if (!flag.enabledEnvironments.includes(currentEnv)) {
        return res.json({
          success: true,
          data: {
            enabled: false,
            featureKey: flag.featureKey,
            featureName: flag.featureName,
            isActive: flag.isActive,
            reason: `Feature is not enabled for environment '${currentEnv}'`
          }
        });
      }
    }

    // Third check: role-based access - check if user's role is in enabledRoles
    const enabledRoles = flag.enabledRoles || [];
    const normalizedEnabledRoles = enabledRoles.map(r => r.toLowerCase().trim());
    const hasAccess = normalizedEnabledRoles.includes(normalizedRole);

    // Debug logging for superadmin
    if (normalizedRole === 'superadmin' && !hasAccess) {
      logger.warn(`[Feature Flags] Superadmin access denied for '${normalizedKey}'. Enabled roles: ${enabledRoles.join(', ')}`);
    }

    res.json({
      success: true,
      data: {
        enabled: hasAccess,
        featureKey: flag.featureKey,
        featureName: flag.featureName,
        isActive: flag.isActive,
        userRole: normalizedRole,
        enabledRoles: flag.enabledRoles
      }
    });
  } catch (error: any) {
    next(error);
  }
});

// All other routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/feature-flags
 * Get all feature flags
 */
router.get('/', async (_req: AdminRequest, res, next) => {
  try {
    const flags = await FeatureFlag.find().sort({ category: 1, featureName: 1 }).lean();
    res.json({
      success: true,
      data: {
        flags: flags.map(f => ({
          id: f._id.toString(),
          featureKey: f.featureKey,
          featureName: f.featureName,
          description: f.description,
          category: f.category,
          enabledRoles: f.enabledRoles,
          enabledEnvironments: f.enabledEnvironments || [],
          isActive: f.isActive,
          metadata: f.metadata || {}
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/feature-flags/:key
 * Get a specific feature flag by key
 */
router.get('/:key', async (req: AdminRequest, res, next) => {
  try {
    const flag = await FeatureFlag.findOne({ featureKey: req.params.key }).lean();

    if (!flag) {
      throw new AppError('Feature flag not found', 404);
    }

    res.json({
      success: true,
      data: {
        flag: {
          id: flag._id.toString(),
          featureKey: flag.featureKey,
          featureName: flag.featureName,
          description: flag.description,
          category: flag.category,
          enabledRoles: flag.enabledRoles,
          enabledEnvironments: flag.enabledEnvironments || [],
          isActive: flag.isActive,
          metadata: flag.metadata || {}
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/feature-flags
 * Create a new feature flag
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const { featureKey, featureName, description, category, enabledRoles, enabledEnvironments, metadata } = req.body;

    if (!featureKey || !featureName || !category) {
      throw new AppError('featureKey, featureName, and category are required', 400);
    }

    // Check if feature flag already exists
    const existing = await FeatureFlag.findOne({ featureKey });
    if (existing) {
      throw new AppError('Feature flag with this key already exists', 400);
    }

    const newFlag = new FeatureFlag({
      featureKey: featureKey.toLowerCase(),
      featureName,
      description: description || '',
      category,
      enabledRoles: enabledRoles || ['user'],
      enabledEnvironments: enabledEnvironments || [],
      isActive: true,
      metadata: metadata || {}
    });

    await newFlag.save();

    await logAudit(req, {
      action: 'feature_flag.created',
      entityType: 'feature_flag',
      entityId: newFlag._id.toString(),
      details: { featureKey: newFlag.featureKey, featureName: newFlag.featureName }
    });

    logger.info(`Admin ${req.admin?.email} created feature flag ${newFlag.featureKey}`);

    // Broadcast cache clear event to all connected clients via WebSocket
    try {
      const { webSocketService } = await import('../services/websocket.service.js');
      webSocketService.broadcast({
        type: 'feature_flag_updated',
        featureKey: newFlag.featureKey,
        message: 'Feature flags have been updated. Changes are effective immediately.'
      });
    } catch (error) {
      // WebSocket not available - that's okay, cache will expire naturally
      logger.debug('WebSocket service not available for feature flag broadcast');
    }

    res.status(201).json({
      success: true,
      data: {
        flag: {
          id: newFlag._id.toString(),
          featureKey: newFlag.featureKey,
          featureName: newFlag.featureName,
          description: newFlag.description,
          category: newFlag.category,
          enabledRoles: newFlag.enabledRoles,
          enabledEnvironments: newFlag.enabledEnvironments || [],
          isActive: newFlag.isActive,
          metadata: newFlag.metadata || {}
        }
      }
    });
  } catch (error: any) {
    await logAudit(req, {
      action: 'feature_flag.create',
      entityType: 'feature_flag',
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

/**
 * PUT /api/admin/feature-flags/:key
 * Update a feature flag (upsert - creates if doesn't exist)
 */
router.put('/:key', async (req: AdminRequest, res, next) => {
  try {
    let flag = await FeatureFlag.findOne({ featureKey: req.params.key });
    const isNew = !flag;

    if (!flag) {
      // Create new flag if it doesn't exist
      flag = new FeatureFlag({
        featureKey: req.params.key,
        featureName: req.body.featureName || req.params.key,
        description: req.body.description || '',
        category: req.body.category || 'general',
        enabledRoles: req.body.enabledRoles || [],
        enabledEnvironments: req.body.enabledEnvironments || [],
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        metadata: req.body.metadata || {}
      });
    }

    const oldData = flag._id ? {
      enabledRoles: [...flag.enabledRoles],
      enabledEnvironments: [...(flag.enabledEnvironments || [])],
      isActive: flag.isActive
    } : null;

    // Update allowed fields
    if (req.body.featureName !== undefined) flag.featureName = req.body.featureName;
    if (req.body.description !== undefined) flag.description = req.body.description;
    if (req.body.category !== undefined) flag.category = req.body.category;
    if (req.body.enabledRoles !== undefined) flag.enabledRoles = req.body.enabledRoles;
    if (req.body.enabledEnvironments !== undefined) flag.enabledEnvironments = req.body.enabledEnvironments || [];
    if (req.body.isActive !== undefined) flag.isActive = req.body.isActive;
    if (req.body.metadata !== undefined) flag.metadata = { ...flag.metadata, ...req.body.metadata };

    await flag.save();

    await logAudit(req, {
      action: isNew ? 'feature_flag.created' : 'feature_flag.updated',
      entityType: 'feature_flag',
      entityId: flag._id.toString(),
      details: {
        old: oldData,
        new: {
          enabledRoles: flag.enabledRoles,
          enabledEnvironments: flag.enabledEnvironments || [],
          isActive: flag.isActive
        }
      }
    });

    logger.info(`Admin ${req.admin?.email} ${isNew ? 'created' : 'updated'} feature flag ${flag.featureKey}`);

    // Broadcast cache clear event to all connected clients via WebSocket
    try {
      const { webSocketService } = await import('../services/websocket.service.js');
      webSocketService.broadcast({
        type: 'feature_flag_updated',
        featureKey: flag.featureKey,
        message: 'Feature flags have been updated. Changes are effective immediately.'
      });
      logger.info(`[Feature Flags] Broadcasted cache clear for feature: ${flag.featureKey}`);
    } catch (error) {
      // WebSocket not available - that's okay, cache will expire naturally
      logger.debug('WebSocket service not available for feature flag broadcast');
    }

    res.json({
      success: true,
      data: {
        flag: {
          id: flag._id.toString(),
          featureKey: flag.featureKey,
          featureName: flag.featureName,
          description: flag.description,
          category: flag.category,
          enabledRoles: flag.enabledRoles,
          enabledEnvironments: flag.enabledEnvironments || [],
          isActive: flag.isActive,
          metadata: flag.metadata || {}
        }
      }
    });
  } catch (error: any) {
    await logAudit(req, {
      action: 'feature_flag.update',
      entityType: 'feature_flag',
      entityId: req.params.key,
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

/**
 * DELETE /api/admin/feature-flags/:key
 * Delete a feature flag (soft delete by setting isActive to false)
 */
router.delete('/:key', async (req: AdminRequest, res, next) => {
  try {
    const flag = await FeatureFlag.findOne({ featureKey: req.params.key });

    if (!flag) {
      throw new AppError('Feature flag not found', 404);
    }

    const featureKey = flag.featureKey;

    // Soft delete - set isActive to false instead of actually deleting
    flag.isActive = false;
    await flag.save();

    await logAudit(req, {
      action: 'feature_flag.deleted',
      entityType: 'feature_flag',
      entityId: flag._id.toString(),
      details: { featureKey: flag.featureKey, featureName: flag.featureName }
    });

    logger.info(`Admin ${req.admin?.email} deleted feature flag ${flag.featureKey}`);

    // Broadcast cache clear event to all connected clients via WebSocket
    try {
      const { webSocketService } = await import('../services/websocket.service.js');
      webSocketService.broadcast({
        type: 'feature_flag_updated',
        featureKey: flag.featureKey,
        message: 'Feature flags have been updated. Changes are effective immediately.'
      });
    } catch (error) {
      // WebSocket not available - that's okay, cache will expire naturally
      logger.debug('WebSocket service not available for feature flag broadcast');
    }

    res.json({
      success: true,
      message: 'Feature flag deleted successfully'
    });
  } catch (error: any) {
    await logAudit(req, {
      action: 'feature_flag.delete',
      entityType: 'feature_flag',
      entityId: req.params.key,
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

export default router;
