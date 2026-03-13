/**
 * Live Financial Metrics API Service
 * Frontend service for fetching live financial data (cost + revenue)
 */

import { apiRequest } from './adminApi';

export interface LiveFinancialMetrics {
  revenue: {
    liveMRR: number;
    annualRunRate: number;
    byPlan: Record<string, {
      users: number;
      price: number;
      mrr: number;
    }>;
    lastUpdated: string;
  };
  costs: {
    today: {
      total: number;
      calls: number;
      tokens: number;
    };
    last7Days: {
      total: number;
      calls: number;
      tokens: number;
      avgDaily: number;
    };
    last30Days: {
      total: number;
      calls: number;
      tokens: number;
      avgDaily: number;
    };
    projected: {
      monthly: number;
      yearly: number;
    };
    byProvider: Record<string, {
      calls: number;
      tokens: number;
      cost: number;
    }>;
    lastUpdated: string;
  };
  profit: {
    netRevenue: number;
    profitMargin: number;
    breakEvenMRR: number;
    margin: number;
  };
}

/**
 * Get live financial metrics (cost + revenue)
 */
export async function getLiveFinancialMetrics(token: string): Promise<LiveFinancialMetrics> {
  const response = await apiRequest<{
    success: boolean;
    data: LiveFinancialMetrics;
  }>('/api/admin/financial/live', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch live financial metrics');
  }

  return response.data;
}

