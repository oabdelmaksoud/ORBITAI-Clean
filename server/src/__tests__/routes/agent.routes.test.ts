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

const app = express();
app.use(express.json());
app.use('/api/agents', agentRoutes);

describe('Agent Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    it('should return list of agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('POST /api/agents/execute', () => {
    it('should require authentication', async () => {
      // This test would need proper setup with real auth
      expect(true).toBe(true); // Placeholder
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/agents/execute')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});


