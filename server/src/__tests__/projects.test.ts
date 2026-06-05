/**
 * Project Route Tests
 * Tests for project endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import projectRoutes from '../routes/project.routes.js';
import { User } from '../models/User.model.js';
import { Project } from '../models/Project.model.js';
import {
  setupTestEnv,
  teardownTestEnv,
  cleanupTestData,
  createTestUser,
  createTestProject,
  getAuthHeaders,
} from './helpers/testHelpers.js';
import { hasMongo } from './helpers/testEnv.js';

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

// Requires a reachable MongoDB server (setupTestEnv connects via mongoose).
describe.skipIf(!hasMongo)('Project Routes', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    await setupTestEnv();
    await cleanupTestData();
    const userData = await createTestUser();
    testUser = userData.user;
    authToken = userData.token;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await teardownTestEnv();
  });

  describe('POST /api/projects', () => {
    it('should create a new project with valid data', async () => {
      const projectData = {
        name: 'My Test Project',
        description: 'This is a test project',
        methodology: 'V-Model',
      };

      const response = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(authToken))
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('project');
      expect(response.body.data.project.name).toBe(projectData.name);
      expect(response.body.data.project.description).toBe(projectData.description);
    });

    it('should reject project creation with name too short', async () => {
      const projectData = {
        name: 'ab', // Too short (min 3 chars)
        description: 'Test description',
      };

      const response = await request(app)
        .post('/api/projects')
        .set(getAuthHeaders(authToken))
        .send(projectData);

      expect(response.status).toBe(400);
    });

    it('should reject project creation without authentication', async () => {
      const projectData = {
        name: 'Unauthorized Project',
        description: 'This should fail',
      };

      const response = await request(app).post('/api/projects').send(projectData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await createTestProject(testUser._id.toString(), { name: 'Project 1' });
      await createTestProject(testUser._id.toString(), { name: 'Project 2' });
    });

    it('should return all user projects', async () => {
      const response = await request(app).get('/api/projects').set(getAuthHeaders(authToken));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('projects');
      expect(Array.isArray(response.body.data.projects)).toBe(true);
      expect(response.body.data.projects.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects/:id', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await createTestProject(testUser._id.toString(), {
        name: 'Single Project Test',
        description: 'Test description',
      });
    });

    it('should return a single project by ID', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject._id.toString()}`)
        .set(getAuthHeaders(authToken));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('project');
      expect(response.body.data.project.name).toBe('Single Project Test');
    });

    it('should return 404 for non-existent project', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/projects/${fakeId}`)
        .set(getAuthHeaders(authToken));

      expect(response.status).toBe(404);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get(`/api/projects/${testProject._id.toString()}`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/projects/:id', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await createTestProject(testUser._id.toString(), {
        name: 'Update Test Project',
        description: 'Original description',
      });
    });

    it('should update project with valid data', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/projects/${testProject._id.toString()}`)
        .set(getAuthHeaders(authToken))
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.project.name).toBe(updateData.name);
      expect(response.body.data.project.description).toBe(updateData.description);
    });

    it('should reject update with invalid phase', async () => {
      const updateData = {
        currentPhase: 'InvalidPhase',
      };

      const response = await request(app)
        .put(`/api/projects/${testProject._id.toString()}`)
        .set(getAuthHeaders(authToken))
        .send(updateData);

      expect(response.status).toBe(400);
    });

    it('should reject update without authentication', async () => {
      const updateData = {
        name: 'Unauthorized Update',
      };

      const response = await request(app)
        .put(`/api/projects/${testProject._id.toString()}`)
        .send(updateData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await createTestProject(testUser._id.toString(), {
        name: 'Delete Test Project',
      });
    });

    it('should delete project successfully', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject._id.toString()}`)
        .set(getAuthHeaders(authToken));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);

      // Verify project is deleted
      const deletedProject = await Project.findById(testProject._id);
      expect(deletedProject).toBeNull();
    });

    it('should reject delete without authentication', async () => {
      const response = await request(app).delete(`/api/projects/${testProject._id.toString()}`);

      expect(response.status).toBe(401);
    });
  });
});
