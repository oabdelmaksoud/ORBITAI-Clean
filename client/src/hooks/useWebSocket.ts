/**
 * useWebSocket Hook
 * 
 * Manages WebSocket connection for real-time feature flag updates.
 * Extracted from App.tsx for better maintainability.
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
    onFeatureFlagUpdate?: (featureKey?: string) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    enabled?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const { onFeatureFlagUpdate, onConnect, onDisconnect, enabled = true } = options;

    const socketRef = useRef<any>(null);
    const isConnectedRef = useRef(false);

    /**
     * Setup WebSocket connection
     */
    const setupWebSocket = useCallback(async () => {
        if (!enabled) return;

        try {
            // Delay WebSocket connection slightly to not block initial render
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Dynamically import socket.io-client only if needed
            const { io } = await import('socket.io-client');

            // Get API base URL
            const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
            let API_BASE_URL = getApiBaseUrl();

            // Ensure URL is properly formatted
            API_BASE_URL = API_BASE_URL.trim().replace(/\/$/, '');
            if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
                API_BASE_URL = 'http://' + API_BASE_URL;
            }

            socketRef.current = io(API_BASE_URL, {
                transports: ['polling', 'websocket'],
                reconnection: false,
                reconnectionDelay: 5000,
                reconnectionDelayMax: 10000,
                reconnectionAttempts: 1,
                timeout: 5000,
                forceNew: false,
                upgrade: false,
                autoConnect: false
            });

            socketRef.current.connect();

            socketRef.current.on('connect', () => {
                isConnectedRef.current = true;
                if (import.meta.env.DEV) {
                    console.log('[WebSocket] Connected for feature flag updates');
                }
                onConnect?.();
            });

            socketRef.current.on('connect_error', (error: any) => {
                // Silent - backend not running or WebSocket not ready
                isConnectedRef.current = false;
                if (error.message) {
                    error.preventDefault = () => { };
                }
            });

            socketRef.current.on('disconnect', () => {
                isConnectedRef.current = false;
                onDisconnect?.();
            });

            socketRef.current.on('broadcast', (message: { type: string; featureKey?: string; message?: string }) => {
                if (import.meta.env.DEV) {
                    console.log('[WebSocket] Received broadcast:', message);
                }
                if (message.type === 'feature_flag_updated') {
                    onFeatureFlagUpdate?.(message.featureKey);
                }
            });

        } catch (error) {
            // Silent failure - WebSocket is non-critical
            if (import.meta.env.DEV) {
                console.debug('[WebSocket] Setup failed (non-critical):', error);
            }
        }
    }, [enabled, onConnect, onDisconnect, onFeatureFlagUpdate]);

    /**
     * Disconnect WebSocket
     */
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            isConnectedRef.current = false;
        }
    }, []);

    /**
     * Send message via WebSocket
     */
    const send = useCallback((event: string, data: any) => {
        if (socketRef.current && isConnectedRef.current) {
            socketRef.current.emit(event, data);
        }
    }, []);

    // Setup on mount
    useEffect(() => {
        setupWebSocket();

        return () => {
            disconnect();
        };
    }, [setupWebSocket, disconnect]);

    return {
        isConnected: isConnectedRef.current,
        socket: socketRef.current,
        disconnect,
        send,
        reconnect: setupWebSocket,
    };
}

export default useWebSocket;
