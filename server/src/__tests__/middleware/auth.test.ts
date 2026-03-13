import { describe, it, expect } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, generateToken, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { config } from '../../config/env.js';

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const email = 'test@example.com';
      const plan = 'Pro';

      const token = generateToken(userId, email, plan);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, config.jwtSecret) as any;
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

      // Verify token can be decoded
      const decoded = jwt.verify(token, config.jwtSecret) as any;
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
      } as unknown as AuthRequest;

      const res = {} as Response;
      let nextCalled = false;
      let nextError: any = null;
      const next = ((err?: any) => { nextCalled = true; nextError = err; }) as NextFunction;

      await authenticateToken(req, res, next);

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
      } as unknown as AuthRequest;

      const res = {} as Response;
      let nextError: any = null;
      const next = ((err?: any) => { nextError = err; }) as NextFunction;

      await authenticateToken(req, res, next);

      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      } as unknown as AuthRequest;

      const res = {} as Response;
      let nextError: any = null;
      const next = ((err?: any) => { nextError = err; }) as NextFunction;

      await authenticateToken(req, res, next);

      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.statusCode).toBe(401);
    });

    it('should reject request with malformed authorization header', async () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token'
        }
      } as unknown as AuthRequest;

      const res = {} as Response;
      let nextError: any = null;
      const next = ((err?: any) => { nextError = err; }) as NextFunction;

      await authenticateToken(req, res, next);

      expect(nextError).toBeInstanceOf(AppError);
      expect(nextError.statusCode).toBe(401);
    });
  });
});

