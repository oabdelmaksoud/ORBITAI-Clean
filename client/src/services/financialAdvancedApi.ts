import { apiRequest } from './adminApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface RevenueForecast {
  month: string;
  monthName: string;
  projectedMRR: number;
  projectedARR: number;
  projectedUsers: number;
  growthRate: number;
}

export interface ForecastResponse {
  currentMRR: number;
  currentARR: number;
  currentUsers: number;
  avgGrowthRate: number;
  forecast: RevenueForecast[];
  historicalSignups: Array<{
    month: string;
    count: number;
    plans: string[];
  }>;
}

export interface LTVByPlan {
  monthlyPrice: number;
  avgLifespan: number;
  avgLTV: number;
  userCount: number;
  totalLTV: number;
}

export interface LTVResponse {
  avgLifespan: number;
  overallLTV: number;
  ltvByPlan: Record<string, LTVByPlan>;
  totalPotentialLTV: number;
}

export interface ChurnImpactScenarios {
  current: {
    churnedUsers: number;
    lostMRR: number;
    lostARR: number;
    churnRate: number;
  };
  ifAtRiskChurn: {
    potentialChurnedUsers: number;
    potentialLostMRR: number;
    potentialLostARR: number;
    totalImpactMRR: number;
    totalImpactARR: number;
  };
}

export interface ChurnImpactResponse {
  scenarios: ChurnImpactScenarios;
  churnByPlan: Record<string, {
    count: number;
    lostMRR: number;
    lostARR: number;
  }>;
  atRiskUsers: number;
  recommendations: string[];
}

export async function getRevenueForecast(token: string): Promise<ForecastResponse> {
  const response = await apiRequest<{ success: boolean; data: ForecastResponse }>(
    `/api/admin/financial/forecast`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch revenue forecast');
  }
  return response.data;
}

export async function getLTV(token: string): Promise<LTVResponse> {
  const response = await apiRequest<{ success: boolean; data: LTVResponse }>(
    `/api/admin/financial/ltv`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch LTV data');
  }
  return response.data;
}

export async function getChurnImpact(token: string): Promise<ChurnImpactResponse> {
  const response = await apiRequest<{ success: boolean; data: ChurnImpactResponse }>(
    `/api/admin/financial/churn-impact`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch churn impact');
  }
  return response.data;
}
















