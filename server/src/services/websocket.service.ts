/**
 * WebSocket Service for Real-time Collaboration
 * Handles WebSocket connections for real-time project updates
 * 
 * @module services/websocket
 * @example
 * ```typescript
 * import { webSocketService } from './services/websocket.service';
 * webSocketService.initialize(httpServer);
 * webSocketService.broadcastProjectUpdate(projectId, updates, userId);
 * ```
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';

interface UserPresence {
  userId: string;
  userName: string;
  projectId: string;
  lastSeen: Date;
  cursor?: { x: number; y: number };
}

interface ProjectUpdate {
  projectId: string;
  updates: Partial<any>;
  userId: string;
  timestamp: Date;
}

interface SupportChatMessage {
  chatId: string;
  messageId: string;
  content: string;
  sender: 'user' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  timestamp: Date;
}

interface AgentPresence {
  agentId: string;
  agentName: string;
  status: 'available' | 'busy' | 'away';
  activeChats: number;
  lastSeen: Date;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private userPresences: Map<string, UserPresence> = new Map();
  private projectRooms: Map<string, Set<string>> = new Map(); // projectId -> Set of socketIds
  private brainstormingRooms: Map<string, Set<string>> = new Map(); // roomId -> Set of socketIds
  private brainstormingPresences: Map<string, any> = new Map(); // roomId:userId -> presence
  private supportChatRooms: Map<string, Set<string>> = new Map(); // chatId -> Set of socketIds
  private agentPresences: Map<string, AgentPresence> = new Map(); // agentId -> presence
  private agentSockets: Map<string, string> = new Map(); // agentId -> socketId
  private generationSessions: Map<string, Set<string>> = new Map(); // sessionId -> Set of socketIds

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);

          const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:5174',
            'http://localhost:5176', // Current frontend port
            'http://localhost:5175', // Previous frontend port
            'http://localhost:5174',
            'http://localhost:5173', // Keep for backward compatibility
            'http://localhost:3000',
            'http://127.0.0.1:5176', // Current frontend port
            'http://127.0.0.1:5175', // Previous frontend port
            'http://127.0.0.1:5174',
            'http://127.0.0.1:5173', // Keep for backward compatibility
            'http://127.0.0.1:3000'
          ];

          if (allowedOrigins.includes(origin) || origin.endsWith('.loca.lt')) {
            callback(null, true);
          } else {
            logger.warn(`[WebSocket] Blocked connection from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true // Allow Engine.IO v3 clients
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info(`[WebSocket] Client connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', async (data: { token: string }) => {
        try {
          // Verify token and get user
          // This would typically verify JWT token
          const userId = data.token; // Simplified - should verify JWT
          socket.data.userId = userId;
          logger.info(`[WebSocket] Client authenticated: ${socket.id}, userId: ${userId}`);
        } catch (error) {
          logger.error(`[WebSocket] Authentication failed: ${error}`);
          socket.disconnect();
        }
      });

      // Allow unauthenticated connections for live conversation (will be handled by live conversation service)
      // But prefer authenticated connections

      // Join project room
      socket.on('join-project', (data: { projectId: string; userName: string }) => {
        const { projectId, userName } = data;
        const userId = socket.data.userId;

        if (!userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        socket.join(`project:${projectId}`);

        // Track user presence
        const presence: UserPresence = {
          userId,
          userName,
          projectId,
          lastSeen: new Date()
        };
        this.userPresences.set(`${userId}:${projectId}`, presence);

        // Track socket in project room
        if (!this.projectRooms.has(projectId)) {
          this.projectRooms.set(projectId, new Set());
        }
        this.projectRooms.get(projectId)!.add(socket.id);

        // Notify others in the room
        socket.to(`project:${projectId}`).emit('user-joined', {
          userId,
          userName,
          timestamp: new Date()
        });

        // Send current presence list to new user
        const currentPresences = Array.from(this.userPresences.values())
          .filter(p => p.projectId === projectId)
          .map(p => ({ userId: p.userId, userName: p.userName }));

        socket.emit('presence-list', { users: currentPresences });

        logger.info(`[WebSocket] User ${userName} joined project ${projectId}`);
      });

      // Leave project room
      socket.on('leave-project', (data: { projectId: string }) => {
        const { projectId } = data;
        const userId = socket.data.userId;

        socket.leave(`project:${projectId}`);

        // Remove presence
        this.userPresences.delete(`${userId}:${projectId}`);

        // Remove socket from project room
        const room = this.projectRooms.get(projectId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            this.projectRooms.delete(projectId);
          }
        }

        // Notify others
        socket.to(`project:${projectId}`).emit('user-left', {
          userId,
          timestamp: new Date()
        });

        logger.info(`[WebSocket] User left project ${projectId}`);
      });

      // Handle project updates
      socket.on('project-update', async (data: ProjectUpdate) => {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Broadcast to others in the project room (excluding sender)
        socket.to(`project:${data.projectId}`).emit('project-updated', {
          ...data,
          userId,
          timestamp: new Date()
        });

        logger.debug(`[WebSocket] Project update broadcasted: ${data.projectId}`);
      });

      // Handle cursor movement
      socket.on('cursor-move', (data: { projectId: string; x: number; y: number }) => {
        const userId = socket.data.userId;
        if (!userId) return;

        const presence = this.userPresences.get(`${userId}:${data.projectId}`);
        if (presence) {
          presence.cursor = { x: data.x, y: data.y };
          presence.lastSeen = new Date();
        }

        // Broadcast cursor position to others
        socket.to(`project:${data.projectId}`).emit('cursor-update', {
          userId,
          userName: presence?.userName,
          x: data.x,
          y: data.y
        });
      });

      // Handle conflict resolution
      socket.on('resolve-conflict', async (data: { projectId: string; conflictId: string; resolution: any }) => {
        const userId = socket.data.userId;
        if (!userId) return;

        // Broadcast conflict resolution
        this.io!.to(`project:${data.projectId}`).emit('conflict-resolved', {
          conflictId: data.conflictId,
          resolution: data.resolution,
          resolvedBy: userId,
          timestamp: new Date()
        });
      });

      // ==================== BRAINSTORMING ROOM EVENTS ====================

      // Join brainstorming room
      socket.on('join-brainstorming-room', (data: { roomId: string; userName: string }) => {
        const { roomId, userName } = data;
        const userId = socket.data.userId;

        if (!userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        socket.join(`brainstorming-room:${roomId}`);

        // Track user presence
        const presenceKey = `${roomId}:${userId}`;
        const presence = {
          userId,
          userName,
          roomId,
          socketId: socket.id,
          lastSeen: new Date()
        };
        this.brainstormingPresences.set(presenceKey, presence);

        // Track socket in room
        if (!this.brainstormingRooms.has(roomId)) {
          this.brainstormingRooms.set(roomId, new Set());
        }
        this.brainstormingRooms.get(roomId)!.add(socket.id);

        // Notify others in the room
        socket.to(`brainstorming-room:${roomId}`).emit('user-joined-room', {
          userId,
          userName,
          timestamp: new Date()
        });

        // Send current presence list to new user
        const currentPresences = Array.from(this.brainstormingPresences.values())
          .filter(p => p.roomId === roomId)
          .map(p => ({ userId: p.userId, userName: p.userName, socketId: p.socketId }));

        socket.emit('room-presence-list', { users: currentPresences });

        logger.info(`[WebSocket] User ${userName} joined brainstorming room ${roomId}`);
      });

      // Leave brainstorming room
      socket.on('leave-brainstorming-room', (data: { roomId: string }) => {
        const { roomId } = data;
        const userId = socket.data.userId;

        socket.leave(`brainstorming-room:${roomId}`);

        // Remove presence
        this.brainstormingPresences.delete(`${roomId}:${userId}`);

        // Remove socket from room
        const room = this.brainstormingRooms.get(roomId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            this.brainstormingRooms.delete(roomId);
          }
        }

        // Notify others
        socket.to(`brainstorming-room:${roomId}`).emit('user-left-room', {
          userId,
          timestamp: new Date()
        });

        logger.info(`[WebSocket] User left brainstorming room ${roomId}`);
      });

      // Handle brainstorming room updates (ideas, topic, etc.)
      socket.on('brainstorming-room-update', async (data: { roomId: string; updates: any; type: string }) => {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Broadcast to others in the room (excluding sender)
        socket.to(`brainstorming-room:${data.roomId}`).emit('brainstorming-room-updated', {
          ...data,
          userId,
          timestamp: new Date()
        });

        logger.debug(`[WebSocket] Brainstorming room update broadcasted: ${data.roomId}, type: ${data.type}`);
      });

      // Handle cursor movement in brainstorming room
      socket.on('room-cursor-move', (data: { roomId: string; ideaId?: string; x?: number; y?: number }) => {
        const userId = socket.data.userId;
        if (!userId) return;

        const presenceKey = `${data.roomId}:${userId}`;
        const presence = this.brainstormingPresences.get(presenceKey);
        if (presence) {
          presence.cursorPosition = { ideaId: data.ideaId, x: data.x, y: data.y };
          presence.lastSeen = new Date();
        }

        // Broadcast cursor position to others
        socket.to(`brainstorming-room:${data.roomId}`).emit('room-cursor-update', {
          userId,
          userName: presence?.userName,
          ideaId: data.ideaId,
          x: data.x,
          y: data.y
        });
      });

      // Handle idea addition/update in room
      socket.on('room-idea-update', (data: { roomId: string; idea: any; action: 'add' | 'update' | 'delete' }) => {
        const userId = socket.data.userId;
        if (!userId) return;

        // Broadcast idea update to others
        socket.to(`brainstorming-room:${data.roomId}`).emit('room-idea-updated', {
          ...data,
          userId,
          timestamp: new Date()
        });
      });

      // Handle HMW question updates
      socket.on('room-hmw-update', (data: { roomId: string; question: any; action: 'add' | 'update' | 'delete' }) => {
        const userId = socket.data.userId;
        if (!userId) return;

        // Broadcast HMW update to others
        socket.to(`brainstorming-room:${data.roomId}`).emit('room-hmw-updated', {
          ...data,
          userId,
          timestamp: new Date()
        });
      });

      // ==================== SUPPORT CHAT EVENTS ====================

      // Agent joins support agents room
      socket.on('join-support-agents', (data: { agentId: string; agentName: string }) => {
        const { agentId, agentName } = data;

        socket.join('support-agents');
        socket.data.agentId = agentId;
        socket.data.agentName = agentName;
        socket.data.isAgent = true;

        // Track agent presence
        const presence: AgentPresence = {
          agentId,
          agentName,
          status: 'available',
          activeChats: 0,
          lastSeen: new Date()
        };
        this.agentPresences.set(agentId, presence);
        this.agentSockets.set(agentId, socket.id);

        // Join agent's personal room for direct messages
        socket.join(`agent:${agentId}`);

        // Notify other agents
        socket.to('support-agents').emit('agent-online', {
          agentId,
          agentName,
          timestamp: new Date()
        });

        logger.info(`[WebSocket] Support agent ${agentName} joined`);
      });

      // Agent leaves support
      socket.on('leave-support-agents', () => {
        const agentId = socket.data.agentId;
        if (agentId) {
          socket.leave('support-agents');
          socket.leave(`agent:${agentId}`);
          this.agentPresences.delete(agentId);
          this.agentSockets.delete(agentId);

          socket.to('support-agents').emit('agent-offline', {
            agentId,
            timestamp: new Date()
          });

          logger.info(`[WebSocket] Support agent ${socket.data.agentName} left`);
        }
      });

      // Update agent status
      socket.on('update-agent-status', (data: { status: 'available' | 'busy' | 'away' }) => {
        const agentId = socket.data.agentId;
        const presence = this.agentPresences.get(agentId);
        if (presence) {
          presence.status = data.status;
          presence.lastSeen = new Date();

          this.io!.to('support-agents').emit('agent-status-changed', {
            agentId,
            status: data.status,
            timestamp: new Date()
          });
        }
      });

      // User joins support chat queue
      socket.on('join-support-queue', (data: { userId: string; userName: string }) => {
        const { userId, userName } = data;
        socket.join('support-queue');
        socket.data.supportUserId = userId;
        socket.data.supportUserName = userName;

        logger.info(`[WebSocket] User ${userName} joined support queue`);
      });

      // Join specific chat room
      socket.on('join-chat', (data: { chatId: string }) => {
        const { chatId } = data;
        socket.join(`chat:${chatId}`);

        if (!this.supportChatRooms.has(chatId)) {
          this.supportChatRooms.set(chatId, new Set());
        }
        this.supportChatRooms.get(chatId)!.add(socket.id);

        logger.info(`[WebSocket] Socket ${socket.id} joined chat ${chatId}`);
      });

      // Leave chat room
      socket.on('leave-chat', (data: { chatId: string }) => {
        const { chatId } = data;
        socket.leave(`chat:${chatId}`);

        const room = this.supportChatRooms.get(chatId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            this.supportChatRooms.delete(chatId);
          }
        }

        logger.info(`[WebSocket] Socket ${socket.id} left chat ${chatId}`);
      });

      // Send chat message
      socket.on('chat-message', (data: SupportChatMessage) => {
        // Broadcast to everyone in the chat room
        this.io!.to(`chat:${data.chatId}`).emit('new-chat-message', {
          ...data,
          timestamp: new Date()
        });

        logger.debug(`[WebSocket] Chat message in ${data.chatId}`);
      });

      // Typing indicator
      socket.on('chat-typing', (data: { chatId: string; isTyping: boolean }) => {
        const userId = socket.data.userId || socket.data.agentId;
        const userName = socket.data.agentName || socket.data.supportUserName;
        const isAgent = socket.data.isAgent || false;

        socket.to(`chat:${data.chatId}`).emit('typing-indicator', {
          chatId: data.chatId,
          userId,
          userName,
          isTyping: data.isTyping,
          isAgent
        });
      });

      // ==================== GENERATION STATUS EVENTS ====================

      // Join generation session for real-time status updates
      socket.on('join-generation-session', (data: { sessionId: string }) => {
        const { sessionId } = data;
        this.joinGenerationSession(socket.id, sessionId);
        socket.emit('generation-session-joined', { sessionId });
        logger.info(`[WebSocket] Client joined generation session: ${sessionId}`);
      });

      // Leave generation session
      socket.on('leave-generation-session', (data: { sessionId: string }) => {
        const { sessionId } = data;
        this.leaveGenerationSession(socket.id, sessionId);
        socket.emit('generation-session-left', { sessionId });
        logger.info(`[WebSocket] Client left generation session: ${sessionId}`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        const userId = socket.data.userId;
        logger.info(`[WebSocket] Client disconnected: ${socket.id}`);

        // Remove from all project rooms
        for (const [projectId, sockets] of this.projectRooms.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.projectRooms.delete(projectId);
            }

            // Notify others
            socket.to(`project:${projectId}`).emit('user-left', {
              userId,
              timestamp: new Date()
            });

            // Remove presence
            this.userPresences.delete(`${userId}:${projectId}`);
          }
        }

        // Handle support agent disconnect
        const agentId = socket.data.agentId;
        if (agentId) {
          this.agentPresences.delete(agentId);
          this.agentSockets.delete(agentId);

          this.io!.to('support-agents').emit('agent-offline', {
            agentId,
            timestamp: new Date()
          });
        }

        // Remove from support chat rooms
        for (const [chatId, sockets] of this.supportChatRooms.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.supportChatRooms.delete(chatId);
            }
          }
        }

        // Remove from brainstorming rooms
        for (const [roomId, sockets] of this.brainstormingRooms.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.brainstormingRooms.delete(roomId);
            }

            // Remove presence
            this.brainstormingPresences.delete(`${roomId}:${userId}`);

            // Notify others
            socket.to(`brainstorming-room:${roomId}`).emit('user-left-room', {
              userId,
              timestamp: new Date()
            });
          }
        }
      });
    });

    logger.info('[WebSocket] WebSocket service initialized');
  }

  /**
   * Broadcast project update to all clients in a project room
   */
  broadcastProjectUpdate(projectId: string, updates: Partial<any>, userId: string): void {
    if (!this.io) return;

    this.io.to(`project:${projectId}`).emit('project-updated', {
      projectId,
      updates,
      userId,
      timestamp: new Date()
    });
  }

  /**
   * Get current users in a project
   */
  getProjectUsers(projectId: string): UserPresence[] {
    return Array.from(this.userPresences.values())
      .filter(p => p.projectId === projectId);
  }

  /**
   * Broadcast brainstorming room update to all clients in a room
   */
  broadcastBrainstormingRoomUpdate(roomId: string, updates: any, userId: string, type: string): void {
    if (!this.io) return;

    this.io.to(`brainstorming-room:${roomId}`).emit('brainstorming-room-updated', {
      roomId,
      updates,
      userId,
      type,
      timestamp: new Date()
    });
  }

  /**
   * Get current users in a brainstorming room
   */
  getBrainstormingRoomUsers(roomId: string): any[] {
    return Array.from(this.brainstormingPresences.values())
      .filter(p => p.roomId === roomId)
      .map(p => ({ userId: p.userId, userName: p.userName, socketId: p.socketId }));
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: { type: string;[key: string]: any }): void {
    if (!this.io) return;
    this.io.emit('broadcast', message);
    logger.debug(`[WebSocket] Broadcast message: ${message.type}`);
  }

  /**
   * Broadcast a message to a specific room/channel
   */
  broadcastToRoom(room: string, message: { type: string;[key: string]: any }): void {
    if (!this.io) return;
    this.io.to(room).emit('room-message', message);
    logger.debug(`[WebSocket] Broadcast to room ${room}: ${message.type}`);
  }

  /**
   * Get WebSocket server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  // ==================== SUPPORT CHAT METHODS ====================

  /**
   * Send message to a specific chat room
   */
  sendChatMessage(chatId: string, message: SupportChatMessage): void {
    if (!this.io) return;
    this.io.to(`chat:${chatId}`).emit('new-chat-message', message);
  }

  /**
   * Notify agents of a new chat in queue
   */
  notifyNewChatInQueue(chat: any): void {
    if (!this.io) return;
    this.io.to('support-agents').emit('new_chat_queued', {
      type: 'new_chat_queued',
      chat,
      timestamp: new Date()
    });
  }

  /**
   * Notify queue update (positions changed)
   */
  notifyQueueUpdate(): void {
    if (!this.io) return;
    this.io.to('support-agents').emit('queue_updated', {
      type: 'queue_updated',
      timestamp: new Date()
    });
    this.io.to('support-queue').emit('queue_updated', {
      type: 'queue_updated',
      timestamp: new Date()
    });
  }

  /**
   * Notify user that agent joined their chat
   */
  notifyAgentJoined(chatId: string, agentId: string, agentName: string): void {
    if (!this.io) return;
    this.io.to(`chat:${chatId}`).emit('agent_joined', {
      type: 'agent_joined',
      chatId,
      agentId,
      agentName,
      timestamp: new Date()
    });
  }

  /**
   * Notify chat ended
   */
  notifyChatEnded(chatId: string, endedBy: 'user' | 'agent' | 'system', reason?: string): void {
    if (!this.io) return;
    this.io.to(`chat:${chatId}`).emit('chat_ended', {
      type: 'chat_ended',
      chatId,
      endedBy,
      reason,
      timestamp: new Date()
    });
    this.notifyQueueUpdate();
  }

  /**
   * Notify chat transfer
   */
  notifyChatTransfer(chatId: string, fromAgent: { id: string; name: string }, toAgent: { id: string; name: string }, reason?: string): void {
    if (!this.io) return;
    this.io.to(`chat:${chatId}`).emit('chat_transferred', {
      type: 'chat_transferred',
      chatId,
      fromAgent,
      toAgent,
      reason,
      timestamp: new Date()
    });

    // Notify new agent
    this.io.to(`agent:${toAgent.id}`).emit('chat_assigned', {
      type: 'chat_assigned',
      chatId,
      timestamp: new Date()
    });
  }

  /**
   * Get online support agents
   */
  getOnlineAgents(): AgentPresence[] {
    return Array.from(this.agentPresences.values());
  }

  /**
   * Get available agents (online and not busy)
   */
  getAvailableAgents(): AgentPresence[] {
    return Array.from(this.agentPresences.values())
      .filter(a => a.status === 'available');
  }

  /**
   * Update agent's active chat count
   */
  updateAgentChatCount(agentId: string, count: number): void {
    const presence = this.agentPresences.get(agentId);
    if (presence) {
      presence.activeChats = count;
      presence.lastSeen = new Date();
    }
  }

  /**
   * Send notification to specific agent
   */
  notifyAgent(agentId: string, notification: any): void {
    if (!this.io) return;
    this.io.to(`agent:${agentId}`).emit('agent-notification', notification);
  }

  // ==================== GENERATION STATUS EVENTS ====================

  /**
   * Subscribe a socket to generation status updates for a session
   */
  joinGenerationSession(socketId: string, sessionId: string): void {
    if (!this.generationSessions.has(sessionId)) {
      this.generationSessions.set(sessionId, new Set());
    }
    this.generationSessions.get(sessionId)!.add(socketId);

    // Also join a Socket.IO room for efficient broadcasting
    const socket = this.io?.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(`generation:${sessionId}`);
      logger.info(`[WebSocket] Socket ${socketId} joined generation session ${sessionId}`);
    }
  }

  /**
   * Unsubscribe a socket from generation status updates
   */
  leaveGenerationSession(socketId: string, sessionId: string): void {
    const session = this.generationSessions.get(sessionId);
    if (session) {
      session.delete(socketId);
      if (session.size === 0) {
        this.generationSessions.delete(sessionId);
      }
    }

    const socket = this.io?.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(`generation:${sessionId}`);
      logger.info(`[WebSocket] Socket ${socketId} left generation session ${sessionId}`);
    }
  }

  /**
   * Broadcast generation status event to all clients subscribed to a session
   * This is called by GenerationStatus.service
   */
  broadcastGenerationStatus(sessionId: string, event: {
    type: 'ai_thought' | 'process_stage' | 'model_selection' | 'progress' | 'debug' | 'error' | 'complete';
    message: string;
    timestamp: number;
    metadata?: {
      model?: string;
      provider?: string;
      stage?: string;
      progress?: number;
      agentName?: string;
      duration?: number;
      tokenCount?: number;
      cost?: number;
      details?: string;
    };
  }): void {
    if (!this.io) return;

    this.io.to(`generation:${sessionId}`).emit('generation-status', {
      sessionId,
      event,
      timestamp: new Date()
    });

    logger.debug(`[WebSocket] Generation status broadcast to ${sessionId}: ${event.type}`);
  }

  /**
   * Get the socket emitter function for GenerationStatus.service to use
   */
  getGenerationStatusEmitter(): (sessionId: string, event: any) => void {
    return (sessionId: string, event: any) => {
      this.broadcastGenerationStatus(sessionId, event);
    };
  }

  // ==================== GAME ASSET GENERATION EVENTS ====================

  /**
   * Emit game asset generation started event
   */
  emitAssetGenerationStarted(jobId: string, data: { totalAssets: number; estimatedTime?: number }): void {
    if (!this.io) return;
    this.io.to(`asset-generation:${jobId}`).emit('gameAssets:generation:started', {
      jobId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Emit game asset generation progress event
   */
  emitAssetGenerationProgress(jobId: string, data: {
    progress: number;
    currentAsset?: string;
    completedCount: number;
    totalCount: number;
    message?: string;
  }): void {
    if (!this.io) return;
    this.io.to(`asset-generation:${jobId}`).emit('gameAssets:generation:progress', {
      jobId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Emit single asset complete event
   */
  emitAssetComplete(jobId: string, asset: any): void {
    if (!this.io) return;
    this.io.to(`asset-generation:${jobId}`).emit('gameAssets:generation:assetComplete', {
      jobId,
      asset,
      timestamp: new Date()
    });
  }

  /**
   * Emit game asset generation complete event
   */
  emitAssetGenerationComplete(jobId: string, data: {
    assets: any[];
    totalGenerated: number;
    totalFailed: number;
  }): void {
    if (!this.io) return;
    this.io.to(`asset-generation:${jobId}`).emit('gameAssets:generation:complete', {
      jobId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Emit game asset generation error event
   */
  emitAssetGenerationError(jobId: string, data: {
    asset?: string;
    error: string;
    canRetry?: boolean;
  }): void {
    if (!this.io) return;
    this.io.to(`asset-generation:${jobId}`).emit('gameAssets:generation:error', {
      jobId,
      ...data,
      timestamp: new Date()
    });
  }
}

export const webSocketService = new WebSocketService();

