/**
 * Pipecat Voice Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { AppError } from '../../middleware/errorHandler.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

vi.mock('../../middleware/validate.js', () => ({
  validate: vi.fn(() => (req, res, next) => next()),
}));

vi.mock('../../services/pipecatBridge.service.js', () => ({
  pipecatBridgeService: {
    isEnabled: vi.fn(() => true),
    getServiceUrl: vi.fn(() => 'http://localhost:8000'),
    getWebSocketUrl: vi.fn(() => 'ws://localhost:8000/ws/session-123'),
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    endSession: vi.fn(),
    addTranscript: vi.fn(),
  },
}));

vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    getApiKey: vi.fn(() => Promise.resolve('test-openai-key')),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import pipecatRoutes from '../../routes/pipecat.routes.js';

const app = express();
app.use(express.json());
app.use('/api/pipecat', pipecatRoutes);
app.use((err: any, req: any, res: any, next: any) => {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

describe('Pipecat Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /health ──────────────────────────────────────────────────────────────
  describe('GET /api/pipecat/health', () => {
    it('should return 200 with enabled status', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.isEnabled as any).mockReturnValue(true);
      (pipecatBridgeService.getServiceUrl as any).mockReturnValue('http://localhost:8000');

      const res = await request(app).get('/api/pipecat/health').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.enabled).toBe(true);
    });

    it('should return disabled status when pipecat is off', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.isEnabled as any).mockReturnValue(false);

      const res = await request(app).get('/api/pipecat/health').expect(200);

      expect(res.body.enabled).toBe(false);
    });

    it('should return 500 when health check throws', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.isEnabled as any).mockImplementation(() => { throw new Error('boom'); });

      const res = await request(app).get('/api/pipecat/health').expect(500);

      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /session/create ─────────────────────────────────────────────────────
  describe('POST /api/pipecat/session/create', () => {
    it('should return 200 with session data on success', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.isEnabled as any).mockReturnValue(true);
      (pipecatBridgeService.createSession as any).mockResolvedValue({
        sessionId: 'session-123',
        userId: 'test-user-id',
        conversationId: 'conv-1',
      });
      (pipecatBridgeService.getWebSocketUrl as any).mockReturnValue('ws://localhost:8000/ws/session-123');

      const res = await request(app)
        .post('/api/pipecat/session/create')
        .send({ conversationId: 'conv-1' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBe('session-123');
      expect(res.body.data.wsUrl).toBeDefined();
    });

    it('should return 503 when pipecat is disabled', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.isEnabled as any).mockReturnValue(false);

      const res = await request(app)
        .post('/api/pipecat/session/create')
        .send({})
        .expect(503);

      expect(res.body.success).toBe(false);
    });

    it('should return 500 when createSession throws', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.isEnabled as any).mockReturnValue(true);
      (pipecatBridgeService.createSession as any).mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/pipecat/session/create')
        .send({})
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /session/:id ─────────────────────────────────────────────────────────
  describe('GET /api/pipecat/session/:id', () => {
    it('should return 200 with session data when found', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.getSession as any).mockResolvedValue({
        sessionId: 'session-123',
        userId: 'test-user-id',
        conversationId: 'conv-1',
        metadata: {},
        apiKey: 'sk-test',
      });

      const res = await request(app).get('/api/pipecat/session/session-123').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBe('session-123');
    });

    it('should return 404 when session not found', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.getSession as any).mockResolvedValue(null);

      const res = await request(app).get('/api/pipecat/session/nonexistent').expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ── DELETE /session/:id ──────────────────────────────────────────────────────
  describe('DELETE /api/pipecat/session/:id', () => {
    it('should return 200 and end the session', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.getSession as any).mockResolvedValue({
        sessionId: 'session-123',
        userId: 'test-user-id',
      });
      (pipecatBridgeService.endSession as any).mockResolvedValue(undefined);

      const res = await request(app).delete('/api/pipecat/session/session-123').expect(200);

      expect(res.body.success).toBe(true);
      expect(pipecatBridgeService.endSession).toHaveBeenCalledWith('session-123');
    });

    it('should return 404 when session not found', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.getSession as any).mockResolvedValue(null);

      const res = await request(app).delete('/api/pipecat/session/no-such-session').expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return 403 when session belongs to different user', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.getSession as any).mockResolvedValue({
        sessionId: 'session-123',
        userId: 'other-user',
      });

      const res = await request(app).delete('/api/pipecat/session/session-123').expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /session/:id/transcript ─────────────────────────────────────────────
  describe('POST /api/pipecat/session/:id/transcript', () => {
    it('should return 200 when transcript is added', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.addTranscript as any).mockReturnValue(undefined);

      const res = await request(app)
        .post('/api/pipecat/session/session-123/transcript')
        .send({ userText: 'Hello', aiText: 'Hi there' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(pipecatBridgeService.addTranscript).toHaveBeenCalledWith('session-123', 'Hello', 'Hi there');
    });

    it('should return 400 when userText is missing', async () => {
      const res = await request(app)
        .post('/api/pipecat/session/session-123/transcript')
        .send({ aiText: 'Hi there' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 when aiText is missing', async () => {
      const res = await request(app)
        .post('/api/pipecat/session/session-123/transcript')
        .send({ userText: 'Hello' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /session/:id/update ─────────────────────────────────────────────────
  describe('POST /api/pipecat/session/:id/update', () => {
    it('should return 200 on successful update', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.getSession as any).mockResolvedValue({
        sessionId: 'session-123',
        userId: 'test-user-id',
      });
      (pipecatBridgeService.updateSession as any).mockResolvedValue({
        sessionId: 'session-123',
        conversationId: 'conv-2',
        metadata: { topic: 'AI' },
      });

      const res = await request(app)
        .post('/api/pipecat/session/session-123/update')
        .send({ conversationId: 'conv-2', metadata: { topic: 'AI' } })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.conversationId).toBe('conv-2');
    });

    it('should return 404 when session not found on update', async () => {
      const { pipecatBridgeService } = await import('../../services/pipecatBridge.service.js');
      (pipecatBridgeService.getSession as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/pipecat/session/no-such/update')
        .send({ conversationId: 'conv-2' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });
});
