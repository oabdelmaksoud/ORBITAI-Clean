/**
 * Authentication Route Tests
 * Tests for authentication endpoints using in-memory MongoDB
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.model.js';

// Set JWT_SECRET before importing routes (they may import config/env which needs it)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

// Dynamic import to ensure env is set first
const { default: authRoutes } = await import('../routes/auth.routes.js');
const { createTestUser, getAuthHeaders } = await import('./helpers/testHelpers.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Error handler for AppError
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('TEST_MONGODB_URI not set');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Authentication Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Secure@1234',
        name: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.name).toBe(userData.name);
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Secure@1234',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
    });

    it('should reject duplicate email registration', async () => {
      const timestamp = Date.now();
      const userData = {
        email: `duplicate-${timestamp}@example.com`,
        password: 'Secure@1234',
        name: 'Test User'
      };

      // First registration
      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(firstResponse.status).toBe(201);

      // Duplicate registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUserEmail: string;

    beforeEach(async () => {
      testUserEmail = `login-${Date.now()}@example.com`;
      await createTestUser({
        email: testUserEmail,
        password: 'Secure@1234',
        name: 'Login User'
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUserEmail,
        password: 'Secure@1234'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(loginData.email);
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Secure@1234'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject login with incorrect password', async () => {
      const loginData = {
        email: testUserEmail,
        password: 'Wrong@Password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with valid token', async () => {
      const uniqueEmail = `me-${Date.now()}@example.com`;
      const { user, token } = await createTestUser({
        email: uniqueEmail,
        name: 'Me User'
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user.name).toBe(user.name);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
