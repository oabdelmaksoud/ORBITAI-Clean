/**
 * Agent Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import agentRoutes from '../../routes/agent.routes.js';
import { authenticateToken } from '../../middleware/auth.js';

// Mock authentication middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

// Mock feature check middleware
vi.mock('../../middleware/featureCheck.js', () => ({
  checkFeatureAccess: vi.fn(() => (req, res, next) => next()),
}));

// Mock validator middleware
vi.mock('../../middleware/validate.js', () => ({
  validate: vi.fn(() => (req, res, next) => next()),
}));

// Mock the Project model
vi.mock('../../models/Project.model.js', () => ({
  Project: {
    findOne: vi.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/api/agents', agentRoutes);

describe('Agent Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/agents/execute', () => {
    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/agents/execute')
        .send({ agentId: 'agent-1', taskId: 'task-1' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 when agentId is missing', async () => {
      const response = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'proj-1', taskId: 'task-1' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 when taskId is missing', async () => {
      const response = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'proj-1', agentId: 'agent-1' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 404 when project does not exist', async () => {
      const { Project } = await import('../../models/Project.model.js');
      (Project.findOne as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'nonexistent', agentId: 'agent-1', taskId: 'task-1' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 404 when agent is not found in project', async () => {
      const { Project } = await import('../../models/Project.model.js');
      (Project.findOne as any).mockResolvedValueOnce({
        _id: 'proj-1',
        agents: [],
        tasks: []
      });

      const response = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'proj-1', agentId: 'missing-agent', taskId: 'task-1' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 404 when task is not found in project', async () => {
      const { Project } = await import('../../models/Project.model.js');
      (Project.findOne as any).mockResolvedValueOnce({
        _id: 'proj-1',
        agents: [{ id: 'agent-1', role: 'dev', name: 'Dev Agent' }],
        tasks: []
      });

      const response = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'proj-1', agentId: 'agent-1', taskId: 'missing-task' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return redirect info when project, agent, and task exist', async () => {
      const { Project } = await import('../../models/Project.model.js');
      (Project.findOne as any).mockResolvedValueOnce({
        _id: 'proj-1',
        agents: [{ id: 'agent-1', role: 'dev', name: 'Dev Agent' }],
        tasks: [{ id: 'task-1', title: 'Build feature', status: 'Pending', assignedTo: 'dev' }]
      });

      const response = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'proj-1', agentId: 'agent-1', taskId: 'task-1' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('redirect');
      expect(response.body.data.redirect).toHaveProperty('endpoint', '/api/gemini/execute-task');
    });
  });

  describe('GET /api/agents/status/:agentId', () => {
    it('should return 400 when projectId query param is missing', async () => {
      const response = await request(app)
        .get('/api/agents/status/agent-1')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 404 when project does not belong to user', async () => {
      const { Project } = await import('../../models/Project.model.js');
      (Project.findOne as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/agents/status/agent-1?projectId=proj-1')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return agent status when found', async () => {
      const { Project } = await import('../../models/Project.model.js');
      (Project.findOne as any).mockResolvedValueOnce({
        _id: 'proj-1',
        agents: [{ id: 'agent-1', role: 'dev', name: 'Dev Agent', description: 'Developer' }],
        tasks: [{ id: 'task-1', assignedTo: 'dev', status: 'In Progress' }]
      });

      const response = await request(app)
        .get('/api/agents/status/agent-1?projectId=proj-1')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('agentId', 'agent-1');
      expect(response.body.data).toHaveProperty('status', 'active');
      expect(response.body.data.tasks).toHaveProperty('active', 1);
    });
  });
});

