import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import projectRoutes from '../../routes/project.routes.js';
import { authenticateToken } from '../../middleware/auth.js';
import { createTestUser, createTestProject, getAuthHeaders } from '../helpers/testHelpers.js';
import { Project } from '../../models/Project.model.js';
import { User } from '../../models/User.model.js';
import { hasMongo } from '../helpers/testEnv.js';

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

// Requires a reachable MongoDB server (createTestUser/Project persist to mongoose).
describe.skipIf(!hasMongo)('Project Routes', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    testUser = await createTestUser();
    authHeaders = getAuthHeaders(testUser.token);
  });

  describe('GET /api/projects/samples', () => {
    it('should get sample projects without authentication', async () => {
      // Create a sample project
      await Project.create({
        name: 'Sample Project',
        description: 'Sample Description',
        userId: testUser._id,
        isSample: true,
      });

      const response = await request(app).get('/api/projects/samples').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('projects');
      expect(Array.isArray(response.body.data.projects)).toBe(true);
    });

    it('should return empty array when no sample projects exist', async () => {
      const response = await request(app).get('/api/projects/samples').expect(200);

      expect(response.body.data.projects).toEqual([]);
    });
  });

  describe('GET /api/projects', () => {
    it('should require authentication', async () => {
      await request(app).get('/api/projects').expect(401);
    });

    it('should get all projects for authenticated user', async () => {
      // Create projects for the user
      await createTestProject(testUser._id, { name: 'Project 1' });
      await createTestProject(testUser._id, { name: 'Project 2' });

      const response = await request(app).get('/api/projects').set(authHeaders).expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('projects');
      expect(response.body.data.projects).toHaveLength(2);
    });

    it('should not return projects from other users', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });

      // Create project for other user
      await createTestProject(otherUser._id, { name: 'Other Project' });

      // Create project for test user
      await createTestProject(testUser._id, { name: 'My Project' });

      const response = await request(app).get('/api/projects').set(authHeaders).expect(200);

      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.projects[0].name).toBe('My Project');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a single project by id', async () => {
      const project = await createTestProject(testUser._id, { name: 'Test Project' });

      const response = await request(app)
        .get(`/api/projects/${project._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.project).toHaveProperty('_id');
      expect(response.body.data.project.name).toBe('Test Project');
    });

    it('should return 404 for non-existent project', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app).get(`/api/projects/${fakeId}`).set(authHeaders).expect(404);
    });

    it('should not return project from another user', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const project = await createTestProject(otherUser._id);

      await request(app).get(`/api/projects/${project._id}`).set(authHeaders).expect(404);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'New Project',
        description: 'New Description',
        phase: 'planning',
        methodology: 'agile',
      };

      const response = await request(app)
        .post('/api/projects')
        .set(authHeaders)
        .send(projectData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('project');
      expect(response.body.data.project.name).toBe(projectData.name);
      expect(response.body.data.project.description).toBe(projectData.description);
    });

    it('should require authentication', async () => {
      await request(app).post('/api/projects').send({ name: 'Test' }).expect(401);
    });
  });
});
