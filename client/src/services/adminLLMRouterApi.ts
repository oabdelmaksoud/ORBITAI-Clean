/**
 * Admin LLM Router Settings API Service
 * Frontend API service for managing LLM router configuration
 */

import { apiRequest } from './adminApi';

export interface RoutingRule {
  _id?: string;
  name: string;
  priority: number;
  routerType?: 'end-user' | 'internal'; // Scope rules per router type
  conditions: {
    agentRoles?: string[];
    taskTypes?: string[];
    complexity?: ('simple' | 'moderate' | 'complex')[];
    requestTypes?: string[];
    minTokens?: number;
    maxTokens?: number;
    projectPhases?: string[];
    customConditions?: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in';
      value: any;
    }>;
  };
  actions: {
    preferredModel?: string;
    blockedModels?: string[];
    preferredProvider?: string;
    blockedProviders?: string[];
    costLimit?: number;
    maxLatency?: number;
    forceProvider?: string;
    costPreference?: 'low' | 'balanced' | 'quality';
  };
  enabled: boolean;
  description?: string;
}

export interface RouterSettings {
  _id?: string;
  scope: 'global' | 'user';
  userId?: string;
  routingRules?: string[] | RoutingRule[];
  costControls?: {
    globalBudget?: {
      monthlyLimit?: number;
      dailyLimit?: number;
      perRequestLimit?: number;
    };
    userBudgets?: {
      [userId: string]: {
        monthlyLimit?: number;
        dailyLimit?: number;
      };
    };
    costPreference: 'low' | 'balanced' | 'quality';
    alertThresholds?: {
      budgetUsedPercent?: number;
      costPerRequest?: number;
    };
  };
  modelPriorities?: {
    providerRankings?: { [provider: string]: number };
    modelRankings?: { [modelId: string]: number };
    taskTypePreferences?: { [taskType: string]: string[] };
    agentRolePreferences?: { [agentRole: string]: string[] };
  };
  performanceTuning?: {
    latencyWeight: number;
    costWeight: number;
    qualityWeight: number;
    maxLatencyMs?: number;
    preferredLatencyMs?: number;
    enableCaching?: boolean;
    cacheTTL?: number;
  };
  defaultCostPreference?: 'low' | 'balanced' | 'quality';
  defaultPreferredModels?: string[];
  defaultBlockedModels?: string[];
  enabled: boolean;
  enableIntelligentRouting: boolean;
  enableCostOptimization: boolean;
  enablePerformanceOptimization: boolean;
  metadata?: any;
}

export interface RoutingAnalytics {
  totalRules: number;
  enabledRules: number;
  globalSettingsEnabled: boolean;
  userOverrides: number;
  intelligentRoutingEnabled: boolean;
  costOptimizationEnabled: boolean;
  performanceOptimizationEnabled: boolean;
}

/**
 * Get all router settings (global + user overrides)
 */
export async function getRouterSettings(token?: string): Promise<{
  global: RouterSettings | null;
  users: RouterSettings[];
}> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      global: RouterSettings | null;
      users: RouterSettings[];
    };
  }>('/api/admin/llm-router/settings', {
    method: 'GET'
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to fetch router settings');
  }
  
  return response.data;
}

/**
 * Get global router settings
 */
export async function getGlobalSettings(token?: string): Promise<RouterSettings | null> {
  const response = await apiRequest<{
    success: boolean;
    data: RouterSettings | null;
  }>('/api/admin/llm-router/settings/global', {
    method: 'GET'
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to fetch global settings');
  }
  
  return response.data;
}

/**
 * Update global router settings
 */
export async function updateGlobalSettings(settings: Partial<RouterSettings>, token?: string): Promise<RouterSettings> {
  const response = await apiRequest<{
    success: boolean;
    data: RouterSettings;
  }>('/api/admin/llm-router/settings/global', {
    method: 'PUT',
    body: JSON.stringify(settings),
    headers: {
      'Content-Type': 'application/json'
    }
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to update global settings');
  }
  
  return response.data;
}

/**
 * Get user-specific router settings
 */
export async function getUserSettings(userId: string, token?: string): Promise<RouterSettings | null> {
  const response = await apiRequest<{
    success: boolean;
    data: RouterSettings | null;
  }>(`/api/admin/llm-router/settings/user/${userId}`, {
    method: 'GET'
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to fetch user settings');
  }
  
  return response.data;
}

/**
 * Update user-specific router settings
 */
export async function updateUserSettings(userId: string, settings: Partial<RouterSettings>, token?: string): Promise<RouterSettings> {
  const response = await apiRequest<{
    success: boolean;
    data: RouterSettings;
  }>(`/api/admin/llm-router/settings/user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(settings),
    headers: {
      'Content-Type': 'application/json'
    }
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to update user settings');
  }
  
  return response.data;
}

/**
 * Reset user settings to global defaults
 */
export async function resetUserSettings(userId: string, token?: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>(`/api/admin/llm-router/settings/user/${userId}/reset`, {
    method: 'POST'
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to reset user settings');
  }
}

/**
 * Get routing rules, optionally filtered by routerType
 */
export async function getRoutingRules(token?: string, routerType?: 'end-user' | 'internal'): Promise<RoutingRule[]> {
  const url = routerType 
    ? `/api/admin/llm-router/rules?routerType=${routerType}`
    : '/api/admin/llm-router/rules';
    
  const response = await apiRequest<{
    success: boolean;
    data: RoutingRule[];
  }>(url, {
    method: 'GET'
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to fetch routing rules');
  }
  
  return response.data;
}

/**
 * Create a new routing rule
 */
export async function createRoutingRule(rule: Partial<RoutingRule>, token?: string): Promise<RoutingRule> {
  const response = await apiRequest<{
    success: boolean;
    data: RoutingRule;
  }>('/api/admin/llm-router/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
    headers: {
      'Content-Type': 'application/json'
    }
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to create routing rule');
  }
  
  return response.data;
}

/**
 * Update a routing rule
 */
export async function updateRoutingRule(ruleId: string, rule: Partial<RoutingRule>, token?: string): Promise<RoutingRule> {
  const response = await apiRequest<{
    success: boolean;
    data: RoutingRule;
  }>(`/api/admin/llm-router/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(rule),
    headers: {
      'Content-Type': 'application/json'
    }
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to update routing rule');
  }
  
  return response.data;
}

/**
 * Delete a routing rule
 */
export async function deleteRoutingRule(ruleId: string, token?: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>(`/api/admin/llm-router/rules/${ruleId}`, {
    method: 'DELETE'
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to delete routing rule');
  }
}

/**
 * Test a routing rule against a sample task
 */
export async function testRoutingRule(
  rule: Partial<RoutingRule>,
  sampleTask: {
    agentRole?: string;
    taskType?: string;
    complexity?: 'simple' | 'moderate' | 'complex';
    requestType?: string;
    estimatedTokens?: number;
    projectPhase?: string;
  },
  token?: string
): Promise<{ matches: boolean; reason: string }> {
  const response = await apiRequest<{
    success: boolean;
    data: { matches: boolean; reason: string };
  }>('/api/admin/llm-router/rules/test', {
    method: 'POST',
    body: JSON.stringify({ rule, sampleTask }),
    headers: {
      'Content-Type': 'application/json'
    }
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to test routing rule');
  }
  
  return response.data;
}

/**
 * Get routing analytics
 */
export async function getRoutingAnalytics(token?: string): Promise<RoutingAnalytics> {
  const response = await apiRequest<{
    success: boolean;
    data: RoutingAnalytics;
  }>('/api/admin/llm-router/analytics', {
    method: 'GET'
  }, token);
  
  if (!response.success) {
    throw new Error('Failed to fetch routing analytics');
  }
  
  return response.data;
}

