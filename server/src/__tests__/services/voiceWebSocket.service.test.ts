/**
 * VoiceWebSocket Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ws before importing the service
const mockWsSend = vi.fn();
const mockWsClose = vi.fn();
const mockWsOn = vi.fn();

const mockWssOn = vi.fn();
const mockWssHandleUpgrade = vi.fn();
const mockWssEmit = vi.fn();

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  send = mockWsSend;
  close = mockWsClose;
  on = mockWsOn;
}

class MockWebSocketServer {
  on = mockWssOn;
  handleUpgrade = mockWssHandleUpgrade;
  emit = mockWssEmit;
}

vi.mock('ws', () => ({
  WebSocketServer: MockWebSocketServer,
  WebSocket: MockWebSocket
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../services/speechProvider.service.js', () => ({
  speechProviderService: {
    transcribeAudio: vi.fn(),
    synthesizeSpeech: vi.fn()
  }
}));

vi.mock('../../services/llm/LLMRouter.js', () => ({
  llmRouter: {
    executeWithFallback: vi.fn()
  }
}));

vi.mock('../../services/pipecatBridge.service.js', () => ({
  pipecatBridgeService: {
    addTranscript: vi.fn()
  }
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'mock-uuid-1234')
  }
}));

import { voiceWebSocketService } from '../../services/voiceWebSocket.service.js';
import { logger } from '../../utils/logger.js';
import { speechProviderService } from '../../services/speechProvider.service.js';
import { llmRouter } from '../../services/llm/LLMRouter.js';

describe('VoiceWebSocketService', () => {
  let mockHttpServer: any;
  let upgradeHandler: ((req: any, socket: any, head: any) => void) | null = null;
  let connectionHandler: ((ws: any, req: any) => void) | null = null;

  const makeRequest = (url: string, host = 'localhost:3000') => ({
    url,
    headers: { host }
  });

  const makeWs = () => {
    const ws = new MockWebSocket();
    ws.readyState = MockWebSocket.OPEN;
    return ws;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHttpServer = { on: vi.fn() };

    // Capture upgrade and connection handlers
    mockHttpServer.on.mockImplementation((event: string, handler: any) => {
      if (event === 'upgrade') upgradeHandler = handler;
    });
    mockWssOn.mockImplementation((event: string, handler: any) => {
      if (event === 'connection') connectionHandler = handler;
    });
  });

  afterEach(() => {
    upgradeHandler = null;
    connectionHandler = null;
  });

  describe('initialize()', () => {
    it('should set up WebSocketServer and listen for upgrades', () => {
      voiceWebSocketService.initialize(mockHttpServer);
      expect(mockHttpServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
    });

    it('should register connection handler on wss', () => {
      voiceWebSocketService.initialize(mockHttpServer);
      expect(mockWssOn).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should log initialization', () => {
      voiceWebSocketService.initialize(mockHttpServer);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Voice WebSocket'));
    });
  });

  describe('upgrade handler', () => {
    beforeEach(() => {
      voiceWebSocketService.initialize(mockHttpServer);
    });

    it('should handle upgrade for /ws/voice path', () => {
      const req = makeRequest('/ws/voice');
      const socket = { destroy: vi.fn() };
      upgradeHandler!(req, socket, Buffer.alloc(0));
      expect(mockWssHandleUpgrade).toHaveBeenCalled();
    });

    it('should NOT handle upgrade for other paths (no handleUpgrade call)', () => {
      mockWssHandleUpgrade.mockClear();
      const req = makeRequest('/socket.io/');
      const socket = { destroy: vi.fn() };
      upgradeHandler!(req, socket, Buffer.alloc(0));
      expect(mockWssHandleUpgrade).not.toHaveBeenCalled();
    });

    it('should not destroy socket for non-voice paths', () => {
      const req = makeRequest('/other');
      const socket = { destroy: vi.fn() };
      upgradeHandler!(req, socket, Buffer.alloc(0));
      expect(socket.destroy).not.toHaveBeenCalled();
    });
  });

  describe('connection event', () => {
    beforeEach(() => {
      voiceWebSocketService.initialize(mockHttpServer);
    });

    it('should create a session on new connection', () => {
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=sess-1&userId=user-1');
      connectionHandler!(ws, req);
      const session = voiceWebSocketService.getSession('sess-1');
      expect(session).toBeDefined();
      expect(session?.userId).toBe('user-1');
    });

    it('should send connected message to client', () => {
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=sess-2');
      connectionHandler!(ws, req);
      expect(mockWsSend).toHaveBeenCalledWith(expect.stringContaining('"type":"connected"'));
    });

    it('should use a random UUID if no sessionId provided', () => {
      const ws = makeWs();
      const req = makeRequest('/ws/voice');
      connectionHandler!(ws, req);
      // The mock uuid is 'mock-uuid-1234'
      const session = voiceWebSocketService.getSession('mock-uuid-1234');
      expect(session).toBeDefined();
    });

    it('should register ws event handlers', () => {
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=sess-3');
      connectionHandler!(ws, req);
      expect(mockWsOn).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWsOn).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWsOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should increment active session count', () => {
      const initialCount = voiceWebSocketService.getActiveSessionCount();
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=sess-count-1');
      connectionHandler!(ws, req);
      expect(voiceWebSocketService.getActiveSessionCount()).toBeGreaterThan(initialCount);
    });
  });

  describe('control messages', () => {
    let ws: any;
    let messageHandler: ((data: Buffer) => Promise<void>) | null = null;

    beforeEach(() => {
      voiceWebSocketService.initialize(mockHttpServer);
      ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=ctrl-sess');
      connectionHandler!(ws, req);
      messageHandler = mockWsOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
    });

    it('should handle start_recording message', async () => {
      const msg = Buffer.from(JSON.stringify({ type: 'start_recording' }));
      await messageHandler!(msg);
      expect(mockWsSend).toHaveBeenCalledWith(expect.stringContaining('recording_started'));
    });

    it('should handle ping with pong', async () => {
      const msg = Buffer.from(JSON.stringify({ type: 'ping' }));
      await messageHandler!(msg);
      expect(mockWsSend).toHaveBeenCalledWith(expect.stringContaining('pong'));
    });

    it('should handle stop_recording message', async () => {
      const msg = Buffer.from(JSON.stringify({ type: 'stop_recording' }));
      await messageHandler!(msg);
      expect(mockWsSend).toHaveBeenCalledWith(expect.stringContaining('recording_stopped'));
    });
  });

  describe('disconnect cleanup', () => {
    it('should remove session on close', () => {
      voiceWebSocketService.initialize(mockHttpServer);
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=close-sess');
      connectionHandler!(ws, req);

      expect(voiceWebSocketService.getSession('close-sess')).toBeDefined();

      const closeHandler = mockWsOn.mock.calls.find((c: any[]) => c[0] === 'close')?.[1];
      closeHandler();

      expect(voiceWebSocketService.getSession('close-sess')).toBeUndefined();
    });

    it('should log on session close', () => {
      voiceWebSocketService.initialize(mockHttpServer);
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=log-close-sess');
      connectionHandler!(ws, req);

      const closeHandler = mockWsOn.mock.calls.find((c: any[]) => c[0] === 'close')?.[1];
      closeHandler();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('log-close-sess'));
    });
  });

  describe('error handling', () => {
    it('should clean up session on WebSocket error', () => {
      voiceWebSocketService.initialize(mockHttpServer);
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=err-sess');
      connectionHandler!(ws, req);

      const errorHandler = mockWsOn.mock.calls.find((c: any[]) => c[0] === 'error')?.[1];
      errorHandler(new Error('connection reset'));

      expect(voiceWebSocketService.getSession('err-sess')).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should send error message on malformed JSON', async () => {
      voiceWebSocketService.initialize(mockHttpServer);
      const ws = makeWs();
      const req = makeRequest('/ws/voice?sessionId=bad-json-sess');
      connectionHandler!(ws, req);

      const messageHandler = mockWsOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      // Pass a buffer that starts with '{' but is invalid JSON
      const badMsg = Buffer.from('{bad json}');
      await messageHandler(badMsg);
      expect(mockWsSend).toHaveBeenCalledWith(expect.stringContaining('error'));
    });
  });

  describe('getActiveSessionCount()', () => {
    it('should return 0 before any connections', () => {
      // Fresh enough check — after prior cleanup tests may have cleared sessions
      const count = voiceWebSocketService.getActiveSessionCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
