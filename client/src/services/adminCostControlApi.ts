/**
 * Admin Cost Control API Service
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

export interface UserCostBreakdown {
  userId: string;
  totalCost: number;
  byService: Record<string, number>;
  byProject: Record<string, number>;
  period: {
    start: Date;
    end: Date;
  };
}

export interface ProjectCostBreakdown {
  projectId: string;
  totalCost: number;
  byService: Record<string, number>;
  period: {
    start: Date;
    end: Date;
  };
}

export interface CostForecast {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface CostAlert {
  id: string;
  userId?: string;
  projectId?: string;
  threshold: number;
  current: number;
  triggered: boolean;
  createdAt: Date;
}

// Note: These endpoints need to be implemented in the backend
// For now, these are placeholder functions

export async function getUserCostBreakdown(
  token: string,
  userId: string
): Promise<UserCostBreakdown> {
  const response = await apiRequest<{ success: boolean; data: UserCostBreakdown }>(
    `/api/admin/costs/user/${userId}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function setUserCostLimit(
  token: string,
  userId: string,
  limit: number
): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/costs/user/${userId}/limit`,
    {
      method: 'POST',
      body: JSON.stringify({ limit }),
    },
    token
  );
}

export async function getProjectCostBreakdown(
  token: string,
  projectId: string
): Promise<ProjectCostBreakdown> {
  const response = await apiRequest<{ success: boolean; data: ProjectCostBreakdown }>(
    `/api/admin/costs/project/${projectId}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function setProjectCostLimit(
  token: string,
  projectId: string,
  limit: number
): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/admin/costs/project/${projectId}/limit`,
    {
      method: 'POST',
      body: JSON.stringify({ limit }),
    },
    token
  );
}

export async function getCostForecast(token: string): Promise<CostForecast> {
  const response = await apiRequest<{ success: boolean; data: CostForecast }>(
    '/api/admin/costs/forecast',
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function configureCostAlerts(
  token: string,
  alerts: Array<{
    userId?: string;
    projectId?: string;
    threshold: number;
  }>
): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    '/api/admin/costs/alerts',
    {
      method: 'POST',
      body: JSON.stringify({ alerts }),
    },
    token
  );
}




