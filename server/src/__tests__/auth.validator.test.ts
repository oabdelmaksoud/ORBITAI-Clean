/**
 * Authentication Validator Tests
 * Tests for input validation schemas
 */

import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

describe('Auth Validators', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'Password123!',
        name: 'John Doe',
      };
      expect(() => registerSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing fields', () => {
      expect(() => registerSchema.parse({ email: 'user@example.com' })).toThrow();
      expect(() => registerSchema.parse({ password: 'Password123!' })).toThrow();
      expect(() => registerSchema.parse({ name: 'John Doe' })).toThrow();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'Password123!',
        name: 'John Doe',
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject weak password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'weak',
        name: 'John Doe',
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'anypassword',
      };
      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing fields', () => {
      expect(() => loginSchema.parse({ email: 'user@example.com' })).toThrow();
      expect(() => loginSchema.parse({ password: 'password' })).toThrow();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password',
      };
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });
  });
});

