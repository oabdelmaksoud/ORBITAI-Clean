import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@src/services/api';
import { Idea } from '../components/OrbGraph';
import { BrainstormingRoom } from '@src/services/brainstormingRoomApi';

export interface UserPresence {
  userId: string;
  userName: string;
  lastSeen: Date;
  cursorPosition?: { x: number; y: number; ideaId?: string };
}

export interface UseBrainstormingRoomWebSocketCallbacks {
  onRoomUpdate?: (data: {
    type: 'idea' | 'hmw' | 'topic' | 'participant';
    payload: any;
  }) => void;
  onUserJoined?: (data: { userId: string; userName: string; timestamp: Date }) => void;
  onUserLeft?: (data: { userId: string; userName: string; timestamp: Date }) => void;
  onPresenceList?: (users: Array<{ userId: string; userName: string }>) => void;
  onCursorMove?: (data: { userId: string; userName: string; cursorPosition: { x: number; y: number; ideaId?: string } }) => void;
  onError?: (error: string) => void;
}

export const useBrainstormingRoomWebSocket = (
  roomId: string | null | undefined,
  userName: string | null | undefined,
  userId: string | null | undefined,
  callbacks: UseBrainstormingRoomWebSocketCallbacks = {}
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [presences, setPresences] = useState<Map<string, UserPresence>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const lastCursorPositionRef = useRef<{ x: number; y: number; ideaId?: string } | null>(null);
  const cursorThrottleRef = useRef<NodeJS.Timeout | null>(null);

  const {
    onRoomUpdate,
    onUserJoined,
    onUserLeft,
    onPresenceList,
    onCursorMove,
    onError
  } = callbacks;

  // Connect to WebSocket
  useEffect(() => {

    if (!roomId || !userName || !userId) {
      return;
    }

    // Convert HTTP URL / WebSocket URL properly
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
    const token = getAuthToken();

    if (!token) {
      onError?.('Not authenticated');
      return;
    }

    // Initialize socket

    const socket = io(wsUrl, {
      auth: { token },
      transports: ['polling', 'websocket'], // Try polling first (less noisy)
      reconnection: false, // Disable automatic reconnection
      reconnectionAttempts: 1, // Only try once
      reconnectionDelay: 5000,
      timeout: 5000, // Fail fast
      upgrade: false // Disable automatic upgrade
    });

    socketRef.current = socket;

    socket.on('connect', () => {

      setIsConnected(true);

      // Authenticate
      socket.emit('authenticate', { token });

      // Join brainstorming room
      socket.emit('join-brainstorming-room', {
        roomId,
        userName
      });
    });

    socket.on('disconnect', () => {

      setIsConnected(false);
    });

    socket.on('error', (error: { message: string }) => {

      onError?.(error.message || 'WebSocket error');
    });

    // Listen for room updates
    socket.on('brainstorming-room-updated', (data: {
      type: 'idea' | 'hmw' | 'topic' | 'participant';
      payload: any;
      userId?: string;
    }) => {
      // Don't process updates from ourselves
      if (data.userId === userId) {
        return;
      }

      onRoomUpdate?.(data);
    });

    // Listen for user join/leave events
    socket.on('user-joined-brainstorming-room', (data: {
      userId: string;
      userName: string;
      timestamp: Date;
    }) => {
      setPresences(prev => {
        const next = new Map(prev);
        next.set(data.userId, {
          userId: data.userId,
          userName: data.userName,
          lastSeen: new Date(data.timestamp)
        });
        return next;
      });

      onUserJoined?.(data);
    });

    socket.on('user-left-brainstorming-room', (data: {
      userId: string;
      userName: string;
      timestamp: Date;
    }) => {
      setPresences(prev => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });

      onUserLeft?.(data);
    });

    // Listen for presence list
    socket.on('brainstorming-room-presence-list', (data: {
      users: Array<{ userId: string; userName: string }>;
    }) => {
      const presenceMap = new Map<string, UserPresence>();
      data.users.forEach(user => {
        presenceMap.set(user.userId, {
          userId: user.userId,
          userName: user.userName,
          lastSeen: new Date()
        });
      });
      setPresences(presenceMap);

      onPresenceList?.(data.users);
    });

    // Listen for cursor movements
    socket.on('brainstorming-room-cursor-move', (data: {
      userId: string;
      userName: string;
      cursorPosition: { x: number; y: number; ideaId?: string };
    }) => {
      // Don't process our own cursor
      if (data.userId === userId) {
        return;
      }

      setPresences(prev => {
        const next = new Map(prev);
        const existing = next.get(data.userId);
        if (existing) {
          next.set(data.userId, {
            ...existing,
            cursorPosition: data.cursorPosition,
            lastSeen: new Date()
          });
        }
        return next;
      });

      onCursorMove?.(data);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-brainstorming-room', { roomId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [roomId, userName, userId, onRoomUpdate, onUserJoined, onUserLeft, onPresenceList, onCursorMove, onError]);

  // Broadcast idea update
  const broadcastIdeaUpdate = useCallback((idea: Idea, action: 'add' | 'update' | 'delete') => {
    if (!socketRef.current || !isConnected || !roomId) {
      return;
    }

    socketRef.current.emit('brainstorming-room-update', {
      roomId,
      type: 'idea',
      action,
      payload: idea
    });
  }, [isConnected, roomId]);

  // Broadcast HMW question update
  const broadcastHMWUpdate = useCallback((question: any, action: 'add' | 'update' | 'delete') => {
    if (!socketRef.current || !isConnected || !roomId) {
      return;
    }

    socketRef.current.emit('brainstorming-room-update', {
      roomId,
      type: 'hmw',
      action,
      payload: question
    });
  }, [isConnected, roomId]);

  // Broadcast cursor movement (throttled)
  const broadcastCursorMove = useCallback((cursorPosition: { x: number; y: number; ideaId?: string }) => {
    if (!socketRef.current || !isConnected || !roomId) {
      return;
    }

    // Throttle cursor updates (only send every 100ms)
    if (cursorThrottleRef.current) {
      return;
    }

    // Check if position actually changed
    const lastPos = lastCursorPositionRef.current;
    if (lastPos &&
      lastPos.x === cursorPosition.x &&
      lastPos.y === cursorPosition.y &&
      lastPos.ideaId === cursorPosition.ideaId) {
      return;
    }

    lastCursorPositionRef.current = cursorPosition;

    cursorThrottleRef.current = setTimeout(() => {
      socketRef.current?.emit('brainstorming-room-cursor-move', {
        roomId,
        cursorPosition
      });
      cursorThrottleRef.current = null;
    }, 100);
  }, [isConnected, roomId]);

  // Cleanup cursor throttle on unmount
  useEffect(() => {
    return () => {
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    presences: Array.from(presences.values()),
    broadcastIdeaUpdate,
    broadcastHMWUpdate,
    broadcastCursorMove
  };
};
