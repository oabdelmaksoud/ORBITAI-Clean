/**
 * Agent Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock authentication middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = { id: 'test-user-id', email: 'test@example.com', plan: 'Free', role: 'user' };
    next();
  }),
  AuthRequest: {},
}));

// Mock feature check middleware
vi.mock('../../middleware/featureCheck.js', () => ({
  checkFeatureAccess: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  FeatureRequest: {},
}));

// Mock validate middleware to pass through
vi.mock('../../middleware/validate.js', () => ({
  validate: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

// Mock Project model
vi.mock('../../models/Project.model.js', () => ({
  Project: {
    findOne: vi.fn().mockResolvedValue(null),
  },
}));

const { default: agentRoutes } = await import('../../routes/agent.routes.js');

const app = express();
app.use(express.json());
app.use('/api/agents', agentRoutes);

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

describe('Agent Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/agents/execute', () => {
    it('should require projectId, agentId, and taskId', async () => {
      const response = await request(app)
        .post('/api/agents/execute')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 404 when project is not found', async () => {
      const response = await request(app)
        .post('/api/agents/execute')
        .send({
          projectId: '507f1f77bcf86cd799439011',
          agentId: 'agent-1',
          taskId: 'task-1',
        })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
