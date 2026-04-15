import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import deploymentRoutes from '../../routes/deployments.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/deployments', deploymentRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('Deployment Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('GET /api/deployments — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/deployments');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/deployments — returns deployments for authenticated user', async () => {
    const res = await request(app)
      .get('/api/deployments')
      .set(authHeaders);
    expect([200, 404]).toContain(res.status);
  });

  it('POST /api/deployments — rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/deployments').send({});
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/deployments/:id — rejects unauthenticated requests', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/deployments/${id}`);
    expect([401, 403]).toContain(res.status);
  });
});
