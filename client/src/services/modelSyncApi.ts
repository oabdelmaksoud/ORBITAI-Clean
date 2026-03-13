/**
 * Model Sync API Service
 * Frontend API calls for LLM model management
 */

import { apiRequest } from './adminApi';

export interface ProviderModelInfo {
  id: string;
  name: string;
  provider: string;
  modelIdentifier: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
  isDeprecated?: boolean;
  deprecationDate?: string;
  capabilities?: {
    vision?: boolean;
    functionCalling?: boolean;
    streaming?: boolean;
    jsonMode?: boolean;
  };
}

export interface SyncResult {
  provider: string;
  success: boolean;
  modelsFound: number;
  modelsAdded: number;
  modelsUpdated: number;
  modelsDisabled: number;
  modelsRemoved?: number;
  error?: string;
  models?: ProviderModelInfo[];
}

export interface FullSyncResult {
  timestamp: string;
  totalProviders: number;
  successfulProviders: number;
  failedProviders: number;
  totalModelsFound: number;
  totalModelsAdded: number;
  totalModelsUpdated: number;
  totalModelsDisabled: number;
  totalModelsRemoved?: number;
  results: SyncResult[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  modelIdentifier: string;
  status: 'active' | 'deprecated' | 'maintenance' | 'beta';
  isEnabled: boolean;
  pricing: {
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
  };
  limits: {
    maxTokens: number;
    maxContextLength: number;
  };
  capabilities: {
    structuredOutput: boolean;
    codeGeneration: boolean;
    longContext: boolean;
    fastResponse: boolean;
    streaming: boolean;
    functionCalling: boolean;
  };
  performance: {
    avgLatencyMs: number;
    reliability: number;
  };
}

export interface ModelsResponse {
  totalModels: number;
  providers: string[];
  models: ModelInfo[];
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
}

/**
 * Get sync status
 */
export async function getSyncStatus(token: string): Promise<SyncStatus> {
  const response = await apiRequest<{ success: boolean; data: SyncStatus }>(
    '/api/admin/models/sync/status',
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Get last sync results from database
 */
export async function getLastSyncResults(token: string): Promise<FullSyncResult | null> {
  const response = await apiRequest<{ success: boolean; data: FullSyncResult | null }>(
    '/api/admin/models/sync/results',
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Trigger full sync from all providers
 */
export async function syncAllProviders(token: string): Promise<FullSyncResult> {
  const response = await apiRequest<{ success: boolean; data: FullSyncResult }>(
    '/api/admin/models/sync',
    { method: 'POST' },
    token
  );
  return response.data;
}

/**
 * Sync models from a specific provider
 */
export async function syncProvider(token: string, provider: string): Promise<SyncResult> {
  const response = await apiRequest<{ success: boolean; data: SyncResult }>(
    `/api/admin/models/sync/${provider}`,
    { method: 'POST' },
    token
  );
  return response.data;
}

/**
 * Get all models
 */
export async function getAllModels(token: string): Promise<ModelsResponse> {
  const response = await apiRequest<{ success: boolean; data: ModelsResponse }>(
    '/api/admin/models',
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Get a specific model
 */
export async function getModel(token: string, modelId: string): Promise<ModelInfo> {
  const response = await apiRequest<{ success: boolean; data: ModelInfo }>(
    `/api/admin/models/${modelId}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Enable a model
 */
export async function enableModel(token: string, modelId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/admin/models/${encodeURIComponent(modelId)}/enable`,
    { method: 'PUT' },
    token
  );
}

/**
 * Disable a model
 */
export async function disableModel(token: string, modelId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/admin/models/${encodeURIComponent(modelId)}/disable`,
    { method: 'PUT' },
    token
  );
}

/**
 * Remove a model
 */
export async function removeModel(token: string, modelId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/admin/models/${modelId}`,
    { method: 'DELETE' },
    token
  );
}

/**
 * Start monthly sync scheduler
 */
export async function startScheduler(token: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    '/api/admin/models/scheduler/start',
    { method: 'POST' },
    token
  );
}

/**
 * Stop monthly sync scheduler
 */
export async function stopScheduler(token: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    '/api/admin/models/scheduler/stop',
    { method: 'POST' },
    token
  );
}

// ===== NEW PUBLIC REGISTRY & DISCOVERY APIs =====

export interface RegistryProvider {
  id: string;
  name: string;
  description: string;
  website: string;
  apiDocsUrl: string;
  modelCount: number;
}

export interface RegistryModel {
  id: string;
  name: string;
  provider: string;
  modelIdentifier: string;
  description?: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  releaseDate?: string;
  isDeprecated: boolean;
  deprecationDate?: string;
  capabilities: {
    vision: boolean;
    functionCalling: boolean;
    streaming: boolean;
    jsonMode: boolean;
    codeGeneration: boolean;
    reasoning: boolean;
    longContext: boolean;
    fastResponse: boolean;
  };
}

export interface RegistryResponse {
  providers: RegistryProvider[];
  models: RegistryModel[];
  totalProviders: number;
  totalModels: number;
}

export interface DiscoveryResponse {
  knownProviders: string[];
  discoveredProviders: string[];
  newProviders: string[];
}

export interface ModelsWithFallbackResponse {
  models: ProviderModelInfo[];
  source: 'live' | 'registry';
  hasApiKey: boolean;
}

/**
 * Get public model registry - all known models without needing API keys
 * This is public (no auth required) to allow frontend to show available models
 */
export async function getModelRegistry(): Promise<RegistryResponse> {
  const response = await fetch('/api/admin/models/registry');
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to get model registry');
  }
  return data.data;
}

/**
 * Discover new providers from public sources (OpenRouter)
 */
export async function discoverProviders(): Promise<DiscoveryResponse> {
  const response = await fetch('/api/admin/models/discover');
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to discover providers');
  }
  return data.data;
}

/**
 * Get models for a provider with fallback to registry if no API key
 */
export async function getModelsWithFallback(provider: string): Promise<ModelsWithFallbackResponse> {
  const response = await fetch(`/api/admin/models/with-fallback/${provider}`);
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to get models with fallback');
  }
  return data.data;
}
