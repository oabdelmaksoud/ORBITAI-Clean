/**
 * Admin LLM Router AI API Service
 * Frontend API service for AI-powered router features
 */

import { apiRequest } from './adminApi';

export interface AIRecommendation {
  type: 'routing_rule' | 'cost_control' | 'model_priority' | 'performance_tuning' | 'budget_limit';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  suggestedChanges: Record<string, any>;
  reasoning: string;
}

export interface NLRuleGenerationResult {
  rule: any;
  confidence: number;
  explanation: string;
  validationErrors?: string[];
}

export interface Anomaly {
  type: 'cost_spike' | 'performance_degradation' | 'unusual_pattern' | 'error_spike';
  severity: 'critical' | 'warning' | 'info';
  detectedAt: string;
  description: string;
  metrics: Record<string, any>;
  suggestedAction?: string;
}

export interface ModelPrediction {
  modelId: string;
  provider: string;
  confidence: number;
  estimatedCost: number;
  estimatedLatency: number;
  reasoning: string;
  alternatives: Array<{
    modelId: string;
    confidence: number;
    estimatedCost: number;
    estimatedLatency: number;
  }>;
}

export interface AIInsights {
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  topModels: Array<{ modelId: string; usage: number; cost: number }>;
  topAgentRoles: Array<{ agentRole: string; requests: number; cost: number }>;
  costTrend: Array<{ date: string; cost: number }>;
}

export interface UsagePattern {
  agentRole?: string;
  taskType?: string;
  modelId: string;
  provider: string;
  avgLatency: number;
  avgCost: number;
  successRate: number;
  totalRequests: number;
  avgTokens: number;
  performanceScore: number;
}

export interface AutoTuneResult {
  success: boolean;
  changesApplied: Record<string, any>;
  previousSettings: any;
  newSettings: any;
  expectedImprovement: string;
  rollbackAvailable: boolean;
}

export interface ABTestConfiguration {
  id: string;
  name: string;
  configA: Record<string, any>;
  configB: Record<string, any>;
  startDate: string;
  endDate?: string;
  status: 'running' | 'completed' | 'cancelled';
  results?: {
    configA: any;
    configB: any;
    winner?: 'A' | 'B';
  };
}

/**
 * Get AI recommendations for router settings
 */
export async function getAIRecommendations(
  token?: string,
  options?: {
    timeRange?: { start: string; end: string };
    filters?: Record<string, any>;
  }
): Promise<{ recommendations: AIRecommendation[] }> {
  return apiRequest<{ recommendations: AIRecommendation[] }>(
    '/api/admin/llm-router/ai/recommendations',
    {
      method: 'POST',
      body: JSON.stringify(options || {})
    },
    token
  );
}

/**
 * Generate routing rule from natural language
 */
export async function generateRuleFromNL(
  description: string,
  token?: string,
  context?: {
    existingRules?: any[];
    currentSettings?: any;
  }
): Promise<NLRuleGenerationResult> {
  return apiRequest<NLRuleGenerationResult>(
    '/api/admin/llm-router/ai/generate-rule',
    {
      method: 'POST',
      body: JSON.stringify({ description, context })
    },
    token
  );
}

/**
 * Get AI insights and analytics
 */
export async function getAIInsights(
  token?: string,
  timeRange?: { start: string; end: string }
): Promise<{
  insights: AIInsights;
  patterns: UsagePattern[];
}> {
  const params = new URLSearchParams();
  if (timeRange?.start) params.append('start', timeRange.start);
  if (timeRange?.end) params.append('end', timeRange.end);

  return apiRequest<{
    insights: AIInsights;
    patterns: UsagePattern[];
  }>(
    `/api/admin/llm-router/ai/insights?${params.toString()}`,
    {
      method: 'GET'
    },
    token
  );
}

/**
 * Get detected anomalies
 */
export async function getAnomalies(
  token?: string,
  timeRange?: { start: string; end: string }
): Promise<{ anomalies: Anomaly[] }> {
  const params = new URLSearchParams();
  if (timeRange?.start) params.append('start', timeRange.start);
  if (timeRange?.end) params.append('end', timeRange.end);

  return apiRequest<{ anomalies: Anomaly[] }>(
    `/api/admin/llm-router/ai/anomalies?${params.toString()}`,
    {
      method: 'GET'
    },
    token
  );
}

/**
 * Trigger auto-tuning
 */
export async function triggerAutoTune(
  token?: string,
  options?: {
    timeRange?: { start: string; end: string };
    maxChanges?: number;
    conservative?: boolean;
  }
): Promise<AutoTuneResult> {
  return apiRequest<AutoTuneResult>(
    '/api/admin/llm-router/ai/auto-tune',
    {
      method: 'POST',
      body: JSON.stringify(options || {})
    },
    token
  );
}

/**
 * Predict optimal model for a task
 */
export async function predictOptimalModel(
  taskAnalysis: {
    agentRole?: string;
    taskType?: string;
    complexity?: 'simple' | 'moderate' | 'complex';
    estimatedTokens?: number;
    requiredCapabilities?: string[];
  },
  token?: string,
  context?: {
    userId?: string;
    costPreference?: 'low' | 'balanced' | 'quality';
    maxLatency?: number;
  }
): Promise<{ prediction: ModelPrediction }> {
  const params = new URLSearchParams();
  if (taskAnalysis.agentRole) params.append('agentRole', taskAnalysis.agentRole);
  if (taskAnalysis.taskType) params.append('taskType', taskAnalysis.taskType);
  if (taskAnalysis.complexity) params.append('complexity', taskAnalysis.complexity);
  if (taskAnalysis.estimatedTokens) params.append('estimatedTokens', taskAnalysis.estimatedTokens.toString());
  if (taskAnalysis.requiredCapabilities) params.append('requiredCapabilities', taskAnalysis.requiredCapabilities.join(','));
  if (context?.userId) params.append('userId', context.userId);
  if (context?.costPreference) params.append('costPreference', context.costPreference);
  if (context?.maxLatency) params.append('maxLatency', context.maxLatency.toString());

  return apiRequest<{ prediction: ModelPrediction }>(
    `/api/admin/llm-router/ai/predict?${params.toString()}`,
    {
      method: 'GET'
    },
    token
  );
}

/**
 * Apply AI recommendations
 */
export async function applyRecommendations(
  recommendationIds: string[],
  token?: string
): Promise<{
  success: boolean;
  applied: number;
  changes: Array<{
    recommendationId: string;
    title: string;
    changes: Record<string, any>;
  }>;
}> {
  return apiRequest<{
    success: boolean;
    applied: number;
    changes: Array<{
      recommendationId: string;
      title: string;
      changes: Record<string, any>;
    }>;
  }>(
    '/api/admin/llm-router/ai/apply-recommendations',
    {
      method: 'POST',
      body: JSON.stringify({ recommendationIds })
    },
    token
  );
}

/**
 * Explain a routing rule in natural language
 */
export async function explainRule(
  ruleId: string,
  token?: string
): Promise<{ explanation: string }> {
  return apiRequest<{ explanation: string }>(
    `/api/admin/llm-router/ai/explain-rule/${ruleId}`,
    {
      method: 'GET'
    },
    token
  );
}

/**
 * Get auto-tuning history
 */
export async function getAutoTuneHistory(token?: string): Promise<{
  history: Array<{
    timestamp: string;
    changes: Record<string, any>;
    metrics: any;
    result: 'improved' | 'degraded' | 'neutral';
  }>;
}> {
  return apiRequest<{
    history: Array<{
      timestamp: string;
      changes: Record<string, any>;
      metrics: any;
      result: 'improved' | 'degraded' | 'neutral';
    }>;
  }>(
    '/api/admin/llm-router/ai/auto-tune/history',
    {
      method: 'GET'
    },
    token
  );
}

/**
 * Get active A/B tests
 */
export async function getABTests(token?: string): Promise<{ tests: ABTestConfiguration[] }> {
  return apiRequest<{ tests: ABTestConfiguration[] }>(
    '/api/admin/llm-router/ai/ab-tests',
    {
      method: 'GET'
    },
    token
  );
}

/**
 * Start a new A/B test
 */
export async function startABTest(
  config: Record<string, any>,
  token?: string,
  options?: {
    durationHours?: number;
    name?: string;
  }
): Promise<{ test: ABTestConfiguration }> {
  return apiRequest<{ test: ABTestConfiguration }>(
    '/api/admin/llm-router/ai/ab-tests',
    {
      method: 'POST',
      body: JSON.stringify({
        config,
        durationHours: options?.durationHours || 24,
        name: options?.name
      })
    },
    token
  );
}
