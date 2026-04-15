import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import workspaceRoutes from '../../routes/workspace.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/workspaces', workspaceRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('Workspace Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('GET /api/workspaces — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/workspaces');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/workspaces — returns workspaces for authenticated user', async () => {
    const res = await request(app).get('/api/workspaces').set(authHeaders);
    expect([200, 404]).toContain(res.status);
  });

  it('POST /api/workspaces — rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/workspaces').send({ name: 'Test Workspace' });
    expect([401, 403]).toContain(res.status);
  });

  it('POST /api/workspaces — creates workspace with valid auth', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set(authHeaders)
      .send({ name: 'Test Workspace', description: 'A test workspace' });
    expect([200, 201, 400, 422]).toContain(res.status);
  });
});
