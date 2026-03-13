/**
 * Security API Service for Admin Console
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface SecurityEvent {
  id: string;
  type: 'failed_login' | 'suspicious_activity' | 'brute_force' | 'unauthorized_access' | 'data_breach_attempt' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  email: string;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
}

export interface IPWhitelistEntry {
  id: string;
  ipAddress: string;
  type: 'whitelist' | 'blacklist';
  reason?: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
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
 * Get security events
 */
export async function getSecurityEvents(
  token: string,
  options?: {
    page?: number;
    limit?: number;
    type?: string;
    severity?: string;
    resolved?: boolean;
    ipAddress?: string;
  }
): Promise<{
  events: SecurityEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.type) params.append('type', options.type);
  if (options?.severity) params.append('severity', options.severity);
  if (options?.resolved !== undefined) params.append('resolved', options.resolved.toString());
  if (options?.ipAddress) params.append('ipAddress', options.ipAddress);

  const response = await apiRequest<{
    success: boolean;
    data: {
      events: SecurityEvent[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  }>(`/api/admin/security/events?${params.toString()}`, {
    method: 'GET',
  }, token);

  return response.data;
}

/**
 * Get security event statistics
 */
export async function getSecurityEventStats(token: string): Promise<{
  total: number;
  unresolved: number;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      total: number;
      unresolved: number;
      last24Hours: number;
      last7Days: number;
      last30Days: number;
      byType: Record<string, number>;
      bySeverity: Record<string, number>;
    };
  }>(`/api/admin/security/events/stats`, {
    method: 'GET',
  }, token);

  return response.data;
}

/**
 * Mark security event as resolved
 */
export async function resolveSecurityEvent(token: string, eventId: string): Promise<void> {
  await apiRequest(`/api/admin/security/events/${eventId}/resolve`, {
    method: 'PUT',
  }, token);
}

/**
 * Get active sessions
 */
export async function getSessions(token: string, userId?: string): Promise<Session[]> {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);

  const response = await apiRequest<{
    success: boolean;
    data: {
      sessions: Session[];
    };
  }>(`/api/admin/security/sessions?${params.toString()}`, {
    method: 'GET',
  }, token);

  return response.data.sessions;
}

/**
 * Revoke a session
 */
export async function revokeSession(token: string, sessionId: string): Promise<void> {
  await apiRequest(`/api/admin/security/sessions/${sessionId}`, {
    method: 'DELETE',
  }, token);
}

/**
 * Get IP whitelist/blacklist
 */
export async function getIPWhitelist(token: string, type?: 'whitelist' | 'blacklist'): Promise<IPWhitelistEntry[]> {
  const params = new URLSearchParams();
  if (type) params.append('type', type);

  const response = await apiRequest<{
    success: boolean;
    data: {
      ips: IPWhitelistEntry[];
    };
  }>(`/api/admin/security/ip-whitelist?${params.toString()}`, {
    method: 'GET',
  }, token);

  return response.data.ips;
}

/**
 * Add IP to whitelist or blacklist
 */
export async function addIPWhitelist(
  token: string,
  data: {
    ipAddress: string;
    type: 'whitelist' | 'blacklist';
    reason?: string;
    expiresAt?: string;
  }
): Promise<IPWhitelistEntry> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      ip: IPWhitelistEntry;
    };
  }>(`/api/admin/security/ip-whitelist`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

  return response.data.ip;
}

/**
 * Remove IP from whitelist/blacklist
 */
export async function removeIPWhitelist(token: string, ipId: string): Promise<void> {
  await apiRequest(`/api/admin/security/ip-whitelist/${ipId}`, {
    method: 'DELETE',
  }, token);
}
















