/**
 * Alert Configuration API Service for Admin Console
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  condition: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    timeWindow?: number;
  };
  channels: {
    email?: string[];
    slack?: string[];
    sms?: string[];
    webhook?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalation?: {
    enabled: boolean;
    delayMinutes: number;
    escalateTo?: string[];
  };
  isActive: boolean;
  lastTriggered?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
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
 * Get all alert rules
 */
export async function getAlertRules(token: string, isActive?: boolean): Promise<AlertRule[]> {
  const params = new URLSearchParams();
  if (isActive !== undefined) params.append('isActive', isActive.toString());

  const response = await apiRequest<{
    success: boolean;
    data: {
      rules: AlertRule[];
    };
  }>(`/api/admin/alerts/rules?${params.toString()}`, {
    method: 'GET',
  }, token);

  return response.data.rules;
}

/**
 * Create an alert rule
 */
export async function createAlertRule(token: string, rule: Partial<AlertRule>): Promise<AlertRule> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      rule: AlertRule;
    };
  }>(`/api/admin/alerts/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  }, token);

  return response.data.rule;
}

/**
 * Update an alert rule
 */
export async function updateAlertRule(token: string, ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      rule: AlertRule;
    };
  }>(`/api/admin/alerts/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  return response.data.rule;
}

/**
 * Delete an alert rule
 */
export async function deleteAlertRule(token: string, ruleId: string): Promise<void> {
  await apiRequest(`/api/admin/alerts/rules/${ruleId}`, {
    method: 'DELETE',
  }, token);
}

/**
 * Test an alert rule
 */
export async function testAlertRule(token: string, ruleId: string): Promise<void> {
  await apiRequest(`/api/admin/alerts/rules/${ruleId}/test`, {
    method: 'POST',
  }, token);
}
















