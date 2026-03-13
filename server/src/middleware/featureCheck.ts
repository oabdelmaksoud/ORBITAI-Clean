import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { isFeatureEnabled } from '../services/featureFlags.service.js';
import { AppError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

export interface FeatureRequest extends AuthRequest {
  userRole?: string;
}

/**
 * Middleware to check if a user has access to a specific feature
 * Usage: router.post('/api/feature', checkFeatureAccess('feature_key'), handler)
 */
export function checkFeatureAccess(featureKey: string) {
  return async (
    req: FeatureRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Get user role from request
      // Prefer req.admin?.role (set by requireAdmin middleware) over req.user?.role
      const userRole = (req as any).admin?.role || req.user?.role || 'user';

      const enabled = await isFeatureEnabled(featureKey, userRole);

      if (!enabled) {
        logger.warn(`Feature access denied: User ${req.user?.email} (role: ${userRole}) tried to access '${featureKey}'`);
        throw new AppError(
          `Access denied: This feature is not available for your role.`,
          403
        );
      }

      // Store feature key in request for logging/debugging
      (req as any).featureKey = featureKey;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express route handler helper to check feature access inline
 * Usage: await requireFeatureAccess(req, 'feature_key')
 */
export async function requireFeatureAccess(
  req: FeatureRequest,
  featureKey: string
): Promise<boolean> {
  // Prefer req.admin?.role (set by requireAdmin middleware) over req.user?.role
  const userRole = (req as any).admin?.role || req.user?.role || 'user';
  const enabled = await isFeatureEnabled(featureKey, userRole);

  if (!enabled) {
    throw new AppError(
      `Access denied: This feature is not available for your role.`,
      403
    );
  }

  return true;
}
