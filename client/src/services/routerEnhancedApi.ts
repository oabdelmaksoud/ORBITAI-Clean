/**
 * Enhanced Router API Service
 * Frontend API client for router metrics, A/B testing, benchmarks, quotas, and more
 */

// Get proper base URL for API requests
// For remote access (localtunnel, ngrok), use current origin
// For local development, use localhost:3002
const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // If accessed remotely, use current origin (proxied through Vite)
    if (!isLocalhost) {
      return window.location.origin;
    }
  }

  // Local development - use localhost:3002
  return (import.meta.env.VITE_API_URL || 'http://localhost:3002')
    .replace(/localhost:3001/g, 'localhost:3002')
    .replace(/127\.0\.0\.1:3001/g, '127.0.0.1:3002');
};

const API_BASE_URL = getBaseUrl();
const API_BASE = `${API_BASE_URL}/api/admin/llm-router`;

// Debug: Log the API base URL in development
if (import.meta.env.DEV) {
  console.debug('[routerEnhancedApi] API_BASE_URL:', API_BASE_URL);
  console.debug('[routerEnhancedApi] API_BASE:', API_BASE);
}

// ============ TYPES ============

export interface ModelHealthStatus {
  modelId: string;
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  successRate: number;
  avgLatency: number;
  errorCount: number;
  lastError?: string;
  lastUpdated: string;
}

export interface LatencyPercentiles {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface CostBurnRate {
  hourly: number;
  daily: number;
  weekly: number;
  monthly: number;
  projectedMonthly: number;
}

export interface ModelMetrics {
  modelId: string;
  provider: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  latencyPercentiles: LatencyPercentiles;
  errorRate: number;
}

export interface HourlyMetric {
  hour: string;
  modelId: string;
  avgLatency: number;
  requestCount: number;
  errorRate: number;
}

export interface RealTimeMetrics {
  timestamp: string;
  period: '5min' | '1hour' | '24hours';
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
  costBurnRate: CostBurnRate;
  modelHealth: ModelHealthStatus[];
  modelMetrics: ModelMetrics[];
  latencyHeatmap: HourlyMetric[];
  topErrors: Array<{ error: string; count: number; lastOccurred: string }>;
}

export interface ModelSpecificMetrics {
  hourlyBreakdown: Array<{
    hour: string;
    requests: number;
    cost: number;
    avgLatency: number;
    errorRate: number;
  }>;
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
  latencyPercentiles: LatencyPercentiles;
}

export interface ABTest {
  id: string;
  name: string;
  description?: string;
  status: 'running' | 'completed' | 'cancelled';
  variants: Array<{
    id: string;
    name: string;
    config: any;
    trafficPercent: number;
  }>;
  metrics: {
    [variantId: string]: {
      requests: number;
      successRate: number;
      avgLatency: number;
      avgCost: number;
    };
  };
  winner?: string;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
}

export interface BenchmarkResult {
  id: string;
  modelId: string;
  taskType: string;
  latency: number;
  cost: number;
  qualityScore: number;
  timestamp: string;
}

export interface UsageQuota {
  id: string;
  targetType: 'user' | 'project' | 'global';
  targetId?: string;
  targetName?: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  currentUsage: {
    daily: number;
    monthly: number;
  };
  alerts: {
    threshold50: boolean;
    threshold75: boolean;
    threshold90: boolean;
  };
}

export interface CostForecast {
  projectedDaily: number;
  projectedWeekly: number;
  projectedMonthly: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercent: number;
  anomalies: Array<{
    date: string;
    cost: number;
    zScore: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  historicalData: Array<{
    date: string;
    cost: number;
  }>;
}

// ============ API FUNCTIONS ============

function getAuthHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Real-Time Metrics

export async function getRealTimeMetrics(
  period: '5min' | '1hour' | '24hours' = '1hour',
  token?: string,
  routerType?: 'end-user' | 'internal'
): Promise<RealTimeMetrics> {
  const params = new URLSearchParams({ period });
  if (routerType) {
    params.append('routerType', routerType);
  }

  const response = await fetch(`${API_BASE}/metrics/realtime?${params}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch real-time metrics');
  }

  const data = await response.json();
  return data.data;
}

export async function getModelHealth(token?: string): Promise<ModelHealthStatus[]> {
  const response = await fetch(`${API_BASE}/metrics/health`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch model health');
  }

  const data = await response.json();
  return data.data;
}

export async function getModelMetrics(
  modelId: string,
  hours: number = 24,
  token?: string
): Promise<ModelSpecificMetrics> {
  const response = await fetch(`${API_BASE}/metrics/model/${modelId}?hours=${hours}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch model metrics');
  }

  const data = await response.json();
  return data.data;
}

export async function getErrorSparkline(
  modelId: string,
  points: number = 12,
  token?: string
): Promise<number[]> {
  const response = await fetch(`${API_BASE}/metrics/sparkline/${modelId}?points=${points}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch sparkline data');
  }

  const data = await response.json();
  return data.data;
}

export async function clearMetricsCache(token?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/metrics/cache/clear`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to clear metrics cache');
  }
}

// A/B Testing

export async function getABTests(token?: string): Promise<ABTest[]> {
  const response = await fetch(`${API_BASE}/ab-tests`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch A/B tests');
  }

  const data = await response.json();
  return data.data;
}

export async function createABTest(
  test: Omit<ABTest, 'id' | 'status' | 'metrics' | 'startedAt' | 'createdBy'>,
  token?: string
): Promise<ABTest> {
  const response = await fetch(`${API_BASE}/ab-tests`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(test),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create A/B test');
  }

  const data = await response.json();
  return data.data;
}

export async function completeABTest(testId: string, token?: string): Promise<ABTest> {
  const response = await fetch(`${API_BASE}/ab-tests/${testId}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to complete A/B test');
  }

  const data = await response.json();
  return data.data;
}

export async function cancelABTest(testId: string, token?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ab-tests/${testId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel A/B test');
  }
}

// Benchmarking

export async function runBenchmark(
  modelId: string,
  taskType: string,
  token?: string
): Promise<BenchmarkResult> {
  const response = await fetch(`${API_BASE}/benchmark/run`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ modelId, taskType }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to run benchmark');
  }

  const data = await response.json();
  return data.data;
}

export async function getBenchmarkResults(
  modelId?: string,
  taskType?: string,
  token?: string
): Promise<BenchmarkResult[]> {
  const params = new URLSearchParams();
  if (modelId) params.append('modelId', modelId);
  if (taskType) params.append('taskType', taskType);

  const response = await fetch(`${API_BASE}/benchmark/results?${params}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch benchmark results');
  }

  const data = await response.json();
  return data.data;
}

// Quotas

export async function getQuotas(token?: string): Promise<UsageQuota[]> {
  const url = `${API_BASE}/quotas`;
  const response = await fetch(url, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.message || error.error?.message || `Failed to fetch quotas: ${response.status} ${response.statusText}`);
    } else {
      const text = await response.text();
      throw new Error(`Failed to fetch quotas: ${response.status} ${response.statusText}. Response: ${text.substring(0, 200)}`);
    }
  }

  const data = await response.json();
  return data.data;
}

export async function createQuota(
  quota: Omit<UsageQuota, 'id' | 'currentUsage'>,
  token?: string
): Promise<UsageQuota> {
  const response = await fetch(`${API_BASE}/quotas`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(quota),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create quota');
  }

  const data = await response.json();
  return data.data;
}

export async function updateQuota(
  quotaId: string,
  updates: Partial<UsageQuota>,
  token?: string
): Promise<UsageQuota> {
  const response = await fetch(`${API_BASE}/quotas/${quotaId}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update quota');
  }

  const data = await response.json();
  return data.data;
}

export async function deleteQuota(quotaId: string, token?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/quotas/${quotaId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete quota');
  }
}

// Cost Forecasting

export async function getCostForecast(days: number = 30, token?: string): Promise<CostForecast> {
  const response = await fetch(`${API_BASE}/forecast?days=${days}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch cost forecast');
  }

  const data = await response.json();
  return data.data;
}

export async function getWhatIfScenario(
  scenario: {
    modelChanges?: { [modelId: string]: { enabled: boolean } };
    tierChanges?: { [taskType: string]: string };
    trafficChange?: number; // percentage change
  },
  token?: string
): Promise<{
  currentProjected: number;
  scenarioProjected: number;
  difference: number;
  percentChange: number;
}> {
  const response = await fetch(`${API_BASE}/forecast/what-if`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(scenario),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to run what-if scenario');
  }

  const data = await response.json();
  return data.data;
}

// Routing Explainability

export interface RoutingDecision {
  id: string;
  timestamp: string;
  selectedModel: string;
  selectedProvider: string;
  confidence: number;
  decisionPath: Array<{
    step: number;
    type: 'filter' | 'score' | 'rule' | 'fallback';
    description: string;
    result: string;
    candidatesRemaining?: number;
  }>;
  task: {
    type: string;
    complexity: string;
    agentRole?: string;
    estimatedTokens: number;
  };
  alternatives: Array<{
    modelId: string;
    score: number;
    reason: string;
  }>;
}

export async function getRoutingDecisions(
  limit: number = 50,
  token?: string
): Promise<RoutingDecision[]> {
  const response = await fetch(`${API_BASE}/decisions?limit=${limit}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch routing decisions');
  }

  const data = await response.json();
  return data.data;
}

export async function getRoutingDecision(
  decisionId: string,
  token?: string
): Promise<RoutingDecision> {
  const response = await fetch(`${API_BASE}/decisions/${decisionId}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch routing decision');
  }

  const data = await response.json();
  return data.data;
}

export async function exportRoutingDecisions(
  format: 'csv' | 'json',
  startDate?: string,
  endDate?: string,
  token?: string
): Promise<Blob> {
  const params = new URLSearchParams({ format });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(`${API_BASE}/decisions/export?${params}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to export routing decisions');
  }

  return response.blob();
}

