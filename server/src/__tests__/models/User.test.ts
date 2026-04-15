import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../../models/User.model.js';

beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('TEST_MONGODB_URI not set');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('User Model', () => {
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
      // Create with select:false for password, so we need to re-query with +password
      await User.create({
        email: 'compare@example.com',
        password,
        name: 'Test User'
      });

      const user = await User.findOne({ email: 'compare@example.com' }).select('+password');
      expect(user).toBeDefined();

      const isValid = await user!.comparePassword(password);
      expect(isValid).toBe(true);

      const isInvalid = await user!.comparePassword('WrongPassword');
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
