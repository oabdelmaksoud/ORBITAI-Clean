/**
 * LLM Analytics API Service
 * Frontend service for fetching LLM analytics data
 */

import { apiRequest } from './adminApi';

export interface TrendDataPoint {
  date: string;
  calls: number;
  tokens: number;
  cost: number;
  avgLatency: number;
  errorRate: number;
  byProvider: Record<string, any>;
  byModel: Record<string, any>;
  byContext?: Record<string, any>;
}

export interface TrendsResponse {
  period: string;
  trends: TrendDataPoint[];
  summary: {
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
    totalErrors: number;
  };
}

export interface ModelComparison {
  modelId: string;
  provider: string;
  calls: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  avgCostPerCall: number;
  avgTokensPerCall: number;
  avgLatency: number;
  errorRate: number;
  successRate: number;
}

export interface CostAnalysisPoint {
  date: string;
  totalCost: number;
  byProvider: Array<{ provider: string; cost: number }>;
  byModel: Array<{ model: string; cost: number }>;
  inputCost: number;
  outputCost: number;
}

export interface CostAnalysisResponse {
  period: string;
  groupBy: string;
  analysis: CostAnalysisPoint[];
  projections: {
    avgDailyCost: number;
    projectedMonthly: number;
    projectedYearly: number;
  };
  totals: {
    totalCost: number;
    inputCost: number;
    outputCost: number;
  };
}

export interface PerformanceMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  latency: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  tokenEfficiency: number;
}

/**
 * Get time-series trends for LLM usage
 */
export async function getLLMTrends(
  token: string,
  period: '24h' | '7d' | '30d' | '90d' = '7d',
  provider?: string,
  modelId?: string,
  context?: string
): Promise<TrendsResponse> {
  const params = new URLSearchParams({ period });
  if (provider) params.append('provider', provider);
  if (modelId) params.append('modelId', modelId);
  if (context) params.append('context', context);

  const response = await apiRequest<{
    success: boolean;
    data: TrendsResponse;
  }>(`/api/admin/llm-analytics/trends?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch LLM trends');
  }

  return response.data;
}

/**
 * Get model comparison analytics
 */
export async function getModelComparison(
  token: string,
  startDate?: string,
  endDate?: string
): Promise<{ models: ModelComparison[] }> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await apiRequest<{
    success: boolean;
    data: { models: ModelComparison[] };
  }>(`/api/admin/llm-analytics/model-comparison?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch model comparison');
  }

  return response.data;
}

/**
 * Get cost analysis
 */
export async function getCostAnalysis(
  token: string,
  period: '7d' | '30d' | '90d' = '30d',
  groupBy: 'hour' | 'day' | 'month' = 'day'
): Promise<CostAnalysisResponse> {
  const params = new URLSearchParams({ period, groupBy });

  const response = await apiRequest<{
    success: boolean;
    data: CostAnalysisResponse;
  }>(`/api/admin/llm-analytics/cost-analysis?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch cost analysis');
  }

  return response.data;
}

/**
 * Context breakdown interface
 */
export interface ContextBreakdown {
  context: 'wizard' | 'workspace' | 'other';
  calls: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  avgCostPerCall: number;
  avgLatency: number;
  errorRate: number;
  successRate: number;
  byModel: Array<{ modelId: string; calls: number; cost: number }>;
  byProvider: Array<{ provider: string; calls: number; cost: number }>;
}

export interface ContextBreakdownResponse {
  breakdown: ContextBreakdown[];
  total: {
    calls: number;
    totalTokens: number;
    totalCost: number;
  };
}

/**
 * Get context breakdown (wizard vs workspace)
 */
export async function getContextBreakdown(
  token: string,
  startDate?: string,
  endDate?: string
): Promise<ContextBreakdownResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await apiRequest<{
    success: boolean;
    data: ContextBreakdownResponse;
  }>(`/api/admin/llm-analytics/context-breakdown?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch context breakdown');
  }

  return response.data;
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(
  token: string,
  startDate?: string,
  endDate?: string,
  modelId?: string,
  provider?: string
): Promise<PerformanceMetrics> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (modelId) params.append('modelId', modelId);
  if (provider) params.append('provider', provider);

  const response = await apiRequest<{
    success: boolean;
    data: PerformanceMetrics;
  }>(`/api/admin/llm-analytics/performance?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch performance metrics');
  }

  return response.data;
}
