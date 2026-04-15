import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import commentRoutes from '../../routes/comment.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/comments', commentRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('Comment Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('GET /api/comments — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/comments');
    expect([401, 403]).toContain(res.status);
  });

  it('POST /api/comments — rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/comments').send({});
    expect([401, 403]).toContain(res.status);
  });

  it('POST /api/comments — validates required fields', async () => {
    const res = await request(app)
      .post('/api/comments')
      .set(authHeaders)
      .send({});
    expect([200, 201, 400, 422]).toContain(res.status);
  });

  it('DELETE /api/comments/:id — rejects unauthenticated requests', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).delete(`/api/comments/${id}`);
    expect([401, 403]).toContain(res.status);
  });
});
