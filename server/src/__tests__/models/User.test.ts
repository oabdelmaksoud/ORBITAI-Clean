import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '../../models/User.model.js';
import mongoose from 'mongoose';

describe('User Model', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: 'Test User'
      };

      const user = await User.create(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.plan).toBe('Free');
      expect(user.role).toBe('user');
      expect(user.isActive).toBe(true);
    });

    it('should hash password before saving', async () => {
      const password = 'TestPassword123!';
      const user = await User.create({
        email: 'hash@example.com',
        password,
        name: 'Test User'
      });

      expect(user.password).not.toBe(password);
      expect(user.password.length).toBeGreaterThan(20); // Bcrypt hash length
    });

    it('should require email', async () => {
      await expect(
        User.create({
          password: 'Password123!',
          name: 'Test User'
        })
      ).rejects.toThrow();
    });

    it('should require password', async () => {
      await expect(
        User.create({
          email: 'test@example.com',
          name: 'Test User'
        })
      ).rejects.toThrow();
    });

    it('should require name', async () => {
      await expect(
        User.create({
          email: 'test@example.com',
          password: 'Password123!'
        })
      ).rejects.toThrow();
    });

    it('should enforce unique email', async () => {
      const email = 'unique@example.com';
      
      await User.create({
        email,
        password: 'Password123!',
        name: 'First User'
      });

      await expect(
        User.create({
          email,
          password: 'Password123!',
          name: 'Second User'
        })
      ).rejects.toThrow();
    });

    it('should validate email format', async () => {
      await expect(
        User.create({
          email: 'invalid-email',
          password: 'Password123!',
          name: 'Test User'
        })
      ).rejects.toThrow();
    });

    it('should lowercase email', async () => {
      const user = await User.create({
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123!',
        name: 'Test User'
      });

      expect(user.email).toBe('test@example.com');
    });
  });

  describe('Password Comparison', () => {
    it('should compare password correctly', async () => {
      const password = 'TestPassword123!';
      const user = await User.create({
        email: 'compare@example.com',
        password,
        name: 'Test User'
      });

      const isValid = await user.comparePassword(password);
      expect(isValid).toBe(true);

      const isInvalid = await user.comparePassword('WrongPassword');
      expect(isInvalid).toBe(false);
    });
  });

  describe('User Defaults', () => {
    it('should set default plan to Free', async () => {
      const user = await User.create({
        email: 'default@example.com',
        password: 'Password123!',
        name: 'Test User'
      });

      expect(user.plan).toBe('Free');
    });

    it('should set default role to user', async () => {
      const user = await User.create({
        email: 'role@example.com',
        password: 'Password123!',
        name: 'Test User'
      });

      expect(user.role).toBe('user');
    });

    it('should set default isActive to true', async () => {
      const user = await User.create({
        email: 'active@example.com',
        password: 'Password123!',
        name: 'Test User'
      });

      expect(user.isActive).toBe(true);
    });
  });
});

