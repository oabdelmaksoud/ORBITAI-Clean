/**
 * Activity Feed API Service for Admin Console
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface ActivityEvent {
  id: string;
  type: 'user_login' | 'user_logout' | 'project_created' | 'project_updated' | 'project_deleted' | 'payment_success' | 'payment_failed' | 'api_call' | 'error' | 'admin_action' | 'agent_assessment_started' | 'agent_assessment_completed' | 'agent_refinement_started' | 'agent_refinement_completed' | 'agent_assessment_failed';
  userId?: string;
  userEmail?: string;
  entityType?: string;
  entityId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  timestamp: string;
}

export interface ActivityStats {
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  byType: Record<string, number>;
  byEntityType: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topIPs: Array<{ ipAddress: string; count: number }>;
}

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
    throw new Error(data.error?.message || data.message || `API Error: ${response.statusText}`);
  }

  return data;
}

/**
 * Get activity events
 */
export async function getActivityEvents(
  token: string,
  options?: {
    limit?: number;
    type?: string;
    userId?: string;
    entityType?: string;
    since?: string; // ISO timestamp
  }
): Promise<ActivityEvent[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.type) params.append('type', options.type);
  if (options?.userId) params.append('userId', options.userId);
  if (options?.entityType) params.append('entityType', options.entityType);
  if (options?.since) params.append('since', options.since);

  const response = await apiRequest<{
    success: boolean;
    data: {
      events: ActivityEvent[];
    };
  }>(`/api/admin/activity?${params.toString()}`, {
    method: 'GET',
  }, token);

  return response.data.events;
}

/**
 * Get activity statistics
 */
export async function getActivityStats(token: string): Promise<ActivityStats> {
  const response = await apiRequest<{
    success: boolean;
    data: ActivityStats;
  }>(`/api/admin/activity/stats`, {
    method: 'GET',
  }, token);

  return response.data;
}














