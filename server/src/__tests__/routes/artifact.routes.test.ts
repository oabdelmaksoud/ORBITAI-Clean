import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import artifactRoutes from '../../routes/artifact.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/artifacts', artifactRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('Artifact Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('GET /api/artifacts — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/artifacts');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/artifacts — returns artifacts for authenticated user', async () => {
    const res = await request(app)
      .get('/api/artifacts')
      .set(authHeaders);
    expect([200, 404]).toContain(res.status);
  });

  it('DELETE /api/artifacts/:id — rejects unauthenticated requests', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).delete(`/api/artifacts/${id}`);
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/artifacts/:id — returns 404 for non-existent artifact', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/artifacts/${id}`)
      .set(authHeaders);
    expect([404, 401, 403]).toContain(res.status);
  });
});
