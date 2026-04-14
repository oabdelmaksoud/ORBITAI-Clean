/**
 * PipecatBridge Service Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../models/VoiceSession.model.js', () => ({
  VoiceSessionModel: {
    create: vi.fn(),
    updateOne: vi.fn(() => ({ exec: vi.fn().mockResolvedValue({}) })),
    find: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../../models/ChatConversation.model.js', () => ({
  ChatConversation: {
    findById: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    getApiKey: vi.fn().mockResolvedValue('sk-test-key'),
  },
}));

vi.mock('../../config/env.js', () => ({
  config: { port: 3001 },
}));

import { pipecatBridgeService } from '../../services/pipecatBridge.service.js';
import { VoiceSessionModel } from '../../models/VoiceSession.model.js';
import { ChatConversation } from '../../models/ChatConversation.model.js';

describe('PipecatBridge Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset in-memory sessions between tests by ending any lingering ones
  });

  // ── isEnabled / getServiceUrl ────────────────────────────────────────────────
  describe('isEnabled', () => {
    it('should return true by default (PIPECAT_ENABLED not set to false)', () => {
      expect(pipecatBridgeService.isEnabled()).toBe(true);
    });
  });

  describe('getServiceUrl', () => {
    it('should return http URL using host and port', () => {
      const url = pipecatBridgeService.getServiceUrl();
      expect(url).toMatch(/^http:\/\//);
    });
  });

  describe('getWebSocketUrl', () => {
    it('should build ws URL with session id', () => {
      const url = pipecatBridgeService.getWebSocketUrl('sess-1', { userId: 'u1' });
      expect(url).toContain('sess-1');
      expect(url).toContain('user_id=u1');
    });

    it('should include conversationId and apiKey when provided', () => {
      const url = pipecatBridgeService.getWebSocketUrl('sess-2', {
        conversationId: 'conv-1',
        apiKey: 'sk-abc',
      });
      expect(url).toContain('conversation_id=conv-1');
      expect(url).toContain('api_key=sk-abc');
    });
  });

  // ── createSession ────────────────────────────────────────────────────────────
  describe('createSession', () => {
    it('should return a session with a sessionId', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});

      const session = await pipecatBridgeService.createSession({ userId: 'user-1' });

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user-1');
      expect(session.transcripts).toEqual([]);
    });

    it('should persist session to MongoDB', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});

      await pipecatBridgeService.createSession({ userId: 'user-2', conversationId: 'conv-1' });

      expect(VoiceSessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', conversationId: 'conv-1', status: 'active' })
      );
    });

    it('should still return session even if MongoDB save fails', async () => {
      (VoiceSessionModel.create as any).mockRejectedValue(new Error('mongo down'));

      const session = await pipecatBridgeService.createSession({ userId: 'user-3' });

      expect(session.sessionId).toBeDefined();
    });

    it('should store session in in-memory map (retrievable via getSession)', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});

      const created = await pipecatBridgeService.createSession({ userId: 'user-4' });
      const fetched = await pipecatBridgeService.getSession(created.sessionId);

      expect(fetched).not.toBeNull();
      expect(fetched!.sessionId).toBe(created.sessionId);
    });
  });

  // ── getSession ───────────────────────────────────────────────────────────────
  describe('getSession', () => {
    it('should return null for unknown session id', async () => {
      const result = await pipecatBridgeService.getSession('nonexistent-id');
      expect(result).toBeNull();
    });

    it('should include apiKey in returned session', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});
      const created = await pipecatBridgeService.createSession({ userId: 'user-5' });

      const session = await pipecatBridgeService.getSession(created.sessionId);

      expect((session as any).apiKey).toBe('sk-test-key');
    });
  });

  // ── addTranscript ────────────────────────────────────────────────────────────
  describe('addTranscript', () => {
    it('should add transcript to in-memory session', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});
      const created = await pipecatBridgeService.createSession({ userId: 'user-6' });

      pipecatBridgeService.addTranscript(created.sessionId, 'Hello', 'Hi');

      const session = await pipecatBridgeService.getSession(created.sessionId);
      expect(session!.transcripts).toHaveLength(1);
      expect(session!.transcripts[0].userText).toBe('Hello');
    });

    it('should warn but not throw for unknown session', () => {
      expect(() => pipecatBridgeService.addTranscript('no-session', 'x', 'y')).not.toThrow();
    });
  });

  // ── endSession ───────────────────────────────────────────────────────────────
  describe('endSession', () => {
    it('should remove session from in-memory map', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});
      (VoiceSessionModel.updateOne as any).mockResolvedValue({});
      const created = await pipecatBridgeService.createSession({ userId: 'user-7' });

      await pipecatBridgeService.endSession(created.sessionId);

      const result = await pipecatBridgeService.getSession(created.sessionId);
      expect(result).toBeNull();
    });

    it('should mark session as ended in MongoDB', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});
      (VoiceSessionModel.updateOne as any).mockResolvedValue({});
      const created = await pipecatBridgeService.createSession({ userId: 'user-8' });

      await pipecatBridgeService.endSession(created.sessionId);

      expect(VoiceSessionModel.updateOne).toHaveBeenCalledWith(
        { sessionId: created.sessionId },
        expect.objectContaining({ $set: expect.objectContaining({ status: 'ended' }) })
      );
    });

    it('should save transcripts to ChatConversation when conversationId exists', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});
      (VoiceSessionModel.updateOne as any).mockResolvedValue({});
      const mockConversation = {
        messages: [],
        metadata: {},
        save: vi.fn().mockResolvedValue({}),
      };
      (ChatConversation.findById as any).mockResolvedValue(mockConversation);

      const created = await pipecatBridgeService.createSession({
        userId: 'user-9',
        conversationId: 'conv-99',
      });
      pipecatBridgeService.addTranscript(created.sessionId, 'Question', 'Answer');

      await pipecatBridgeService.endSession(created.sessionId);

      expect(mockConversation.save).toHaveBeenCalled();
      expect(mockConversation.messages.length).toBeGreaterThan(0);
    });

    it('should not throw when ending a non-existent session', async () => {
      await expect(pipecatBridgeService.endSession('ghost-session')).resolves.toBeUndefined();
    });
  });

  // ── getSessionsForUser ───────────────────────────────────────────────────────
  describe('getSessionsForUser', () => {
    it('should return sessions from in-memory cache for known user', async () => {
      (VoiceSessionModel.create as any).mockResolvedValue({});
      await pipecatBridgeService.createSession({ userId: 'user-10' });

      const sessions = await pipecatBridgeService.getSessionsForUser('user-10');

      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.every(s => s.userId === 'user-10')).toBe(true);
    });

    it('should fall back to MongoDB when no in-memory sessions exist', async () => {
      (VoiceSessionModel.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { sessionId: 'db-sess', userId: 'user-11', conversationId: null, createdAt: new Date(), metadata: {}, transcripts: [] },
        ]),
      });

      const sessions = await pipecatBridgeService.getSessionsForUser('user-11');

      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionId).toBe('db-sess');
    });

    it('should return empty array when MongoDB also fails', async () => {
      (VoiceSessionModel.find as any).mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error('mongo error')),
      });

      const sessions = await pipecatBridgeService.getSessionsForUser('user-no-sessions');

      expect(sessions).toEqual([]);
    });
  });

  // ── cleanupOldSessions ───────────────────────────────────────────────────────
  describe('cleanupOldSessions', () => {
    it('should delete expired ended sessions from MongoDB', async () => {
      (VoiceSessionModel.deleteMany as any).mockResolvedValue({ deletedCount: 3 });

      await pipecatBridgeService.cleanupOldSessions(0);

      expect(VoiceSessionModel.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ended' })
      );
    });
  });
});
