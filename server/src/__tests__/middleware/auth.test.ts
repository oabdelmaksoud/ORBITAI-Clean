import { describe, it, expect, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../middleware/errorHandler.js';

// Set JWT_SECRET before importing auth middleware
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

// Mock the User model to avoid needing a real DB connection
vi.mock('../../models/User.model.js', () => ({
  User: {
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ role: 'user' }),
      }),
    }),
  },
}));

const { authenticateToken, generateToken, AuthRequest } = await import(
  '../../middleware/auth.js'
);
const { config } = await import('../../config/env.js');

/**
 * Helper to run the Express middleware and wait for next() to be called.
 * authenticateToken is wrapped in asyncHandler which returns a sync function
 * that internally resolves a promise. We need to wait for that promise.
 */
function runMiddleware(
  middleware: any,
  req: any,
  res: any
): Promise<{ nextCalled: boolean; nextError: any }> {
  return new Promise((resolve) => {
    const next = (err?: any) => {
      resolve({ nextCalled: true, nextError: err ?? null });
    };
    // The middleware returns void but internally handles a promise
    middleware(req, res, next);
  });
}

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const email = 'test@example.com';
      const plan = 'Pro';

      const token = generateToken(userId, email, plan);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const secret = config.jwtSecret || process.env.JWT_SECRET || '';
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.plan).toBe(plan);
    });

    it('should generate a valid JWT token with role', () => {
      const userId = '507f1f77bcf86cd799439011';
      const email = 'admin@example.com';
      const plan = 'Enterprise';
      const role = 'superadmin';

      const token = generateToken(userId, email, plan, role);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const secret = config.jwtSecret || process.env.JWT_SECRET || '';
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.plan).toBe(plan);
      expect(decoded.role).toBe(role);
    });
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token with role', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const email = 'test@example.com';
      const plan = 'Pro';
      const role = 'user';
      const token = generateToken(userId, email, plan, role);

      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      } as any;

      const res = {} as Response;

      const { nextCalled, nextError } = await runMiddleware(authenticateToken, req, res);

      expect(nextCalled).toBe(true);
      expect(nextError).toBeNull();
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe(userId);
      expect(req.user?.email).toBe(email);
      expect(req.user?.plan).toBe(plan);
      expect(req.user?.role).toBe(role);
    });

    it('should reject request without token', async () => {
      const req = {
        headers: {}
      } as any;

      const res = {} as Response;

      const { nextError } = await runMiddleware(authenticateToken, req, res);

      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      } as any;

      const res = {} as Response;

      const { nextError } = await runMiddleware(authenticateToken, req, res);

      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.statusCode).toBe(401);
    });

    it('should reject request with malformed authorization header', async () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token'
        }
      } as any;

      const res = {} as Response;

      const { nextError } = await runMiddleware(authenticateToken, req, res);

      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.statusCode).toBe(401);
    });
  });
});
