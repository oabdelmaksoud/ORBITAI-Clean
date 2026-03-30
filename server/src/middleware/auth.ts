import { logger } from '../utils/logger.js';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AppError } from './errorHandler.js';
import { config } from '../config/env.js';
import { User } from '../models/User.model.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    plan: string;
    role?: string;
  };
}

// Helper to wrap async middleware for Express
const asyncHandler = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };
};

async function authenticateTokenAsync(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return next(new AppError('Access token required', 401));
  }

  // Check if this is a guest token (starts with 'guest-token-')
  if (token.startsWith('guest-token-')) {
    // Validate HMAC signature: format is guest-token-{userId}-{hmac}
    const parts = token.split('-');
    // Expected: ['guest', 'token', userId, hmac]
    if (parts.length < 4) {
      return next(new AppError('Invalid guest token format', 401));
    }
    const hmacProvided = parts[parts.length - 1];
    const userId = parts.slice(2, parts.length - 1).join('-');
    const expectedHmac = crypto.createHmac('sha256', config.jwtSecret).update(userId).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmacProvided, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return next(new AppError('Invalid guest token signature', 401));
    }
    // Allow guest users with minimal permissions
    req.user = {
      id: userId,
      email: 'guest@local',
      name: 'Guest',
      plan: 'free',
      role: 'guest'
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; email: string; name?: string; plan: string; role?: string };

    // If role is not in token (old tokens), fetch from database
    let role = decoded.role;
    if (!role) {
      try {
        const user = await User.findById(decoded.userId).select('role').lean();
        role = user?.role;
      } catch (dbError) {
        // If DB lookup fails, continue without role (will default to 'public' in feature checks)
        logger.warn('Failed to fetch user role from DB:', dbError);
      }
    }

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name || decoded.email.split('@')[0], // Fallback to email prefix if name not in token
      plan: decoded.plan,
      role: role
    };
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
}

// Helper to generate a valid guest token with HMAC signature
export function generateGuestToken(userId: string): string {
  const hmac = crypto.createHmac('sha256', config.jwtSecret).update(userId).digest('hex');
  return `guest-token-${userId}-${hmac}`;
}

// Export wrapped async middleware
export const authenticateToken = asyncHandler(authenticateTokenAsync);

export function generateToken(userId: string, email: string, plan: string, role?: string): string {
  return jwt.sign(
    { userId, email, plan, role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );
}

// Optional authentication - doesn't error if no token, but populates user if token is valid
async function authenticateTokenOptionalAsync(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return next(); // Continue without user
  }

  // Check if this is a guest token (starts with 'guest-token-')
  if (token.startsWith('guest-token-')) {
    // Validate HMAC signature: format is guest-token-{userId}-{hmac}
    const parts = token.split('-');
    if (parts.length >= 4) {
      const hmacProvided = parts[parts.length - 1];
      const userId = parts.slice(2, parts.length - 1).join('-');
      try {
        const expectedHmac = crypto.createHmac('sha256', config.jwtSecret).update(userId).digest('hex');
        if (crypto.timingSafeEqual(Buffer.from(hmacProvided, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
          req.user = {
            id: userId,
            email: 'guest@local',
            name: 'Guest',
            plan: 'free',
            role: 'guest'
          };
        }
      } catch {
        // Invalid HMAC, continue without user
      }
    }
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; email: string; name?: string; plan: string; role?: string };

    // If role is not in token (old tokens), fetch from database
    let role = decoded.role;
    if (!role) {
      try {
        const user = await User.findById(decoded.userId).select('role').lean();
        role = user?.role;
      } catch (dbError) {
        logger.warn('Failed to fetch user role from DB:', dbError);
      }
    }

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name || decoded.email.split('@')[0],
      plan: decoded.plan,
      role: role
    };
    next();
  } catch (error) {
    // If token is invalid, just continue without user (treat as guest)
    next();
  }
}

export const authenticateTokenOptional = asyncHandler(authenticateTokenOptionalAsync);

