import express from 'express';
import { User } from '../models/User.model.js';
import { authenticateToken, generateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { adminLoginSchema } from '../validators/adminAuth.validator.js';

const router = express.Router();

/**
 * POST /api/admin/login
 * Admin login endpoint
 * SECURITY: Added input validation with Zod schema and rate limiting
 */
router.post('/login', strictRateLimiter, validate(adminLoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and check if admin
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is admin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new AppError('Admin access required', 403);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token with role
    const token = generateToken(user._id.toString(), user.email, user.plan, user.role);

    logger.info(`Admin ${user.email} logged in`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          plan: user.plan
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/me
 * Get current admin user info
 */
router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if admin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      throw new AppError('Admin access required', 403);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          plan: user.plan,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;

