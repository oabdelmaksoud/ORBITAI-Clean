import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import llmRoutes from '../../routes/llm.routes.js';
import { createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';

import '../setup/mongoSetup.js';

const app = express();
app.use(express.json());
app.use('/api/llm', llmRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

describe('LLM Routes', () => {
  let authHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await createTestUser();
    authHeaders = getAuthHeaders(user.token);
  });

  it('POST /api/llm/chat/stream — rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/llm/chat/stream')
      .send({ message: 'hello' });
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/llm/models — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/llm/models');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('POST /api/llm/chat/stream — requires message field', async () => {
    const res = await request(app)
      .post('/api/llm/chat/stream')
      .set(authHeaders)
      .send({});
    expect([400, 422, 500]).toContain(res.status);
  });
});
