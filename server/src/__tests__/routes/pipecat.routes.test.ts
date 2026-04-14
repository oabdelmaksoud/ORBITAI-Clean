/**
 * Pipecat Voice Routes Tests
 * Covers session lifecycle: health, create, get, update, transcript, end.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import pipcatRoutes from '../../routes/pipecat.routes.js';
import { pipecatBridgeService } from '../../services/pipecatBridge.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'user-abc', email: 'user@example.com' };
    next();
  }),
}));

vi.mock('../../middleware/validate.js', () => ({
  validate: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../services/pipecatBridge.service.js', () => ({
  pipecatBridgeService: {
    isEnabled: vi.fn(() => true),
    getServiceUrl: vi.fn(() => 'http://localhost:8000'),
    getWebSocketUrl: vi.fn(() => 'ws://localhost:8000/ws/session-1'),
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    endSession: vi.fn(),
    addTranscript: vi.fn(),
  },
}));

vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: { getApiKey: vi.fn(async () => 'sk-test-key') },
}));

// ── App setup ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/pipecat', pipcatRoutes);

// Simple error handler so we see 4xx/5xx bodies
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/pipecat/health', () => {
  it('returns enabled status when service is enabled', async () => {
    const res = await request(app).get('/api/pipecat/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.enabled).toBe(true);
    expect(res.body.serviceUrl).toBe('http://localhost:8000');
  });

  it('returns disabled status when service is disabled', async () => {
    (pipecatBridgeService.isEnabled as any).mockReturnValueOnce(false);
    const res = await request(app).get('/api/pipecat/health').expect(200);
    expect(res.body.enabled).toBe(false);
  });
});

describe('POST /api/pipecat/session/create', () => {
  beforeEach(() => {
    (pipecatBridgeService.createSession as any).mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-abc',
      conversationId: 'conv-1',
      metadata: {},
      transcripts: [],
      createdAt: new Date(),
    });
  });

  it('creates a session and returns wsUrl', async () => {
    const res = await request(app)
      .post('/api/pipecat/session/create')
      .send({ conversationId: 'conv-1' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBe('session-1');
    expect(res.body.data.wsUrl).toContain('ws://');
  });

  it('returns 503 when service is disabled', async () => {
    (pipecatBridgeService.isEnabled as any).mockReturnValueOnce(false);
    const res = await request(app)
      .post('/api/pipecat/session/create')
      .send({})
      .expect(503);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/pipecat/session/:id', () => {
  it('returns session data when found', async () => {
    (pipecatBridgeService.getSession as any).mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-abc',
      conversationId: 'conv-1',
      metadata: {},
      apiKey: 'sk-test-key',
    });

    const res = await request(app).get('/api/pipecat/session/session-1').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBe('session-1');
  });

  it('returns 404 when session not found', async () => {
    (pipecatBridgeService.getSession as any).mockResolvedValue(null);
    const res = await request(app).get('/api/pipecat/session/nonexistent').expect(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/pipecat/session/:id/update', () => {
  it('updates session successfully', async () => {
    (pipecatBridgeService.getSession as any).mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-abc',
    });
    (pipecatBridgeService.updateSession as any).mockResolvedValue({
      sessionId: 'session-1',
      conversationId: 'conv-updated',
      metadata: { updated: true },
    });

    const res = await request(app)
      .post('/api/pipecat/session/session-1/update')
      .send({ conversationId: 'conv-updated', metadata: { updated: true } })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.conversationId).toBe('conv-updated');
  });

  it('returns 403 when session belongs to different user', async () => {
    (pipecatBridgeService.getSession as any).mockResolvedValue({
      sessionId: 'session-1',
      userId: 'other-user',
    });

    const res = await request(app)
      .post('/api/pipecat/session/session-1/update')
      .send({ metadata: {} })
      .expect(403);

    expect(res.body.success).toBe(false);
  });
});

describe('DELETE /api/pipecat/session/:id', () => {
  it('ends session successfully', async () => {
    (pipecatBridgeService.getSession as any).mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-abc',
    });
    (pipecatBridgeService.endSession as any).mockResolvedValue(undefined);

    const res = await request(app).delete('/api/pipecat/session/session-1').expect(200);
    expect(res.body.success).toBe(true);
    expect(pipecatBridgeService.endSession).toHaveBeenCalledWith('session-1');
  });

  it('returns 404 when session not found', async () => {
    (pipecatBridgeService.getSession as any).mockResolvedValue(null);
    const res = await request(app).delete('/api/pipecat/session/ghost').expect(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/pipecat/session/:id/transcript', () => {
  it('adds transcript successfully', async () => {
    (pipecatBridgeService.addTranscript as any).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/pipecat/session/session-1/transcript')
      .send({ userText: 'Hello', aiText: 'Hi there!' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(pipecatBridgeService.addTranscript).toHaveBeenCalledWith('session-1', 'Hello', 'Hi there!');
  });

  it('returns 400 when userText or aiText is missing', async () => {
    const res = await request(app)
      .post('/api/pipecat/session/session-1/transcript')
      .send({ userText: 'Only user text' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
