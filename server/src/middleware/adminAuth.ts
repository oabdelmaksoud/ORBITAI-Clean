import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';
import { User } from '../models/User.model.js';

export interface AdminRequest extends AuthRequest {
  admin?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to check if user is authenticated AND is an admin
 */
export async function requireAdmin(
  req: AdminRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // First ensure user is authenticated
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Fetch user from database to check role
    const user = await User.findById(req.user.id).select('role isActive');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new AppError('Admin access required', 403);
    }

    req.admin = {
      id: req.user.id,
      email: req.user.email,
      role: user.role
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to check if user is a superadmin
 */
export async function requireSuperAdmin(
  req: AdminRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.admin) {
      throw new AppError('Admin authentication required', 401);
    }

    if (req.admin.role !== 'superadmin') {
      throw new AppError('Superadmin access required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}

