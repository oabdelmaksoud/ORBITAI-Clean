/**
 * Integration Tests
 * End-to-end tests for complete workflows using in-memory MongoDB
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';

// Set JWT_SECRET before importing anything that uses config
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

// Mock feature flags - allow most features but deny view_all_projects for user isolation
vi.mock('../services/featureFlags.service.js', () => ({
  isFeatureEnabled: vi.fn().mockImplementation((featureKey: string, _role?: string) => {
    // Deny view_all_projects so users can only see their own projects
    if (featureKey === 'view_all_projects') return Promise.resolve(false);
    return Promise.resolve(true);
  }),
}));

// Mock heavy services that project.routes imports
vi.mock('../services/projectPackager.service.js', () => ({
  projectPackagerService: {
    packageProject: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../services/projectCompletion.service.js', () => ({
  projectCompletionService: {
    checkProjectCompletion: vi.fn().mockResolvedValue({ completed: false }),
  },
}));

vi.mock('../services/autoCompletion.service.js', () => ({
  autoCompletionService: {
    checkAndAdvancePhase: vi.fn().mockResolvedValue(null),
  },
}));

const { default: authRoutes } = await import('../routes/auth.routes.js');
const { default: projectRoutes } = await import('../routes/project.routes.js');
const { getAuthHeaders, createTestUser } = await import('./helpers/testHelpers.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

// Error handler
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

describe('Integration Tests - Complete Workflows', () => {
  describe('Complete User Registration and Project Creation Flow', () => {
    it('should complete full workflow: register -> login -> create project -> update project', async () => {
      // Step 1: Register new user
      const registerData = {
        email: `workflow-${Date.now()}@example.com`,
        password: 'Workflow@1234',
        name: 'Workflow User',
      };

      const registerResponse = await request(app).post('/api/auth/register').send(registerData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data).toHaveProperty('user');
      expect(registerResponse.body.data).toHaveProperty('token');
      const workflowToken = registerResponse.body.data.token;

      // Step 2: Login with registered user
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: registerData.email,
        password: registerData.password,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data).toHaveProperty('token');

      // Step 3: Get current user
      const meResponse = await request(app).get('/api/auth/me').set(getAuthHeaders(workflowToken));

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.email).toBe(registerData.email.toLowerCase());

      // Step 4: Create project
      const projectData = {
        name: 'Workflow Test Project',
        description: 'Testing complete workflow',
        methodology: 'V-Model',
      };

      const projectResponse = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(workflowToken))
        .send(projectData);

      expect(projectResponse.status).toBe(201);
      const projectId = projectResponse.body.data.project._id;

      // Step 5: Update project
      const updateData = {
        name: 'Updated Workflow Project',
        currentPhase: 'Requirements',
      };

      const updateResponse = await request(app)
        .put(`/api/projects/${projectId}`)
        .set(getAuthHeaders(workflowToken))
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.project.name).toBe(updateData.name);

      // Step 6: Get project
      const getResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set(getAuthHeaders(workflowToken));

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.project.name).toBe(updateData.name);

      // Step 7: List all projects
      const listResponse = await request(app)
        .get('/api/projects')
        .set(getAuthHeaders(workflowToken));

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.projects.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Authentication Flow', () => {
    it('should handle complete authentication workflow', async () => {
      const email = `auth-${Date.now()}@example.com`;

      // Register
      const registerResponse = await request(app).post('/api/auth/register').send({
        email,
        password: 'Auth@1234',
        name: 'Auth User',
      });

      expect(registerResponse.status).toBe(201);
      const token = registerResponse.body.data.token;

      // Login
      const loginResponse = await request(app).post('/api/auth/login').send({
        email,
        password: 'Auth@1234',
      });

      expect(loginResponse.status).toBe(200);

      // Get Profile (should work)
      const profileResponse = await request(app).get('/api/auth/me').set(getAuthHeaders(token));

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(email.toLowerCase());
    });

    it('should reject invalid authentication attempts', async () => {
      // Invalid login
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'WrongPassword',
      });

      expect(loginResponse.status).toBe(401);

      // Access protected route without token
      const protectedResponse = await request(app).get('/api/projects');

      expect(protectedResponse.status).toBe(401);
    });
  });

  describe('Project Lifecycle', () => {
    it('should handle complete project lifecycle', async () => {
      const { token } = await createTestUser();

      // Create
      const createResponse = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(token))
        .send({
          name: 'Lifecycle Project',
          description: 'Testing lifecycle',
          methodology: 'Agile',
        });

      expect(createResponse.status).toBe(201);
      const projectId = createResponse.body.data.project._id;

      // Read
      const readResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set(getAuthHeaders(token));

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.data.project.name).toBe('Lifecycle Project');

      // Update
      const updateResponse = await request(app)
        .put(`/api/projects/${projectId}`)
        .set(getAuthHeaders(token))
        .send({
          name: 'Updated Lifecycle Project',
          description: 'Updated description',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.project.name).toBe('Updated Lifecycle Project');

      // Verify update
      const verifyResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set(getAuthHeaders(token));

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.project.name).toBe('Updated Lifecycle Project');
    });
  });

  describe('Validation Integration', () => {
    it('should enforce validation across workflow', async () => {
      const { token } = await createTestUser();

      // Try to create project with invalid data (should fail validation)
      const invalidProject = {
        name: 'ab', // Too short
        description: 'Test',
      };

      const invalidResponse = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(token))
        .send(invalidProject);

      expect(invalidResponse.status).toBe(400);

      // Try with valid data (should succeed)
      const validProject = {
        name: 'Valid Project Name',
        description: 'Valid description',
        methodology: 'V-Model',
      };

      const validResponse = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(token))
        .send(validProject);

      expect(validResponse.status).toBe(201);
    });
  });

  describe('Multi-User Isolation', () => {
    it('should isolate projects between users', async () => {
      // Create two users
      const { token: token1 } = await createTestUser({
        email: 'user1@example.com',
      });
      const { token: token2 } = await createTestUser({
        email: 'user2@example.com',
      });

      // User 1 creates project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(token1))
        .send({
          name: 'User 1 Project',
          description: 'Private project',
        });

      expect(projectResponse.status).toBe(201);
      const projectId = projectResponse.body.data.project._id;

      // User 2 should not see User 1's project
      const user2Projects = await request(app).get('/api/projects').set(getAuthHeaders(token2));

      expect(user2Projects.status).toBe(200);
      const user2ProjectIds = user2Projects.body.data.projects.map((p: any) => p._id || p.id);
      expect(user2ProjectIds).not.toContain(projectId);

      // User 2 should not be able to access User 1's project
      const accessAttempt = await request(app)
        .get(`/api/projects/${projectId}`)
        .set(getAuthHeaders(token2));

      expect([403, 404]).toContain(accessAttempt.status);
    });
  });
});
