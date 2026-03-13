/**
 * Support WebSocket Service
 * Real-time communication for live chat support
 */

import { io, Socket } from 'socket.io-client';

// Convert HTTP URL to WebSocket URL properly
const getWSUrl = () => {
  // For remote access (localtunnel, ngrok), use current origin
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocalhost) {
      return window.location.origin;
    }
  }

  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const cleanedUrl = apiUrl.trim().replace(/\/$/, '');
  // Socket.io can handle HTTP URLs, it will convert them internally
  return cleanedUrl;
};
const WS_URL = getWSUrl();

export interface ChatMessageEvent {
  chatId: string;
  messageId: string;
  content: string;
  sender: 'user' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  timestamp: Date;
}

export interface TypingIndicatorEvent {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  isAgent: boolean;
}

export interface AgentJoinedEvent {
  chatId: string;
  agentId: string;
  agentName: string;
  timestamp: Date;
}

export interface ChatEndedEvent {
  chatId: string;
  endedBy: 'user' | 'agent' | 'system';
  reason?: string;
  timestamp: Date;
}

export interface ChatTransferredEvent {
  chatId: string;
  fromAgent: { id: string; name: string };
  toAgent: { id: string; name: string };
  reason?: string;
  timestamp: Date;
}

export interface QueuedChatEvent {
  chatId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  queuePosition: number;
  queuedAt: Date;
}

export interface AgentStatusEvent {
  agentId: string;
  agentName?: string;
  status?: 'available' | 'busy' | 'away';
  timestamp: Date;
}

type EventCallback<T> = (data: T) => void;

class SupportWebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private eventListeners: Map<string, Set<EventCallback<any>>> = new Map();
  private agentId: string | null = null;
  private agentName: string | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(WS_URL, {
        transports: ['polling', 'websocket'], // Try polling first (less noisy)
        auth: { token },
        reconnection: false, // Disable automatic reconnection
        reconnectionAttempts: 1, // Only try once
        reconnectionDelay: 5000,
        reconnectionDelayMax: 10000,
        timeout: 5000, // Fail fast
        upgrade: false // Disable automatic upgrade
      });

      this.socket.on('connect', () => {
        console.log('[SupportWS] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Authenticate
        this.socket?.emit('authenticate', { token });
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[SupportWS] Disconnected:', reason);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        // Silently handle connection errors - backend may not be running
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          // Fail silently - backend may not be running
          this.socket?.disconnect();
          resolve(); // Resolve instead of reject to avoid unhandled promise rejection
        }
      });

      // Set up event handlers
      this.setupEventHandlers();
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      // Leave support agents room if agent
      if (this.agentId) {
        this.socket.emit('leave-support-agents');
      }

      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.agentId = null;
      this.agentName = null;
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Chat messages
    this.socket.on('new-chat-message', (data: ChatMessageEvent) => {
      this.emit('message', data);
    });

    // Typing indicators
    this.socket.on('typing-indicator', (data: TypingIndicatorEvent) => {
      this.emit('typing', data);
    });

    // Agent joined
    this.socket.on('agent_joined', (data: AgentJoinedEvent) => {
      this.emit('agent_joined', data);
    });

    // Chat ended
    this.socket.on('chat_ended', (data: ChatEndedEvent) => {
      this.emit('chat_ended', data);
    });

    // Chat transferred
    this.socket.on('chat_transferred', (data: ChatTransferredEvent) => {
      this.emit('chat_transferred', data);
    });

    // New chat in queue
    this.socket.on('new_chat_queued', (data: QueuedChatEvent) => {
      this.emit('new_chat_queued', data);
    });

    // Queue updated
    this.socket.on('queue_updated', () => {
      this.emit('queue_updated', {});
    });

    // Chat assigned to agent
    this.socket.on('chat_assigned', (data: any) => {
      this.emit('chat_assigned', data);
    });

    // Agent online
    this.socket.on('agent-online', (data: AgentStatusEvent) => {
      this.emit('agent_online', data);
    });

    // Agent offline
    this.socket.on('agent-offline', (data: AgentStatusEvent) => {
      this.emit('agent_offline', data);
    });

    // Agent status changed
    this.socket.on('agent-status-changed', (data: AgentStatusEvent) => {
      this.emit('agent_status_changed', data);
    });

    // Room messages (generic)
    this.socket.on('room-message', (data: any) => {
      this.emit('room_message', data);
    });

    // Agent notification
    this.socket.on('agent-notification', (data: any) => {
      this.emit('agent_notification', data);
    });
  }

  /**
   * Join support agents room (for agents)
   */
  joinSupportAgents(agentId: string, agentName: string): void {
    if (!this.socket) return;

    this.agentId = agentId;
    this.agentName = agentName;
    this.socket.emit('join-support-agents', { agentId, agentName });
  }

  /**
   * Leave support agents room
   */
  leaveSupportAgents(): void {
    if (!this.socket) return;
    this.socket.emit('leave-support-agents');
    this.agentId = null;
    this.agentName = null;
  }

  /**
   * Update agent status
   */
  updateAgentStatus(status: 'available' | 'busy' | 'away'): void {
    if (!this.socket) return;
    this.socket.emit('update-agent-status', { status });
  }

  /**
   * Join a specific chat room
   */
  joinChat(chatId: string): void {
    if (!this.socket) return;
    this.socket.emit('join-chat', { chatId });
  }

  /**
   * Leave a chat room
   */
  leaveChat(chatId: string): void {
    if (!this.socket) return;
    this.socket.emit('leave-chat', { chatId });
  }

  /**
   * Send a chat message
   */
  sendMessage(chatId: string, messageId: string, content: string): void {
    if (!this.socket) return;

    this.socket.emit('chat-message', {
      chatId,
      messageId,
      content,
      sender: 'agent',
      senderId: this.agentId,
      senderName: this.agentName,
      timestamp: new Date()
    });
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(chatId: string, isTyping: boolean): void {
    if (!this.socket) return;
    this.socket.emit('chat-typing', { chatId, isTyping });
  }

  /**
   * Subscribe to an event
   */
  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Check if connected
   */
  isSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const supportWebSocket = new SupportWebSocketService();

// Export hook for React components
export function useSupportWebSocket() {
  return supportWebSocket;
}




