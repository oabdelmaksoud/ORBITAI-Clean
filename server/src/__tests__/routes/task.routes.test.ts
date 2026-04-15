/**
 * Task Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate.js';
import { updateTaskSchema } from '../../validators/task.validator.js';

// Test validation directly using a minimal express app (without auth middleware)
const validationApp = express();
validationApp.use(express.json());
validationApp.patch('/api/tasks/:projectId/:taskId', validate(updateTaskSchema), (_req: Request, res: Response) => {
  res.json({ success: true });
});
validationApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
    },
  });
});

describe('Task Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/tasks/:projectId/:taskId', () => {
    it('should validate task update schema', async () => {
      const response = await request(validationApp)
        .patch('/api/tasks/project123/task123')
        .send({
          title: 'A', // Too short - should fail validation
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should accept valid task update', async () => {
      const response = await request(validationApp)
        .patch('/api/tasks/project123/task123')
        .send({
          title: 'Valid Task Title',
          description: 'Valid description',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
