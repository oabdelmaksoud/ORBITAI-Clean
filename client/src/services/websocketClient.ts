/**
 * WebSocket Client Service for Real-time Collaboration
 * Handles WebSocket connections from the frontend
 * 
 * @module services/websocketClient
 * @example
 * ```typescript
 * import { websocketClient } from './services/websocketClient';
 * websocketClient.connect(projectId, userName);
 * websocketClient.sendProjectUpdate(projectId, updates);
 * ```
 */

import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@src/services/api';

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private cuaListenersSetup = false;

  /**
   * Get WebSocket URL based on environment
   */
  private getWsUrl(): string {
    // In development, prefer connecting through the Vite proxy
    // This allows WebSocket connections to work through the /socket.io proxy
    if (typeof window !== 'undefined' && window.location) {
      const { hostname, port } = window.location;
      const isLocalDevServer = hostname === 'localhost' || hostname === '127.0.0.1';
      const isVitePort = port === '5173';

      // Connect through Vite proxy when running on the dev server
      if (isLocalDevServer && isVitePort) {
        console.log('[WebSocket] Using Vite proxy for socket.io');
        return window.location.origin;
      }

      // For tunnel/remote access, use same origin
      if (!isLocalDevServer) {
        return window.location.origin;
      }
    }

    let wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3002';
    if (!import.meta.env.VITE_WS_URL && import.meta.env.VITE_API_URL) {
      const apiUrl = import.meta.env.VITE_API_URL.trim().replace(/\/$/, '');
      wsUrl = apiUrl;
    }
    return wsUrl;
  }

  /**
   * Setup CUA event listeners
   */
  private setupCUAListeners(): void {
    if (!this.socket || this.cuaListenersSetup) return;

    this.socket.on('cua:frame', (data: any) => {
      // Frames are dispatched to components which filter by sessionId
      // No logging here to reduce console noise from stale sessions
      window.dispatchEvent(new CustomEvent('cua:frame', { detail: data }));
    });

    this.socket.on('cua:scenarios', (data: any) => {
      window.dispatchEvent(new CustomEvent('cua:scenarios', { detail: data }));
    });

    this.socket.on('cua:scenario:start', (data: any) => {
      window.dispatchEvent(new CustomEvent('cua:scenario:start', { detail: data }));
    });

    this.socket.on('cua:scenario:result', (data: any) => {
      window.dispatchEvent(new CustomEvent('cua:scenario:result', { detail: data }));
    });

    this.socket.on('cua:test:start', (data: any) => {
      window.dispatchEvent(new CustomEvent('cua:test:start', { detail: data }));
    });

    this.socket.on('cua:test:complete', (data: any) => {
      window.dispatchEvent(new CustomEvent('cua:test:complete', { detail: data }));
    });

    this.cuaListenersSetup = true;
    console.log('[WebSocket] CUA listeners setup complete');
  }

  /**
   * Connect for CUA (Computer Using Agent) testing only
   * Establishes a lightweight WebSocket connection to receive CUA events
   */
  connectForCUA(): void {
    // Reuse existing connection if already connected
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected, reusing for CUA');
      this.setupCUAListeners();
      return;
    }

    const wsUrl = this.getWsUrl();
    console.log('[WebSocket] Connecting for CUA at:', wsUrl);

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected for CUA');
      this.setupCUAListeners();
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] CUA connection disconnected');
      this.cuaListenersSetup = false;
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[WebSocket] CUA connection error:', error.message);
    });
  }

  /**
   * Connect to WebSocket server
   */
  connect(projectId: string, userName: string): void {
    const token = getAuthToken();
    if (!token) {
      console.warn('[WebSocket] No auth token available');
      return;
    }

    // Convert HTTP URL to WebSocket URL properly
    // For remote access (localtunnel, ngrok), use current origin
    let wsUrl: string;
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      if (!isLocalhost) {
        wsUrl = window.location.origin;
      } else {
        wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';
        if (!import.meta.env.VITE_WS_URL && import.meta.env.VITE_API_URL) {
          const apiUrl = import.meta.env.VITE_API_URL.trim().replace(/\/$/, '');
          wsUrl = apiUrl.replace(/^http/, 'ws');
        }
      }
    } else {
      wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';
    }

    this.socket = io(wsUrl, {
      transports: ['polling', 'websocket'], // Try polling first (less noisy)
      auth: {
        token
      },
      reconnection: true, // Enable automatic reconnection
      reconnectionAttempts: 10, // Retry multiple times (was 1)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000, // Longer timeout
      upgrade: false // Disable automatic upgrade
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;

      // Authenticate
      this.socket!.emit('authenticate', { token });

      // Join project room
      this.socket!.emit('join-project', { projectId, userName });
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
    });

    this.socket.on('connect_error', (error) => {
      // Silently handle connection errors - backend may not be running
      // Only log in development and only once to avoid console spam
      if (import.meta.env.DEV && this.reconnectAttempts === 0) {
        console.debug('[WebSocket] Connection unavailable (backend may not be running)');
      }
      this.reconnectAttempts++;

      // Stop reconnection attempts after max attempts
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.socket?.disconnect();
      }
    });

    // Handle presence updates
    this.socket.on('user-joined', (data: { userId: string; userName: string; timestamp: Date }) => {
      console.log('[WebSocket] User joined:', data);
      // Emit custom event for React components
      window.dispatchEvent(new CustomEvent('websocket-user-joined', { detail: data }));
    });

    this.socket.on('user-left', (data: { userId: string; timestamp: Date }) => {
      console.log('[WebSocket] User left:', data);
      window.dispatchEvent(new CustomEvent('websocket-user-left', { detail: data }));
    });

    this.socket.on('presence-list', (data: { users: Array<{ userId: string; userName: string }> }) => {
      console.log('[WebSocket] Presence list:', data);
      window.dispatchEvent(new CustomEvent('websocket-presence-list', { detail: data }));
    });

    // Handle project updates
    this.socket.on('project-updated', (data: any) => {
      console.log('[WebSocket] Project updated:', data);
      window.dispatchEvent(new CustomEvent('websocket-project-updated', { detail: data }));
    });

    // Handle cursor updates
    this.socket.on('cursor-update', (data: { userId: string; userName: string; x: number; y: number }) => {
      window.dispatchEvent(new CustomEvent('websocket-cursor-update', { detail: data }));
    });

    // Handle conflict resolution
    this.socket.on('conflict-resolved', (data: any) => {
      console.log('[WebSocket] Conflict resolved:', data);
      window.dispatchEvent(new CustomEvent('websocket-conflict-resolved', { detail: data }));
    });

    // CUA (Computer Using Agent) Live Testing Events
    // Use shared helper to avoid duplicate listeners
    this.setupCUAListeners();

    this.socket.on('error', (data: { message: string }) => {
      console.error('[WebSocket] Error:', data.message);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(projectId?: string): void {
    if (this.socket) {
      if (projectId) {
        this.socket.emit('leave-project', { projectId });
      }
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Send project update
   */
  sendProjectUpdate(projectId: string, updates: Partial<any>): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocket] Not connected, cannot send update');
      return;
    }

    this.socket.emit('project-update', {
      projectId,
      updates,
      timestamp: new Date()
    });
  }

  /**
   * Send cursor position
   */
  sendCursorMove(projectId: string, x: number, y: number): void {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit('cursor-move', { projectId, x, y });
  }

  /**
   * Resolve conflict
   */
  resolveConflict(projectId: string, conflictId: string, resolution: any): void {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit('resolve-conflict', { projectId, conflictId, resolution });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketClient = new WebSocketClient();

