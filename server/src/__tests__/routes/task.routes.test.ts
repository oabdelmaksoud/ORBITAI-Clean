/**
 * Task Routes Integration Tests
 *
 * Auth, the Project model, and autoCompletionService are mocked, and the
 * shared errorHandler is mounted so AppError responses are formatted — so
 * these tests run with no DB and no real token.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Pass-through auth so the validation middleware (which runs after auth) is reached.
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
    next();
  }),
  denyGuests: vi.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock the Project model so the handler never touches MongoDB.
vi.mock('../../models/Project.model.js', () => ({
  Project: {
    findOne: vi.fn(),
  },
}));

// Mock autoCompletion side-effect.
vi.mock('../../services/autoCompletion.service.js', () => ({
  autoCompletionService: {
    checkAndCompleteProject: vi.fn().mockResolvedValue(undefined),
  },
}));

import taskRoutes from '../../routes/task.routes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { Project } from '../../models/Project.model.js';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRoutes);
app.use(errorHandler);

describe('Task Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/tasks/:projectId/:taskId', () => {
    it('should validate task update schema', async () => {
      const response = await request(app)
        .patch('/api/tasks/project123/task123')
        .send({
          title: 'A', // Too short - should fail validation
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should accept valid task update', async () => {
      vi.mocked(Project.findOne).mockResolvedValue({
        tasks: [{ id: 'task123', title: 'Old', status: 'In Progress' }],
        lastModified: new Date(),
        save: vi.fn().mockResolvedValue(true),
      } as any);

      const response = await request(app).patch('/api/tasks/project123/task123').send({
        title: 'Valid Task Title',
        description: 'Valid description',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
});
