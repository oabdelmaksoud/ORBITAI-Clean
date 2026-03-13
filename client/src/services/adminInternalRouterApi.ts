/**
 * Admin Internal Router API Service
 * Frontend API calls for internal/system task routing configuration
 */

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/admin/internal-router`;

export type ModelTier = 'economy' | 'standard' | 'premium';

export interface TierConfig {
  name: ModelTier;
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
  maxEscalationLevel: ModelTier;
  cooldownMinutes: number;
}

export interface ContextOverride {
  context: string;
  preferredTier: ModelTier;
  preferredModels?: string[];
}

export interface TaskTypeOverride {
  taskType: string;
  preferredTier: ModelTier;
  preferredModels?: string[];
  requiredCapabilities?: string[];
}

export interface InternalRoutingConfig {
  _id?: string;
  enabled: boolean;
  defaultTier: ModelTier;
  tiers: TierConfig[];
  budgetLimits: BudgetLimits;
  escalationRules: EscalationRules;
  preferLocalModels: boolean;
  enableLearning: boolean;
  minConfidenceThreshold: number;
  contextOverrides?: ContextOverride[];
  taskTypeOverrides?: TaskTypeOverride[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  capabilities: Record<string, boolean>;
  pricing: {
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
  };
}

export interface RoutingStatistics {
  totalDecisions: number;
  tierDistribution: Record<ModelTier, number>;
  avgConfidence: number;
  avgCost: number;
  successRate: number;
  topModels: Array<{ modelId: string; count: number; avgCost: number }>;
  costSavings: number;
}

export interface RoutingHistoryItem {
  _id: string;
  taskType: string;
  agentRole?: string;
  context: string;
  selectedModelId: string;
  selectedTier: ModelTier;
  complexity: 'simple' | 'moderate' | 'complex';
  tokenEstimate: number;
  requiredCapabilities: string[];
  confidence: number;
  estimatedCost: number;
  reasoning: string;
  budgetPressure: number;
  processingTimeMs: number;
  timestamp: string;
  outcome?: {
    success: boolean;
    actualCost: number;
    actualLatencyMs: number;
    errorMessage?: string;
    recordedAt: string;
  };
}

export interface RoutingDecision {
  selectedModel: AvailableModel;
  tier: ModelTier;
  reasoning: string;
  confidence: number;
  estimatedCost: number;
  alternativeModels: AvailableModel[];
  factors: {
    complexity: 'simple' | 'moderate' | 'complex';
    tokenEstimate: number;
    requiredCapabilities: string[];
    historicalSuccessRate: number;
    budgetPressure: number;
  };
}

const getHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Get internal router configuration
 */
export async function getInternalRouterConfig(token?: string): Promise<{
  config: InternalRoutingConfig;
  availableModels: AvailableModel[];
}> {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'GET',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get configuration');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update internal router configuration
 */
export async function updateInternalRouterConfig(
  updates: Partial<InternalRoutingConfig>,
  token?: string
): Promise<InternalRoutingConfig> {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update configuration');
  }

  const data = await response.json();
  return data.data.config;
}

/**
 * Get routing statistics
 */
export async function getRoutingStatistics(
  startDate?: Date,
  endDate?: Date,
  token?: string
): Promise<{ statistics: RoutingStatistics; timeRange: { start: string; end: string } }> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate.toISOString());
  if (endDate) params.append('endDate', endDate.toISOString());

  const response = await fetch(`${API_BASE}/statistics?${params}`, {
    method: 'GET',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get statistics');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get routing history
 */
export async function getRoutingHistory(
  options: {
    page?: number;
    limit?: number;
    tier?: ModelTier;
    taskType?: string;
    startDate?: Date;
    endDate?: Date;
  },
  token?: string
): Promise<{
  history: RoutingHistoryItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.tier) params.append('tier', options.tier);
  if (options.taskType) params.append('taskType', options.taskType);
  if (options.startDate) params.append('startDate', options.startDate.toISOString());
  if (options.endDate) params.append('endDate', options.endDate.toISOString());

  const response = await fetch(`${API_BASE}/history?${params}`, {
    method: 'GET',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get history');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Test routing for a sample task
 */
export async function testRouting(
  input: {
    prompt: string;
    taskType?: string;
    agentRole?: string;
    requiredCapabilities?: string[];
    context?: string;
  },
  token?: string
): Promise<RoutingDecision> {
  const response = await fetch(`${API_BASE}/test`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to test routing');
  }

  const data = await response.json();
  return data.data.decision;
}

/**
 * Add or update a tier configuration
 */
export async function updateTier(
  tierConfig: TierConfig,
  token?: string
): Promise<InternalRoutingConfig> {
  const response = await fetch(`${API_BASE}/tiers`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(tierConfig),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update tier');
  }

  const data = await response.json();
  return data.data.config;
}

/**
 * Add or update a task type override
 */
export async function updateTaskTypeOverride(
  override: TaskTypeOverride,
  token?: string
): Promise<InternalRoutingConfig> {
  const response = await fetch(`${API_BASE}/task-overrides`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(override),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update task override');
  }

  const data = await response.json();
  return data.data.config;
}

/**
 * Delete a task type override
 */
export async function deleteTaskTypeOverride(
  taskType: string,
  token?: string
): Promise<InternalRoutingConfig> {
  const response = await fetch(`${API_BASE}/task-overrides/${encodeURIComponent(taskType)}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete task override');
  }

  const data = await response.json();
  return data.data.config;
}

/**
 * Add or update a context override
 */
export async function updateContextOverride(
  override: ContextOverride,
  token?: string
): Promise<InternalRoutingConfig> {
  const response = await fetch(`${API_BASE}/context-overrides`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(override),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update context override');
  }

  const data = await response.json();
  return data.data.config;
}

/**
 * Delete a context override
 */
export async function deleteContextOverride(
  context: string,
  token?: string
): Promise<InternalRoutingConfig> {
  const response = await fetch(`${API_BASE}/context-overrides/${encodeURIComponent(context)}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete context override');
  }

  const data = await response.json();
  return data.data.config;
}

/**
 * Clear configuration cache
 */
export async function clearCache(token?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/clear-cache`, {
    method: 'POST',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to clear cache');
  }
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(token?: string): Promise<InternalRoutingConfig> {
  const response = await fetch(`${API_BASE}/reset`, {
    method: 'POST',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to reset configuration');
  }

  const data = await response.json();
  return data.data.config;
}




