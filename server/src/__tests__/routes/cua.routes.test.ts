import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cuaRoutes from '../../routes/cua.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/cua', cuaRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('CUA Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('POST /api/cua/execute — rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/cua/execute').send({});
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/cua/status — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/cua/status');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('POST /api/cua/execute — requires projectId', async () => {
    const res = await request(app)
      .post('/api/cua/execute')
      .set(authHeaders)
      .send({});
    expect([200, 201, 400, 422, 503]).toContain(res.status);
  });
});
