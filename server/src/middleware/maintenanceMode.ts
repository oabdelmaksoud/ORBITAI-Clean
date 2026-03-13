import { Request, Response, NextFunction } from 'express';
import { systemControlService } from '../services/systemControl.service.js';

/**
 * Maintenance Mode Middleware
 * Blocks all requests when maintenance mode is enabled (except admin routes)
 */
export async function maintenanceModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Allow admin routes to bypass maintenance mode
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/admin-auth')) {
      return next();
    }

    const isMaintenanceMode = await systemControlService.isMaintenanceModeEnabled();

    if (isMaintenanceMode) {
      res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable due to maintenance',
        maintenance: true
      });
      return;
    }

    next();
  } catch (error) {
    // If check fails, allow request through (fail open)
    next();
  }
}




