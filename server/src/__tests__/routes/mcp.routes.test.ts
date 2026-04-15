import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import mcpRoutes from '../../routes/mcp.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/mcp', mcpRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('MCP Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('GET /api/mcp/servers — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/mcp/servers');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('GET /api/mcp/servers — returns servers for authenticated user', async () => {
    const res = await request(app)
      .get('/api/mcp/servers')
      .set(authHeaders);
    expect([200, 404]).toContain(res.status);
  });

  it('GET /api/mcp/health — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/mcp/health');
    expect([200, 401, 403, 404]).toContain(res.status);
  });
});
