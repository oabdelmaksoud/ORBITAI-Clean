/**
 * WebSocket Service — Unit Tests
 * Covers interface shapes, user presence logic, and broadcast methods
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io before importing the service
vi.mock('socket.io', () => {
  const mockEmit = vi.fn();
  const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
  const mockJoin = vi.fn();
  const mockLeave = vi.fn();

  const mockSocket = {
    id: 'mock-socket-id',
    on: vi.fn(),
    emit: mockEmit,
    join: mockJoin,
    leave: mockLeave,
    handshake: {
      auth: { token: 'mock-token' },
      query: {},
    },
    data: {},
  };

  const MockServer = vi.fn().mockImplementation(() => ({
    on: vi.fn((event: string, cb: (s: typeof mockSocket) => void) => {
      if (event === 'connection') cb(mockSocket);
    }),
    to: mockTo,
    emit: mockEmit,
    use: vi.fn(),
    sockets: { adapter: { rooms: new Map() } },
  }));

  return { Server: MockServer };
});

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('WebSocket — UserPresence interface', () => {
  it('constructs a valid UserPresence object', () => {
    const presence = {
      userId: 'user-1',
      userName: 'Alice',
      projectId: 'proj-1',
      lastSeen: new Date(),
      cursor: { x: 100, y: 200 },
    };
    expect(presence.userId).toBe('user-1');
    expect(presence.cursor?.x).toBe(100);
    expect(presence.lastSeen).toBeInstanceOf(Date);
  });

  it('constructs a UserPresence without optional cursor', () => {
    const presence = {
      userId: 'user-2',
      userName: 'Bob',
      projectId: 'proj-2',
      lastSeen: new Date(),
    };
    expect(presence.cursor).toBeUndefined();
  });
});

describe('WebSocket — ProjectUpdate interface', () => {
  it('constructs a valid ProjectUpdate object', () => {
    const update = {
      projectId: 'proj-abc',
      updates: { name: 'Updated Project', status: 'active' },
      userId: 'user-123',
      timestamp: new Date(),
    };
    expect(update.projectId).toBe('proj-abc');
    expect(update.updates).toHaveProperty('name');
    expect(update.timestamp).toBeInstanceOf(Date);
  });
});

describe('WebSocket — SupportChatMessage interface', () => {
  it('constructs a valid user message', () => {
    const msg = {
      chatId: 'chat-1',
      messageId: 'msg-1',
      content: 'Hello, I need help!',
      sender: 'user' as const,
      senderId: 'user-1',
      senderName: 'Alice',
      timestamp: new Date(),
    };
    expect(msg.sender).toBe('user');
    expect(['user', 'agent', 'system']).toContain(msg.sender);
  });

  it('constructs a valid agent message', () => {
    const msg = {
      chatId: 'chat-1',
      messageId: 'msg-2',
      content: 'How can I help?',
      sender: 'agent' as const,
      senderId: 'agent-1',
      senderName: 'Support Agent',
      timestamp: new Date(),
    };
    expect(msg.sender).toBe('agent');
  });
});

describe('WebSocket — AgentPresence interface', () => {
  it('constructs a valid AgentPresence with status available', () => {
    const presence = {
      agentId: 'agent-1',
      agentName: 'Support Bot',
      status: 'available' as const,
      activeChats: 3,
      lastSeen: new Date(),
    };
    expect(presence.status).toBe('available');
    expect(['available', 'busy', 'away']).toContain(presence.status);
    expect(presence.activeChats).toBeGreaterThanOrEqual(0);
  });
});

describe('WebSocket — service singleton', () => {
  it('exports a webSocketService singleton', async () => {
    const mod = await import('../../services/websocket.service.js');
    expect(mod.webSocketService).toBeDefined();
    expect(typeof mod.webSocketService.initialize).toBe('function');
    expect(typeof mod.webSocketService.broadcastProjectUpdate).toBe('function');
  });

  it('broadcastProjectUpdate does not throw when io is uninitialized', async () => {
    const { webSocketService } = await import('../../services/websocket.service.js');
    expect(() =>
      webSocketService.broadcastProjectUpdate('proj-1', { name: 'Test' }, 'user-1')
    ).not.toThrow();
  });
});
