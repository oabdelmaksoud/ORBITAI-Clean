/**
 * LLM Usage API Service
 * Frontend service for fetching LLM usage and cost data
 */

import { apiRequest } from './adminApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface LiveUsage {
  calls: number;
  tokens: number;
  cost: number;
  rate: number; // Calls per minute
  byModel: Record<string, {
    calls: number;
    tokens: number;
    cost: number;
    provider: string;
  }>;
}

export interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  byProvider: Record<string, {
    calls: number;
    tokens: number;
    cost: number;
  }>;
  byModel: Record<string, {
    calls: number;
    tokens: number;
    cost: number;
    provider: string;
  }>;
  recentCalls: Array<{
    modelId: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    timestamp: string;
    success: boolean;
    requestType: string;
  }>;
}

export interface CostBreakdown {
  period: string;
  totalCost: number;
  dailyCosts: Array<{
    date: string;
    cost: number;
    calls: number;
    tokens: number;
  }>;
  byProvider: Record<string, number>;
}

/**
 * Get live/real-time LLM usage
 */
export async function getLiveUsage(token: string, minutes: number = 5): Promise<LiveUsage> {
  const response = await apiRequest<{
    success: boolean;
    data: LiveUsage;
  }>(`/api/admin/llm-usage/live?minutes=${minutes}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch live LLM usage');
  }
  return response.data;
}

/**
 * Get LLM usage statistics
 */
export async function getUsageStats(
  token: string,
  options?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    projectId?: string;
    provider?: string;
    modelId?: string;
  }
): Promise<UsageStats> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.userId) params.append('userId', options.userId);
  if (options?.projectId) params.append('projectId', options.projectId);
  if (options?.provider) params.append('provider', options.provider);
  if (options?.modelId) params.append('modelId', options.modelId);

  const response = await apiRequest<{
    success: boolean;
    data: UsageStats;
  }>(`/api/admin/llm-usage/stats?${params.toString()}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch LLM usage stats');
  }
  return response.data;
}

/**
 * Get project-specific LLM usage stats (user-facing)
 * Uses regular API request (not admin API) since it's user-facing
 */
export async function getProjectUsageStats(
  projectId: string
): Promise<UsageStats> {
  // Check if project is known to not exist before making API call
  const { isProjectNotFound } = await import('./projectStorage');
  if (isProjectNotFound(projectId)) {
    // Project doesn't exist - return empty stats instead of making API call
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      requestsByModel: {},
      requestsByProvider: {},
      requestsByAgent: {},
      requestsByTaskType: {},
      averageLatency: 0,
      successRate: 0,
      period: 'all'
    };
  }
  
  // Use regular API request from src/services/api.ts
  const { apiRequest } = await import('@src/services/api');
  
  try {
    const response = await apiRequest<{
      success: boolean;
      data: UsageStats;
    }>(`/api/v1/llm-usage/project/${projectId}`, {
      method: 'GET',
    });

    if (!response.success) {
      throw new Error('Failed to fetch project LLM usage stats');
    }
    return response.data;
  } catch (error: any) {
    // If 404, project doesn't exist - return empty stats
    if (error?.status === 404 || error?.isLLMUsageNotFound) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        requestsByModel: {},
        requestsByProvider: {},
        requestsByAgent: {},
        requestsByTaskType: {},
        averageLatency: 0,
        successRate: 0,
        period: 'all'
      };
    }
    throw error;
  }
}

/**
 * Get cost breakdown by time period
 */
export async function getCostBreakdown(
  token: string,
  period: 'today' | 'week' | 'month' = 'today'
): Promise<CostBreakdown> {
  const response = await apiRequest<{
    success: boolean;
    data: CostBreakdown;
  }>(`/api/admin/llm-usage/cost-breakdown?period=${period}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch cost breakdown');
  }
  return response.data;
}

