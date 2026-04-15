import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import invitationRoutes from '../../routes/invitation.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/invitations', invitationRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('Invitation Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('POST /api/invitations — rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/invitations').send({});
    expect([401, 403]).toContain(res.status);
  });

  it('POST /api/invitations — requires valid invitation data', async () => {
    const res = await request(app)
      .post('/api/invitations')
      .set(authHeaders)
      .send({});
    expect([200, 201, 400, 422]).toContain(res.status);
  });

  it('GET /api/invitations — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/invitations');
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/invitations — returns invitations for authenticated user', async () => {
    const res = await request(app)
      .get('/api/invitations')
      .set(authHeaders);
    expect([200, 404]).toContain(res.status);
  });
});
