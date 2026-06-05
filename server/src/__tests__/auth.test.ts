/**
 * Authentication Route Tests
 * Tests for authentication endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.routes.js';
import { User } from '../models/User.model.js';
import {
  setupTestEnv,
  teardownTestEnv,
  cleanupTestData,
  createTestUser,
} from './helpers/testHelpers.js';
import { hasMongo } from './helpers/testEnv.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Requires a reachable MongoDB server (setupTestEnv connects via mongoose).
describe.skipIf(!hasMongo)('Authentication Routes', () => {
  beforeEach(async () => {
    await setupTestEnv();
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await teardownTestEnv();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Secure@1234',
        name: 'New User',
      };

      const response = await request(app).post('/api/auth/register').send(userData);

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
        name: 'Test User',
      };

      const response = await request(app).post('/api/auth/register').send(userData);

      expect(response.status).toBe(400);
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User',
      };

      const response = await request(app).post('/api/auth/register').send(userData);

      expect(response.status).toBe(400);
    });

    it('should reject duplicate email registration', async () => {
      // Use unique email with timestamp to avoid conflicts
      const timestamp = Date.now();
      const userData = {
        email: `duplicate-${timestamp}@example.com`,
        password: 'Secure@1234',
        name: 'Test User',
      };

      // First registration
      const firstResponse = await request(app).post('/api/auth/register').send(userData);

      expect(firstResponse.status).toBe(201);

      // Duplicate registration with same email
      const response = await request(app).post('/api/auth/register').send(userData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUserEmail: string;

    beforeEach(async () => {
      // Use unique email for each test run to avoid conflicts
      testUserEmail = `login-${Date.now()}@example.com`;
      await createTestUser({
        email: testUserEmail,
        password: 'Secure@1234',
        name: 'Login User',
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUserEmail,
        password: 'Secure@1234',
      };

      const response = await request(app).post('/api/auth/login').send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(loginData.email);
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Secure@1234',
      };

      const response = await request(app).post('/api/auth/login').send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject login with incorrect password', async () => {
      const loginData = {
        email: testUserEmail,
        password: 'Wrong@Password',
      };

      const response = await request(app).post('/api/auth/login').send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with valid token', async () => {
      // Use unique email to avoid conflicts
      const uniqueEmail = `me-${Date.now()}@example.com`;
      const { user, token } = await createTestUser({
        email: uniqueEmail,
        name: 'Me User',
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
      const response = await request(app).get('/api/auth/me');

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
