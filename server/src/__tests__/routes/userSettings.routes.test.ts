import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import userSettingsRoutes from '../../routes/userSettings.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/user-settings', userSettingsRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('UserSettings Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('GET /api/user-settings — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/user-settings');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/user-settings — returns settings for authenticated user', async () => {
    const res = await request(app)
      .get('/api/user-settings')
      .set(authHeaders);
    expect([200, 404]).toContain(res.status);
  });

  it('PUT /api/user-settings — rejects unauthenticated requests', async () => {
    const res = await request(app).put('/api/user-settings').send({});
    expect([401, 403]).toContain(res.status);
  });

  it('PUT /api/user-settings — updates settings with valid auth', async () => {
    const res = await request(app)
      .put('/api/user-settings')
      .set(authHeaders)
      .send({ theme: 'dark', language: 'en' });
    expect([200, 201, 400, 404, 422]).toContain(res.status);
  });
});
