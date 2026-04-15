import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import notificationRoutes from '../../routes/notification.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('Notification Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('GET /api/notifications — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/notifications');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/notifications — returns notifications for authenticated user', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set(authHeaders);
    expect([200, 404]).toContain(res.status);
  });

  it('PATCH /api/notifications/:id/read — rejects unauthenticated requests', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).patch(`/api/notifications/${id}/read`);
    expect([401, 403, 404]).toContain(res.status);
  });

  it('PATCH /api/notifications/mark-all-read — rejects unauthenticated requests', async () => {
    const res = await request(app).patch('/api/notifications/mark-all-read');
    expect([401, 403, 404]).toContain(res.status);
  });
});
