/**
 * Admin Monitoring API Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API Error: ${response.statusText}`);
  }

  return data;
}

export interface SystemMetrics {
  activeSessions: number;
  activeRequests: number;
  queueSize: number;
  queuePending: number;
  queueProcessing: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  uptime: number;
  timestamp: Date;
}

export interface ActiveSession {
  id: string;
  userId: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export interface ActiveRequest {
  id: string;
  method: string;
  path: string;
  userId?: string;
  startedAt: Date;
  duration: number;
}

export interface QueueStatus {
  available: boolean;
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  error?: string;
}

export async function getSystemMetrics(token: string): Promise<SystemMetrics> {
  const response = await apiRequest<{ success: boolean; data: SystemMetrics }>(
    '/api/admin/monitoring/metrics',
    { method: 'GET' },
    token
  );
  return response.data;
}

export function createLiveMetricsStream(
  token: string,
  onMessage: (metrics: SystemMetrics) => void,
  onError?: (error: Error) => void
): EventSource {
  // Note: EventSource doesn't support custom headers, so we'll use a different approach
  // For now, return null and use polling instead
  // In production, use WebSocket or implement token-based SSE endpoint
  throw new Error('SSE not fully implemented - use polling with getSystemMetrics instead');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'metrics' && data.data) {
        onMessage(data.data);
      }
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
    }
  };

  eventSource.onerror = (error) => {
    if (onError) {
      onError(new Error('EventSource connection error'));
    }
  };

  return eventSource;
}

export async function getActiveSessions(token: string): Promise<ActiveSession[]> {
  const response = await apiRequest<{ success: boolean; data: { sessions: ActiveSession[] } }>(
    '/api/admin/monitoring/active-sessions',
    { method: 'GET' },
    token
  );
  return response.data.sessions;
}

export async function killSession(token: string, sessionId: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/monitoring/kill-session/${sessionId}`,
    { method: 'POST' },
    token
  );
}

export async function getActiveRequests(token: string): Promise<ActiveRequest[]> {
  const response = await apiRequest<{ success: boolean; data: { requests: ActiveRequest[] } }>(
    '/api/admin/monitoring/active-requests',
    { method: 'GET' },
    token
  );
  return response.data.requests;
}

export async function cancelRequest(token: string, requestId: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/monitoring/cancel-request/${requestId}`,
    { method: 'POST' },
    token
  );
}

export async function getQueueStatus(token: string): Promise<QueueStatus> {
  const response = await apiRequest<{ success: boolean; data: QueueStatus }>(
    '/api/admin/monitoring/queue-status',
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function clearQueue(token: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    '/api/admin/monitoring/clear-queue',
    { method: 'POST' },
    token
  );
}

