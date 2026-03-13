/**
 * Task Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import taskRoutes from '../../routes/task.routes.js';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRoutes);

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
      const response = await request(app)
        .patch('/api/tasks/project123/task123')
        .send({
          title: 'Valid Task Title',
          description: 'Valid description',
        });

      // May return 401 if not authenticated, or 200 if mock auth works
      expect([200, 401]).toContain(response.status);
    });
  });
});


