import { apiRequest } from './adminApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface APIMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: string;
  error?: string;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorCount: number;
  successRate: number;
}

export interface APIMetricsResponse {
  timeRange: string;
  overall: {
    totalRequests: number;
    totalErrors: number;
    successRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  endpoints: EndpointStats[];
  recentMetrics: APIMetric[];
}

export interface SlowQuery {
  command: any;
  collection: string;
  duration: number;
  timestamp: Date;
  filter: any;
  projection: any;
  sort: any;
  limit: number;
  skip: number;
}

export interface SlowQueriesResponse {
  slowQueries: SlowQuery[];
  summary: {
    total: number;
    avgDuration: number;
    maxDuration: number;
    byCollection: Array<{
      collection: string;
      count: number;
    }>;
  };
  recommendations: string[];
  message?: string;
}

export interface SystemHealthResponse {
  database: {
    status: string;
    isConnected: boolean;
    totalCollections: number;
    totalDocuments: number;
    collections: Array<{
      name: string;
      count: number;
    }>;
  };
  api: {
    totalMetrics: number;
    recentErrors: number;
    avgResponseTime: number;
  };
  timestamp: string;
}

export async function getAPIMetrics(
  token: string,
  options?: { timeRange?: string; endpoint?: string }
): Promise<APIMetricsResponse> {
  const params = new URLSearchParams();
  if (options?.timeRange) params.append('timeRange', options.timeRange);
  if (options?.endpoint) params.append('endpoint', options.endpoint);

  const response = await apiRequest<{ success: boolean; data: APIMetricsResponse }>(
    `/api/admin/performance/api-metrics?${params.toString()}`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch API metrics');
  }
  return response.data;
}

export async function getSlowQueries(token: string): Promise<SlowQueriesResponse> {
  const response = await apiRequest<{ success: boolean; data: SlowQueriesResponse }>(
    `/api/admin/performance/slow-queries`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch slow queries');
  }
  return response.data;
}

export async function getSystemHealth(token: string): Promise<SystemHealthResponse> {
  const response = await apiRequest<{ success: boolean; data: SystemHealthResponse }>(
    `/api/admin/performance/system-health`,
    { method: 'GET' },
    token
  );
  if (!response.success) {
    throw new Error('Failed to fetch system health');
  }
  return response.data;
}
















