import { useState, useEffect, useRef, useCallback } from 'react';
import { healthApi } from '@src/services/api';

export interface BackendConnectionStatus {
  isConnected: boolean;
  isChecking: boolean;
  lastCheck: Date | null;
  latency: number | null;
  error: string | null;
  uptime: number | null;
}

const CHECK_INTERVAL = 5000; // Check every 5 seconds
const TIMEOUT = 10000; // 10 second timeout (increased from 3s to handle high load)

export function useBackendConnection() {
  const [status, setStatus] = useState<BackendConnectionStatus>({
    isConnected: false,
    isChecking: true,
    lastCheck: null,
    latency: null,
    error: null,
    uptime: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const checkConnection = useCallback(async () => {
    if (!isMountedRef.current) return;

    setStatus(prev => ({ ...prev, isChecking: true, error: null }));

    const startTime = Date.now();

    try {
      // Use Promise.race to implement timeout
      const healthCheckPromise = healthApi.check();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), TIMEOUT);
      });

      const result = await Promise.race([healthCheckPromise, timeoutPromise]);
      const latency = Date.now() - startTime;

      if (result && typeof result === 'object' && 'status' in result) {
        setStatus({
          isConnected: true,
          isChecking: false,
          lastCheck: new Date(),
          latency,
          error: null,
          uptime: result.uptime || null,
        });
      } else {
        throw new Error('Invalid health check response');
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      setStatus({
        isConnected: false,
        isChecking: false,
        lastCheck: new Date(),
        latency,
        error: error.message || 'Backend server is not responding',
        uptime: null,
      });
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial check
    checkConnection();

    // Set up periodic checks
    intervalRef.current = setInterval(() => {
      checkConnection();
    }, CHECK_INTERVAL);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkConnection]);

  // Manual refresh function
  const refresh = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    ...status,
    refresh,
  };
}
