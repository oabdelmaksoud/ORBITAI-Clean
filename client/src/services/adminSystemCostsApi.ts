/**
 * Admin System Costs API Service
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

export interface SystemCostBreakdown {
  totalCost: number;
  userInitiatedCost: number;
  systemInitiatedCost: number;
  byProvider: Record<string, {
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
    tokens: number;
  }>;
  byModel: Record<string, {
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
    tokens: number;
  }>;
  byRequestType: Record<string, {
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
  }>;
  byContext: Record<string, {
    totalCost: number;
    calls: number;
  }>;
  timeSeries: Array<{
    date: string;
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
  }>;
  topUsers: Array<{
    userId: string;
    totalCost: number;
    calls: number;
    tokens: number;
  }>;
  topProjects: Array<{
    projectId: string;
    totalCost: number;
    calls: number;
    tokens: number;
  }>;
  systemOperations: Array<{
    operation: string;
    totalCost: number;
    calls: number;
  }>;
}

export interface CostSummary {
  totalCost: number;
  userCost: number;
  systemCost: number;
  totalCalls: number;
  userCalls: number;
  systemCalls: number;
  averageCostPerCall: number;
  costPerDay: number;
}

export interface CurrentPeriodCosts {
  today: CostSummary;
  week: CostSummary;
  month: CostSummary;
}

export async function getSystemCostBreakdown(
  token: string,
  options?: {
    startDate?: string;
    endDate?: string;
    provider?: string;
    modelId?: string;
    includeSystemCalls?: boolean;
    includeUserCalls?: boolean;
    groupBy?: 'day' | 'hour' | 'week' | 'month';
  }
): Promise<SystemCostBreakdown> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.provider) params.append('provider', options.provider);
  if (options?.modelId) params.append('modelId', options.modelId);
  if (options?.includeSystemCalls !== undefined) {
    params.append('includeSystemCalls', options.includeSystemCalls.toString());
  }
  if (options?.includeUserCalls !== undefined) {
    params.append('includeUserCalls', options.includeUserCalls.toString());
  }
  if (options?.groupBy) params.append('groupBy', options.groupBy);

  const response = await apiRequest<{ success: boolean; data: SystemCostBreakdown }>(
    `/api/admin/system-costs/breakdown?${params.toString()}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function getCostSummary(
  token: string,
  startDate: string,
  endDate: string
): Promise<CostSummary> {
  const params = new URLSearchParams();
  params.append('startDate', startDate);
  params.append('endDate', endDate);

  const response = await apiRequest<{ success: boolean; data: CostSummary }>(
    `/api/admin/system-costs/summary?${params.toString()}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function getCurrentPeriodCosts(token: string): Promise<CurrentPeriodCosts> {
  const response = await apiRequest<{ success: boolean; data: CurrentPeriodCosts }>(
    '/api/admin/system-costs/current-period',
    { method: 'GET' },
    token
  );
  return response.data;
}




