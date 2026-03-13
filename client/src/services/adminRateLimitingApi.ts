/**
 * Admin Rate Limiting API Service
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

export interface RateLimitRule {
  _id: string;
  name: string;
  description?: string;
  scope: 'global' | 'user' | 'plan' | 'ip' | 'endpoint';
  scopeValue?: string;
  limit: number;
  windowMs: number;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitStats {
  total: number;
  active: number;
  inactive: number;
  byScope: Array<{
    _id: string;
    count: number;
    active: number;
  }>;
}

export async function getRateLimitRules(
  token: string,
  options?: { scope?: string; isActive?: boolean }
): Promise<RateLimitRule[]> {
  const params = new URLSearchParams();
  if (options?.scope) params.append('scope', options.scope);
  if (options?.isActive !== undefined) params.append('isActive', options.isActive.toString());

  const response = await apiRequest<{ success: boolean; data: { rules: RateLimitRule[] } }>(
    `/api/admin/rate-limits?${params.toString()}`,
    { method: 'GET' },
    token
  );
  return response.data.rules;
}

export async function createRateLimitRule(
  token: string,
  rule: {
    name: string;
    description?: string;
    scope: 'global' | 'user' | 'plan' | 'ip' | 'endpoint';
    scopeValue?: string;
    limit: number;
    windowMs: number;
    priority?: number;
  }
): Promise<RateLimitRule> {
  const response = await apiRequest<{ success: boolean; data: RateLimitRule }>(
    '/api/admin/rate-limits',
    {
      method: 'POST',
      body: JSON.stringify(rule),
    },
    token
  );
  return response.data;
}

export async function updateRateLimitRule(
  token: string,
  id: string,
  updates: Partial<RateLimitRule>
): Promise<RateLimitRule> {
  const response = await apiRequest<{ success: boolean; data: RateLimitRule }>(
    `/api/admin/rate-limits/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    token
  );
  return response.data;
}

export async function deleteRateLimitRule(token: string, id: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/rate-limits/${id}`,
    { method: 'DELETE' },
    token
  );
}

export async function getUserRateLimits(
  token: string,
  userId: string
): Promise<RateLimitRule[]> {
  const response = await apiRequest<{ success: boolean; data: { rules: RateLimitRule[] } }>(
    `/api/admin/rate-limits/user/${userId}`,
    { method: 'GET' },
    token
  );
  return response.data.rules;
}

export async function setUserRateLimits(
  token: string,
  userId: string,
  options: {
    limit: number;
    windowMs: number;
    name?: string;
  }
): Promise<RateLimitRule> {
  const response = await apiRequest<{ success: boolean; data: RateLimitRule }>(
    `/api/admin/rate-limits/user/${userId}`,
    {
      method: 'POST',
      body: JSON.stringify(options),
    },
    token
  );
  return response.data;
}

export async function getRateLimitStats(token: string): Promise<RateLimitStats> {
  const response = await apiRequest<{ success: boolean; data: RateLimitStats }>(
    '/api/admin/rate-limits/stats',
    { method: 'GET' },
    token
  );
  return response.data;
}




