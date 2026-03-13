/**
 * Extended Admin API Service - Additional endpoints for new features
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function for authenticated API calls
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Bypass-Tunnel-Reminder': 'true', // Fix for localtunnel 511 error
        ...headers,
      },
    });

    // Read response as text first (can only read body once)
    const text = await response.text();

    // Check Content-Type to determine if we should parse as JSON
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType && contentType.includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        // If JSON parsing fails, use the text as error message
        if (!response.ok) {
          throw new Error(text || `Failed to parse JSON response: ${response.statusText}`);
        }
        // For successful responses that aren't valid JSON, return text
        return text as any;
      }
    } else {
      // Non-JSON response
      if (!response.ok) {
        throw new Error(text || `API Error: ${response.statusText}`);
      }
      // For non-JSON successful responses, return the text
      return text as any;
    }

    if (!response.ok) {
      throw new Error(data.error?.message || data.message || text || `API Error: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error('Admin API Request Error:', error);
    throw error;
  }
}

// ============ PACKAGE MANAGEMENT ============

export interface Package {
  id: string; // MongoDB _id as string
  displayName: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  features: Array<{
    key: string;
    label: string;
    value: string | number | boolean;
    type: 'string' | 'number' | 'boolean';
  }>;
  limits: {
    maxProjects: number;
    maxAgents: number;
    maxTasks: number;
    maxStorageGB: number;
    maxAPICalls: number;
    maxTeamMembers: number;
    maxMonthlyBudget: number;
    maxFileSizeMB: number;
    maxMCPServers: number;
    maxArtifactsPerProject: number;
    maxBackupVersions: number;
    maxConcurrentExecutions: number;
    internetAccessEnabled: boolean;
    codeExecutionEnabled: boolean;
    cloudDeploymentEnabled: boolean;
    maxLLMCallsPerMonth?: number;
    maxTokensPerMonth?: number;
    allowedLLMModels?: string[];
    multiLLMEnabled?: boolean;
    premiumModelsEnabled?: boolean;
  };
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  metadata?: {
    color?: string;
    icon?: string;
    highlight?: boolean;
  };
}

export async function getPackages(token: string): Promise<Package[]> {
  const response = await apiRequest<{
    success: boolean;
    data: { packages: Package[] };
  }>('/api/admin/packages', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch packages');
  }

  return response.data.packages;
}

export async function getPackage(token: string, packageId: string): Promise<Package> {
  const response = await apiRequest<{
    success: boolean;
    data: { package: Package };
  }>(`/api/admin/packages/${packageId}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch package');
  }

  return response.data.package;
}

export async function createPackage(token: string, packageData: Partial<Package>): Promise<Package> {
  const response = await apiRequest<{
    success: boolean;
    data: { package: Package };
  }>('/api/admin/packages', {
    method: 'POST',
    body: JSON.stringify(packageData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create package');
  }

  return response.data.package;
}

export async function updatePackage(token: string, packageId: string, updates: Partial<Package>): Promise<Package> {
  const response = await apiRequest<{
    success: boolean;
    data: { package: Package };
  }>(`/api/admin/packages/${packageId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update package');
  }

  return response.data.package;
}

export async function deletePackage(token: string, packageId: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/admin/packages/${packageId}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete package');
  }
}

// ============ AUDIT LOGS ============

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: Date;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getAuditLogs(
  token: string,
  options?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.action) params.append('action', options.action);
  if (options?.entityType) params.append('entityType', options.entityType);
  if (options?.userId) params.append('userId', options.userId);
  if (options?.status) params.append('status', options.status);
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);

  const queryString = params.toString();
  const endpoint = `/api/admin/audit${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{
    success: boolean;
    data: AuditLogListResponse;
  }>(endpoint, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch audit logs');
  }

  return response.data;
}

export async function getAuditLogStats(token: string): Promise<any> {
  const response = await apiRequest<{
    success: boolean;
    data: any;
  }>('/api/admin/audit/stats/summary', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch audit log stats');
  }

  return response.data;
}

// ============ EXPORT ============

export async function exportUsers(
  token: string,
  format: 'csv' | 'json' = 'csv',
  filters?: {
    role?: string;
    plan?: string;
    isActive?: boolean;
  }
): Promise<Blob> {
  const params = new URLSearchParams();
  params.append('format', format);
  if (filters?.role) params.append('role', filters.role);
  if (filters?.plan) params.append('plan', filters.plan);
  if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());

  const response = await fetch(`${API_BASE_URL}/api/admin/export/users?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export users');
  }

  return await response.blob();
}

export async function exportProjects(
  token: string,
  format: 'csv' | 'json' = 'csv',
  filters?: {
    phase?: string;
    methodology?: string;
    userId?: string;
  }
): Promise<Blob> {
  const params = new URLSearchParams();
  params.append('format', format);
  if (filters?.phase) params.append('phase', filters.phase);
  if (filters?.methodology) params.append('methodology', filters.methodology);
  if (filters?.userId) params.append('userId', filters.userId);

  const response = await fetch(`${API_BASE_URL}/api/admin/export/projects?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export projects');
  }

  return await response.blob();
}

// ============ BULK ACTIONS ============

export async function bulkUserAction(
  token: string,
  action: 'activate' | 'deactivate' | 'delete' | 'changePlan',
  userIds: string[],
  options?: { plan?: string }
): Promise<{ affected: number; total: number }> {
  const response = await apiRequest<{
    success: boolean;
    data: { affected: number; total: number };
  }>('/api/admin/bulk/users', {
    method: 'POST',
    body: JSON.stringify({
      action,
      userIds,
      ...options
    }),
  }, token);

  if (!response.success) {
    throw new Error(`Failed to ${action} users`);
  }

  return response.data;
}

export async function bulkProjectAction(
  token: string,
  action: 'delete' | 'archive',
  projectIds: string[]
): Promise<{ affected: number; total: number }> {
  const response = await apiRequest<{
    success: boolean;
    data: { affected: number; total: number };
  }>('/api/admin/bulk/projects', {
    method: 'POST',
    body: JSON.stringify({
      action,
      projectIds
    }),
  }, token);

  if (!response.success) {
    throw new Error(`Failed to ${action} projects`);
  }

  return response.data;
}

// ============ FINANCIAL DASHBOARD ============

export interface FinancialDashboard {
  revenue: {
    totalMRR: number;
    annualRunRate: number;
    byPlan: Record<string, {
      users: number;
      price: number;
      mrr: number;
    }>;
  };
  costs?: {
    todayLLMCost: number;
    projectedMonthlyLLMCost: number;
    projectedYearlyLLMCost: number;
  };
  users: {
    byPlan: Record<string, {
      total: number;
      active: number;
      inactive: number;
    }>;
  };
  growth: {
    last30Days: number;
    previous30Days: number;
    growthRate: number;
  };
  signups: Array<{
    date: string;
    count: number;
    plans: string[];
  }>;
}

export async function getFinancialDashboard(token: string): Promise<FinancialDashboard> {
  const response = await apiRequest<{
    success: boolean;
    data: FinancialDashboard;
  }>('/api/admin/financial/dashboard', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch financial dashboard');
  }

  return response.data;
}

// ============ ANALYTICS ============

export interface AnalyticsOverview {
  users: {
    total: number;
    last30Days: number;
    last7Days: number;
    today: number;
    active7d: number;
  };
  projects: {
    total: number;
    active: number;
    last30Days: number;
    last7Days: number;
  };
  breakdown: {
    projectsByPhase: Record<string, number>;
    usersByPlan: Record<string, number>;
  };
  trends: {
    dailySignups: Array<{ date: string; count: number }>;
    dailyProjects: Array<{ date: string; count: number }>;
  };
}

// ============ LLM MANAGEMENT ============

export interface LLMModel {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'custom';
  modelIdentifier: string;
  capabilities: {
    structuredOutput: boolean;
    codeGeneration: boolean;
    longContext: boolean;
    fastResponse: boolean;
    streaming: boolean;
  };
  limits: {
    maxTokens: number;
    maxContextLength: number;
    maxOutputTokens?: number;
  };
  pricing: {
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
  };
  performance: {
    avgLatencyMs: number;
    reliability: number;
  };
  recommendedFor: {
    agentRoles: string[];
    taskTypes: string[];
    complexity: ('simple' | 'moderate' | 'complex')[];
  };
  status: 'active' | 'maintenance' | 'deprecated';
  isEnabled: boolean;
  apiKeyConfigured?: boolean;
  apiKeySource?: 'database' | 'environment' | 'none';
}

export interface LLMConfig {
  enableMultiLLM: boolean;
  defaultLLMProvider: string;
  llmRoutingStrategy: string;
  providers: {
    gemini: { configured: boolean; hasKey: boolean };
    openai: { configured: boolean; hasKey: boolean };
    anthropic: { configured: boolean; hasKey: boolean };
    deepseek?: { configured: boolean; hasKey: boolean };
    grok?: { configured: boolean; hasKey: boolean };
  };
}

export async function getLLMModels(token: string): Promise<{ models: LLMModel[]; config: LLMConfig }> {
  const response = await apiRequest<{
    success: boolean;
    data: { models: LLMModel[]; config: LLMConfig };
  }>('/api/admin/llm/models', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch LLM models');
  }

  return response.data;
}

export async function updateLLMModel(token: string, modelId: string, updates: Partial<LLMModel>): Promise<LLMModel> {
  const response = await apiRequest<{
    success: boolean;
    data: { model: LLMModel };
  }>(`/api/admin/llm/models/${modelId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update LLM model');
  }

  return response.data.model;
}

export async function enableLLMModel(token: string, modelId: string, enabled: boolean): Promise<LLMModel> {
  const response = await apiRequest<{
    success: boolean;
    data: { model: LLMModel; message: string };
    message?: string;
  }>(`/api/admin/llm/models/${modelId}/enable`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  }, token);

  if (!response.success) {
    throw new Error((response as any).message || 'Failed to enable/disable LLM model');
  }

  return response.data.model;
}

export interface ModelTestResult {
  model: string;
  status: 'operational' | 'test_failed';
  testResult?: {
    response: string;
    modelUsed: string;
    provider: string;
    tokensUsed: number;
    fallbackUsed: boolean;
  };
  error?: string;
  message: string;
}

export async function testLLMModel(token: string, modelId: string, prompt?: string): Promise<ModelTestResult> {
  const response = await apiRequest<{
    success: boolean;
    data: ModelTestResult;
  }>(`/api/admin/llm/test/${modelId}`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  }, token);

  // If success is false, it means API key is not configured or test failed
  if (!response.success) {
    // Return the error data so frontend can display it properly
    if (response.data) {
      return response.data; // This will have status: 'test_failed'
    }
    throw new Error(response.data?.message || 'Failed to test LLM model');
  }

  // If success is true but status is test_failed, still return it (API key check failed)
  if (response.data && response.data.status === 'test_failed') {
    return response.data;
  }

  return response.data;
}

export async function getLLMConfig(token: string): Promise<LLMConfig> {
  const response = await apiRequest<{
    success: boolean;
    data: LLMConfig;
  }>('/api/admin/llm/config', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch LLM config');
  }

  return (response as any).data;
}

export async function getAnalyticsOverview(token: string): Promise<AnalyticsOverview> {
  const response = await apiRequest<{
    success: boolean;
    data: AnalyticsOverview;
  }>('/api/admin/analytics/overview', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch analytics overview');
  }

  return response.data;
}

