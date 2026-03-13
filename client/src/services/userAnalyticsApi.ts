import { apiRequest } from './adminApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface ChurnPrediction {
  userId: string;
  email: string;
  name: string;
  plan: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  daysSinceLastActivity: number;
  daysSinceSignup: number;
  activityCount: number;
  activityLast30Days: number;
  lastActivity: string;
  predictedChurnDate: string | null;
}

export interface ChurnPredictionResponse {
  predictions: ChurnPrediction[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    averageRiskScore: number;
  };
}

export interface UserSegment {
  userId: string;
  email: string;
  name: string;
  plan: string;
  projectCount: number;
  activityCount: number;
  daysSinceSignup: number;
  daysSinceLastActivity: number;
  lastLogin: string | null;
}

export interface UserSegmentationResponse {
  segments: {
    powerUsers: UserSegment[];
    activeUsers: UserSegment[];
    casualUsers: UserSegment[];
    atRiskUsers: UserSegment[];
    newUsers: UserSegment[];
    inactiveUsers: UserSegment[];
  };
  segmentStats: {
    powerUsers: { count: number; percentage: number; avgProjects: number; avgActivity: number };
    activeUsers: { count: number; percentage: number; avgProjects: number; avgActivity: number };
    casualUsers: { count: number; percentage: number; avgProjects: number; avgActivity: number };
    atRiskUsers: { count: number; percentage: number };
    newUsers: { count: number; percentage: number };
    inactiveUsers: { count: number; percentage: number };
  };
  totalUsers: number;
}

export interface LifecycleStage {
  userId: string;
  email: string;
  name: string;
  plan: string;
  daysSinceSignup: number;
  daysSinceLastActivity: number;
  projectCount: number;
  activityCount: number;
  stage: string;
}

export interface UserLifecycleResponse {
  lifecycleStages: {
    onboarding: LifecycleStage[];
    activation: LifecycleStage[];
    engagement: LifecycleStage[];
    retention: LifecycleStage[];
    dormant: LifecycleStage[];
    churned: LifecycleStage[];
  };
  stageStats: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  totalUsers: number;
}

export async function getChurnPrediction(token: string): Promise<ChurnPredictionResponse> {
  const response = await apiRequest<{ success: boolean; data: ChurnPredictionResponse }>(
    `/api/admin/analytics/users/churn-prediction`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch churn predictions');
  }
  return response.data;
}

export async function getUserSegmentation(token: string): Promise<UserSegmentationResponse> {
  const response = await apiRequest<{ success: boolean; data: UserSegmentationResponse }>(
    `/api/admin/analytics/users/segmentation`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch user segmentation');
  }
  return response.data;
}

export async function getUserLifecycle(token: string): Promise<UserLifecycleResponse> {
  const response = await apiRequest<{ success: boolean; data: UserLifecycleResponse }>(
    `/api/admin/analytics/users/lifecycle`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch user lifecycle');
  }
  return response.data;
}
















