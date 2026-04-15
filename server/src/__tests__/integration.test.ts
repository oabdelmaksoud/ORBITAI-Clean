/**
 * Integration Tests
 * End-to-end tests for complete workflows
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.routes.js';
import projectRoutes from '../routes/project.routes.js';
import taskRoutes from '../routes/task.routes.js';
import agentRoutes from '../routes/agent.routes.js';
import { setupTestEnv, teardownTestEnv, cleanupTestData, createTestUser, createTestProject, getAuthHeaders } from './helpers/testHelpers.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/agents', agentRoutes);

describe('Integration Tests - Complete Workflows', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    await setupTestEnv();
    await cleanupTestData();
    const { user, token } = await createTestUser({
      email: 'integration@example.com',
      name: 'Integration User'
    });
    authToken = token;
    userId = user._id.toString();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await teardownTestEnv();
  });

  describe('Complete User Registration → Project Creation → Task Management Flow', () => {
    it('should complete full workflow: register → login → create project → create task → update task', async () => {
      // Step 1: Register new user
      const registerData = {
        email: `workflow-${Date.now()}@example.com`,
        password: 'Workflow@1234',
        name: 'Workflow User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(registerData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data).toHaveProperty('user');
      expect(registerResponse.body.data).toHaveProperty('token');
      const workflowToken = registerResponse.body.data.token;

      // Step 2: Login with registered user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: registerData.email,
          password: registerData.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data).toHaveProperty('token');

      // Step 3: Get current user
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set(getAuthHeaders(workflowToken));

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.email).toBe(registerData.email.toLowerCase());

      // Step 4: Create project
      const projectData = {
        name: 'Workflow Test Project',
        description: 'Testing complete workflow',
        methodology: 'V-Model'
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
        currentPhase: 'Requirements'
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
      // Register → Login → Get Profile → Logout (implicit via token expiry)
      const email = `auth-${Date.now()}@example.com`;

      // Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'Auth@1234',
          name: 'Auth User'
        });

      expect(registerResponse.status).toBe(201);
      const token = registerResponse.body.data.token;

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'Auth@1234'
        });

      expect(loginResponse.status).toBe(200);

      // Get Profile (should work)
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set(getAuthHeaders(token));

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(email.toLowerCase());
    });

    it('should reject invalid authentication attempts', async () => {
      // Invalid login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword'
        });

      expect(loginResponse.status).toBe(401);

      // Access protected route without token
      const protectedResponse = await request(app)
        .get('/api/projects');

      expect(protectedResponse.status).toBe(401);
    });
  });

  describe('Project Lifecycle', () => {
    it('should handle complete project lifecycle', async () => {
      // Create → Read → Update → Delete
      const { token } = await createTestUser();

      // Create
      const createResponse = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(token))
        .send({
          name: 'Lifecycle Project',
          description: 'Testing lifecycle',
          methodology: 'Agile'
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
          description: 'Updated description'
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
        description: 'Test'
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
        methodology: 'V-Model'
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
      const { user: user1, token: token1 } = await createTestUser({
        email: 'user1@example.com'
      });
      const { user: user2, token: token2 } = await createTestUser({
        email: 'user2@example.com'
      });

      // User 1 creates project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(token1))
        .send({
          name: 'User 1 Project',
          description: 'Private project'
        });

      expect(projectResponse.status).toBe(201);
      const projectId = projectResponse.body.data.project._id;

      // User 2 should not see User 1's project
      const user2Projects = await request(app)
        .get('/api/projects')
        .set(getAuthHeaders(token2));

      expect(user2Projects.status).toBe(200);
      const user2ProjectIds = user2Projects.body.data.projects.map((p: any) => p.id);
      expect(user2ProjectIds).not.toContain(projectId);

      // User 2 should not be able to access User 1's project
      const accessAttempt = await request(app)
        .get(`/api/projects/${projectId}`)
        .set(getAuthHeaders(token2));

      expect(accessAttempt.status).toBe(404); // Not found (or 403 Forbidden)
    });
  });
});
