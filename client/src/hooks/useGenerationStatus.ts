/**
 * useGenerationStatus Hook
 * Subscribes to real-time generation status updates via WebSocket
 * for displaying actual AI thoughts and process info in Mission Control
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Match the backend GenerationStatusEvent structure
export interface GenerationStatusEvent {
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
}

interface UseGenerationStatusResult {
    statusLogs: GenerationStatusEvent[];
    isConnected: boolean;
    progress: number;
    isComplete: boolean;
    createSession: () => string;
    clearLogs: () => void;
}

const SOCKET_URL = (() => {
    // For remote access (localtunnel, ngrok), use current origin
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        if (!isLocalhost) {
            return window.location.origin;
        }
    }
    // Local development
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
})();

export function useGenerationStatus(sessionId: string | null): UseGenerationStatusResult {
    const [statusLogs, setStatusLogs] = useState<GenerationStatusEvent[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const currentSessionRef = useRef<string | null>(null);

    // Create a new session ID
    const createSession = useCallback((): string => {
        const newSessionId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return newSessionId;
    }, []);

    // Clear logs
    const clearLogs = useCallback(() => {
        setStatusLogs([]);
        setProgress(0);
        setIsComplete(false);
    }, []);

    useEffect(() => {
        // Don't connect if no session ID
        if (!sessionId) {
            return;
        }

        // Avoid reconnecting to the same session
        if (currentSessionRef.current === sessionId && socketRef.current?.connected) {
            return;
        }

        // Cleanup previous connection if exists
        if (socketRef.current) {
            if (currentSessionRef.current) {
                socketRef.current.emit('leave-generation-session', { sessionId: currentSessionRef.current });
            }
            socketRef.current.disconnect();
        }

        currentSessionRef.current = sessionId;
        clearLogs();

        // Create new socket connection
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[GenerationStatus] WebSocket connected');
            setIsConnected(true);

            // Join the generation session
            socket.emit('join-generation-session', { sessionId });
        });

        socket.on('generation-session-joined', (data: { sessionId: string }) => {
            console.log(`[GenerationStatus] Joined session: ${data.sessionId}`);
        });

        socket.on('generation-status', (data: { sessionId: string; event: GenerationStatusEvent }) => {
            if (data.sessionId === sessionId) {
                console.log(`[GenerationStatus] Received event: ${data.event.type} - ${data.event.message}`);

                setStatusLogs(prev => [...prev, data.event]);

                // Update progress if provided
                if (data.event.metadata?.progress !== undefined) {
                    setProgress(data.event.metadata.progress);
                }

                // Mark as complete
                if (data.event.type === 'complete') {
                    setIsComplete(true);
                    setProgress(100);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('[GenerationStatus] WebSocket disconnected');
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('[GenerationStatus] Connection error:', error);
            setIsConnected(false);
        });

        // Cleanup on unmount or session change
        return () => {
            if (socket && sessionId) {
                socket.emit('leave-generation-session', { sessionId });
            }
            socket.disconnect();
            socketRef.current = null;
            currentSessionRef.current = null;
        };
    }, [sessionId, clearLogs]);

    return {
        statusLogs,
        isConnected,
        progress,
        isComplete,
        createSession,
        clearLogs,
    };
}

// Helper to format log message with timestamp
export function formatLogMessage(event: GenerationStatusEvent): string {
    const time = new Date(event.timestamp).toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return `${time}  ${event.message}`;
}

// Helper to get CSS class for log type
export function getLogTypeClass(type: GenerationStatusEvent['type']): string {
    switch (type) {
        case 'ai_thought':
            return 'text-purple-600 font-medium';
        case 'model_selection':
            return 'text-amber-600 font-semibold';
        case 'process_stage':
            return 'text-blue-600';
        case 'progress':
            return 'text-green-600';
        case 'error':
            return 'text-red-600 font-bold';
        case 'complete':
            return 'text-green-700 font-bold';
        case 'debug':
        default:
            return 'text-slate-500';
    }
}

export default useGenerationStatus;
