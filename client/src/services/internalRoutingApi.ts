/**
 * Internal Routing API Service
 * Frontend API for managing AI-powered internal task routing
 */

import { apiRequest } from './adminApi';

// Types
export interface TierConfig {
  name: 'economy' | 'standard' | 'premium';
  models: string[];
  maxComplexity: 'simple' | 'moderate' | 'complex';
  maxTokens: number;
  capabilities: string[];
  costMultiplier: number;
}

export interface BudgetLimits {
  dailyLimit: number;
  monthlyLimit: number;
  perTaskLimit: number;
}

export interface EscalationRules {
  autoEscalateOnFailure: boolean;
  maxEscalationLevel: 'economy' | 'standard' | 'premium';
  cooldownMinutes: number;
}

export interface InternalRoutingConfig {
  _id?: string;
  enabled: boolean;
  defaultTier: 'economy' | 'standard' | 'premium';
  tiers: TierConfig[];
  budgetLimits: BudgetLimits;
  escalationRules: EscalationRules;
  preferLocalModels: boolean;
  enableLearning: boolean;
  minConfidenceThreshold: number;
  contextOverrides?: {
    context: string;
    preferredTier: 'economy' | 'standard' | 'premium';
    preferredModels?: string[];
  }[];
  taskTypeOverrides?: {
    taskType: string;
    preferredTier: 'economy' | 'standard' | 'premium';
    preferredModels?: string[];
    requiredCapabilities?: string[];
  }[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoutingTestInput {
  prompt: string;
  taskType?: string;
  agentRole?: string;
  requiredCapabilities?: string[];
  isUserFacing?: boolean;
  isCritical?: boolean;
  context?: 'internal' | 'system' | 'user' | 'background';
}

export interface RoutingTestResult {
  selectedModel: {
    id: string;
    name: string;
    provider: string;
    pricing: {
      inputCostPer1MTokens: number;
      outputCostPer1MTokens: number;
    };
  };
  tier: 'economy' | 'standard' | 'premium';
  reasoning: string;
  confidence: number;
  estimatedCost: number;
  factors: {
    complexity: 'simple' | 'moderate' | 'complex';
    tokenEstimate: number;
    requiredCapabilities: string[];
    historicalSuccessRate: number;
    budgetPressure: number;
  };
  alternativeModels: {
    id: string;
    name: string;
    provider: string;
  }[];
}

export interface RoutingStatistics {
  timeRange: { start: string; end: string };
  totalDecisions: number;
  tierDistribution: Record<'economy' | 'standard' | 'premium', number>;
  avgConfidence: number;
  avgCost: number;
  successRate: number;
  topModels: Array<{ modelId: string; count: number; avgCost: number }>;
  costSavings: number;
}

export interface RoutingHistoryEntry {
  _id: string;
  taskType: string;
  agentRole?: string;
  context: 'internal' | 'system' | 'user' | 'background';
  selectedModelId: string;
  selectedTier: 'economy' | 'standard' | 'premium';
  complexity: 'simple' | 'moderate' | 'complex';
  tokenEstimate: number;
  requiredCapabilities: string[];
  confidence: number;
  estimatedCost: number;
  reasoning: string;
  budgetPressure: number;
  processingTimeMs: number;
  outcome?: {
    success: boolean;
    actualCost: number;
    actualLatencyMs: number;
    errorMessage?: string;
    recordedAt: string;
  };
  timestamp: string;
}

export interface RoutingAnalytics {
  timeRange: { start: string; end: string; days: number };
  tierStats: Array<{
    tier: string;
    totalDecisions: number;
    successfulDecisions: number;
    successRate: number;
    avgConfidence: number;
    avgEstimatedCost: number;
    avgActualCost: number;
    avgLatency: number;
  }>;
  complexityStats: Array<{
    _id: string;
    count: number;
    avgCost: number;
  }>;
  dailyTrends: Array<{
    _id: string;
    decisions: number;
    totalCost: number;
    avgConfidence: number;
  }>;
  topModels: Array<{
    _id: string;
    count: number;
    totalCost: number;
    successRate: number;
  }>;
  costAnalysis: {
    totalTokens: number;
    actualCost: number;
    premiumCost: number;
    costSavings: number;
    savingsPercentage: number;
  };
}

// API Functions

/**
 * Get current internal routing configuration
 */
export async function getInternalRoutingConfig(token: string): Promise<InternalRoutingConfig> {
  const response = await apiRequest<{ success: boolean; data: InternalRoutingConfig }>(
    '/api/admin/internal-routing/config',
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Update internal routing configuration
 */
export async function updateInternalRoutingConfig(
  token: string,
  updates: Partial<InternalRoutingConfig>
): Promise<InternalRoutingConfig> {
  const response = await apiRequest<{ success: boolean; data: InternalRoutingConfig }>(
    '/api/admin/internal-routing/config',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    },
    token
  );
  return response.data;
}

/**
 * Test routing decision for a sample task
 */
export async function testRouting(
  token: string,
  input: RoutingTestInput
): Promise<RoutingTestResult> {
  const response = await apiRequest<{ success: boolean; data: RoutingTestResult }>(
    '/api/admin/internal-routing/test',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    },
    token
  );
  return response.data;
}

/**
 * Get routing statistics for a time range
 */
export async function getRoutingStatistics(
  token: string,
  options?: { startDate?: string; endDate?: string; days?: number }
): Promise<RoutingStatistics> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.days) params.append('days', options.days.toString());
  
  const queryString = params.toString();
  const url = `/api/admin/internal-routing/statistics${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiRequest<{ success: boolean; data: RoutingStatistics }>(
    url,
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Get routing decision history
 */
export async function getRoutingHistory(
  token: string,
  options?: {
    startDate?: string;
    endDate?: string;
    tier?: string;
    taskType?: string;
    context?: string;
    modelId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ history: RoutingHistoryEntry[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.tier) params.append('tier', options.tier);
  if (options?.taskType) params.append('taskType', options.taskType);
  if (options?.context) params.append('context', options.context);
  if (options?.modelId) params.append('modelId', options.modelId);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  
  const queryString = params.toString();
  const url = `/api/admin/internal-routing/history${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiRequest<{ success: boolean; data: { history: RoutingHistoryEntry[]; pagination: any } }>(
    url,
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Get detailed routing analytics
 */
export async function getRoutingAnalytics(
  token: string,
  days?: number
): Promise<RoutingAnalytics> {
  const url = `/api/admin/internal-routing/analytics${days ? `?days=${days}` : ''}`;
  
  const response = await apiRequest<{ success: boolean; data: RoutingAnalytics }>(
    url,
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Clear configuration cache
 */
export async function clearRoutingCache(token: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    '/api/admin/internal-routing/clear-cache',
    { method: 'POST' },
    token
  );
}

/**
 * Delete routing history
 */
export async function deleteRoutingHistory(
  token: string,
  beforeDate?: string
): Promise<{ deletedCount: number }> {
  const url = beforeDate
    ? `/api/admin/internal-routing/history?beforeDate=${encodeURIComponent(beforeDate)}`
    : '/api/admin/internal-routing/history';
  
  const response = await apiRequest<{ success: boolean; data: { deletedCount: number } }>(
    url,
    { method: 'DELETE' },
    token
  );
  return response.data;
}




