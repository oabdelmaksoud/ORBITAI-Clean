/**
 * Agent Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import agentRoutes from '../../routes/agent.routes.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  // agent.routes also imports denyGuests; mock it as a pass-through.
  denyGuests: vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../middleware/featureCheck.js', () => ({
  checkFeatureAccess: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../middleware/validate.js', () => ({
  validate: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../validators/agent.validator.js', () => ({
  executeAgentTaskSchema: {},
}));

// The /execute handler runs the agent via agentExecutionEngine.runAgent, which
// internally resolves API keys from the DB. Mock the engine so no DB/LLM is hit.
vi.mock('../../services/agentExecutionEngine.service.js', () => ({
  agentExecutionEngine: {
    runAgent: vi.fn(),
    runSequence: vi.fn(),
  },
}));

const mockProject = {
  _id: 'project-1',
  userId: 'test-user-id',
  lastModified: new Date(),
  createdAt: new Date(),
  agents: [
    { id: 'agent-1', role: 'Developer', name: 'Dev Agent', description: 'Writes code' },
    { id: 'agent-2', role: 'Designer', name: 'Design Agent', description: 'Designs UI' },
  ],
  tasks: [
    { id: 'task-1', title: 'Build feature', status: 'In Progress', assignedTo: 'Developer' },
    { id: 'task-2', title: 'Write tests', status: 'Pending', assignedTo: 'Developer' },
    { id: 'task-3', title: 'Design mockup', status: 'Completed', assignedTo: 'Designer' },
  ],
};

vi.mock('../../models/Project.model.js', () => ({
  Project: {
    findOne: vi.fn(),
  },
}));

import { Project } from '../../models/Project.model.js';
import { agentExecutionEngine } from '../../services/agentExecutionEngine.service.js';

// ── App setup ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/agents', agentRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Agent Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /api/agents/execute ──────────────────────────────────────────

  describe('POST /api/agents/execute', () => {
    it('returns 400 when required fields are missing', async () => {
      (Project.findOne as any).mockResolvedValue(null);

      const res = await request(app).post('/api/agents/execute').send({}).expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/required/i);
    });

    it('returns 404 when project does not belong to the user', async () => {
      (Project.findOne as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'project-x', agentId: 'agent-1', taskId: 'task-1' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/project not found/i);
    });

    it('returns 404 when agent is not found in the project', async () => {
      (Project.findOne as any).mockResolvedValue({ ...mockProject, agents: [] });

      const res = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'project-1', agentId: 'missing-agent', taskId: 'task-1' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/agent not found/i);
    });

    it('returns 404 when task is not found in the project', async () => {
      (Project.findOne as any).mockResolvedValue({ ...mockProject, tasks: [] });

      const res = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'project-1', agentId: 'agent-1', taskId: 'missing-task' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/task not found/i);
    });

    it('runs the agent and returns its output when project/agent/task found', async () => {
      // The /execute handler now actually runs the agent (dim 8) instead of
      // redirecting the client to another endpoint, so assert the run result.
      (Project.findOne as any).mockResolvedValue(mockProject);
      vi.mocked(agentExecutionEngine.runAgent).mockResolvedValue({
        agentId: 'agent-1',
        role: 'Developer',
        output: 'done',
        modelUsed: 'gemini-2.0',
        success: true,
      } as any);

      const res = await request(app)
        .post('/api/agents/execute')
        .send({ projectId: 'project-1', agentId: 'agent-1', taskId: 'task-1' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.output).toBe('done');
      expect(res.body.data.modelUsed).toBe('gemini-2.0');
      expect(res.body.data.agent.id).toBe('agent-1');
      expect(res.body.data.task.id).toBe('task-1');
    });
  });

  // ── GET /api/agents/status/:agentId ──────────────────────────────────

  describe('GET /api/agents/status/:agentId', () => {
    it('returns 400 when projectId query param is missing', async () => {
      const res = await request(app).get('/api/agents/status/agent-1').expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/project id is required/i);
    });

    it('returns 404 when project is not found', async () => {
      (Project.findOne as any).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/agents/status/agent-1')
        .query({ projectId: 'project-1' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 404 when agent is not in the project', async () => {
      (Project.findOne as any).mockResolvedValue({ ...mockProject, agents: [] });

      const res = await request(app)
        .get('/api/agents/status/agent-1')
        .query({ projectId: 'project-1' })
        .expect(404);

      expect(res.body.message).toMatch(/agent not found/i);
    });

    it('returns agent status with task counts when found', async () => {
      (Project.findOne as any).mockResolvedValue(mockProject);

      const res = await request(app)
        .get('/api/agents/status/agent-1')
        .query({ projectId: 'project-1' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.agentId).toBe('agent-1');
      expect(res.body.data.status).toBe('active'); // Developer has 1 In Progress task
      expect(res.body.data.tasks.total).toBe(2); // Developer has 2 tasks
      expect(res.body.data.tasks.active).toBe(1);
      expect(res.body.data.tasks.pending).toBe(1);
    });

    it('reports idle status when agent has no in-progress tasks', async () => {
      (Project.findOne as any).mockResolvedValue(mockProject);

      const res = await request(app)
        .get('/api/agents/status/agent-2')
        .query({ projectId: 'project-1' })
        .expect(200);

      expect(res.body.data.status).toBe('idle'); // Designer has only Completed tasks
      expect(res.body.data.tasks.completed).toBe(1);
    });
  });
});
