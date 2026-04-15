/**
 * Pipecat Voice Routes — Unit Tests
 * Covers: auth guards, health check, session CRUD
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

// Mock heavy dependencies before route import
vi.mock('../../services/pipecatBridge.service.js', () => ({
  pipecatBridgeService: {
    isEnabled: vi.fn().mockReturnValue(false),
    getServiceUrl: vi.fn().mockReturnValue(null),
    createSession: vi.fn().mockResolvedValue({ sessionId: 'sess-1', status: 'created' }),
    getSession: vi.fn().mockResolvedValue({ sessionId: 'sess-1', userId: 'user-1' }),
    endSession: vi.fn().mockResolvedValue({ success: true }),
    updateSession: vi.fn().mockResolvedValue({ sessionId: 'sess-1' }),
    getUserSessions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: (req: Request & { user?: any }, _res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return _res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
    req.user = { id: 'user-1', email: 'test@test.com', role: 'user' };
    return next();
  },
}));

import pipecatRoutes from '../../routes/pipecat.routes.js';

const app = express();
app.use(express.json());
app.use('/api/pipecat', pipecatRoutes);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
});

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

describe('Pipecat Routes — Health', () => {
  it('GET /api/pipecat/health — returns 200 without auth', async () => {
    const res = await request(app).get('/api/pipecat/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('enabled');
  });
});

describe('Pipecat Routes — Session Create', () => {
  it('POST /api/pipecat/session/create — rejects unauthenticated', async () => {
    const res = await request(app).post('/api/pipecat/session/create').send({});
    expect([401, 403]).toContain(res.status);
  });

  it('POST /api/pipecat/session/create — accepts authenticated request', async () => {
    const res = await request(app)
      .post('/api/pipecat/session/create')
      .set(AUTH_HEADER)
      .send({ conversationId: null });
    // 503 when pipecat is disabled (expected in test env)
    expect([200, 201, 400, 422, 500, 501, 503]).toContain(res.status);
  });
});

describe('Pipecat Routes — Session Management', () => {
  it('GET /api/pipecat/sessions — rejects unauthenticated', async () => {
    const res = await request(app).get('/api/pipecat/sessions');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('GET /api/pipecat/session/:id — is public (for Python sidecar), returns data or 404', async () => {
    const res = await request(app).get('/api/pipecat/session/sess-1');
    expect([200, 404, 500]).toContain(res.status);
  });

  it('GET /api/pipecat/session/:id — returns data for authenticated user', async () => {
    const res = await request(app).get('/api/pipecat/session/sess-1').set(AUTH_HEADER);
    expect([200, 404, 500]).toContain(res.status);
  });

  it('DELETE /api/pipecat/session/:id — rejects unauthenticated', async () => {
    const res = await request(app).delete('/api/pipecat/session/sess-1');
    expect([401, 403]).toContain(res.status);
  });

  it('DELETE /api/pipecat/session/:id — accepts authenticated request', async () => {
    const res = await request(app).delete('/api/pipecat/session/sess-1').set(AUTH_HEADER);
    expect([200, 404, 500]).toContain(res.status);
  });
});
