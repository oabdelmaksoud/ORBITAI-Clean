/**
 * LLM Model Management Component
 * Manages LLM models, syncs with providers, enables/disables models
 * Discovers new providers in the market
 */

import React, { useState, useEffect, useCallback } from 'react';
import { showAlert, showConfirm } from '../utils/browserUtils';
import {
  RefreshCw, Check, X, AlertTriangle, Clock, Zap, DollarSign,
  Settings, Trash2, Power, PowerOff, Search, Filter, ChevronDown,
  ChevronUp, ChevronRight, ExternalLink, Loader2, CheckCircle, XCircle, Info,
  Database, Cloud, Cpu, Activity, TrendingUp, Globe, Plus, Sparkles,
  Eye, EyeOff, Bell, Rocket, Key, Shield, Lock, TestTube, Copy, Edit,
  ToggleLeft, ToggleRight, Route, Brain, BarChart3, Play
} from 'lucide-react';
import {
  getSyncStatus,
  syncAllProviders,
  syncProvider,
  getAllModels,
  enableModel,
  disableModel,
  removeModel,
  getLastSyncResults,
  getModelRegistry,
  discoverProviders,
  SyncStatus,
  FullSyncResult,
  ModelsResponse,
  ModelInfo,
  RegistryResponse,
  DiscoveryResponse
} from '../services/modelSyncApi';
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deactivateApiKey,
  deleteApiKey,
  activateApiKey,
  testApiKey,
  setApiKeyToken,
  ApiKey,
  ApiKeyInput
} from '../services/apiKeysApi';
// Note: Internal Routing imports removed - InternalRouterSettings component manages its own state and imports
// Both End User Routing and Internal Routing tabs are completely independent
import LLMRouterSettings from './LLMRouterSettings';
import InternalRouterSettings from './InternalRouterSettings';

interface LLMModelManagementProps {
  token: string;
}

// API Key provider options and labels
const API_KEY_PROVIDER_OPTIONS = [
  'gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'mistral',
  'qwen', 'huggingface', 'e2b', 'google_search', 'openrouter', 'groq',
  'vertex', 'azure', 'custom'
] as const;

type ApiKeyProvider = typeof API_KEY_PROVIDER_OPTIONS[number];

const API_KEY_PROVIDER_LABELS: Record<ApiKeyProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  deepseek: 'DeepSeek',
  grok: 'Grok (xAI)',
  mistral: 'Mistral AI',
  qwen: 'Qwen (Alibaba)',
  huggingface: 'Hugging Face',
  e2b: 'E2B Sandbox',
  google_search: 'Google Search',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  vertex: 'Vertex AI (Google Cloud)',
  azure: 'Azure OpenAI',
  custom: 'Custom'
};

const ENVIRONMENT_OPTIONS = ['development', 'staging', 'production', 'test'];
const ENVIRONMENT_LABELS: Record<string, string> = {
  'development': 'Development',
  'staging': 'Pre-production',
  'production': 'Production',
  'test': 'Test'
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'from-emerald-500 to-emerald-600',
  anthropic: 'from-orange-500 to-orange-600',
  gemini: 'from-blue-500 to-blue-600',
  google: 'from-blue-500 to-blue-600',
  groq: 'from-purple-500 to-purple-600',
  mistral: 'from-red-500 to-red-600',
  deepseek: 'from-cyan-500 to-cyan-600',
  openrouter: 'from-pink-500 to-pink-600',
  xai: 'from-gray-500 to-gray-600',
  qwen: 'from-indigo-500 to-indigo-600',
  cohere: 'from-teal-500 to-teal-600',
  ai21: 'from-amber-500 to-amber-600',
  together: 'from-violet-500 to-violet-600',
  perplexity: 'from-sky-500 to-sky-600',
  fireworks: 'from-rose-500 to-rose-600',
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🤖',
  anthropic: '🧠',
  gemini: '✨',
  google: '🔍',
  groq: '⚡',
  mistral: '🌬️',
  deepseek: '🔬',
  openrouter: '🔀',
  xai: '🚀',
  qwen: '🐉',
  cohere: '🌊',
  ai21: '🔮',
  together: '🤝',
  perplexity: '🔎',
  fireworks: '🎆',
};

// Map model provider names to API key provider names
// This handles cases where model providers have different names than API key providers
const PROVIDER_TO_API_KEY_PROVIDER: Record<string, string> = {
  google: 'gemini',     // Google models use Gemini API key
  'google-ai': 'gemini',
  xai: 'grok',          // xAI models use Grok API key
  'x-ai': 'grok',
};

// Get the API key provider name for a given model provider
const getApiKeyProvider = (modelProvider: string): string => {
  return PROVIDER_TO_API_KEY_PROVIDER[modelProvider.toLowerCase()] || modelProvider.toLowerCase();
};

// Known providers in the market for discovery
const KNOWN_MARKET_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', url: 'https://openai.com', description: 'GPT-4, GPT-4o, o1, o3 models' },
  { id: 'anthropic', name: 'Anthropic', url: 'https://anthropic.com', description: 'Claude 3.5, Claude 4 models' },
  { id: 'gemini', name: 'Google Gemini', url: 'https://ai.google.dev', description: 'Gemini 1.5, 2.0, 2.5 models' },
  { id: 'groq', name: 'Groq', url: 'https://groq.com', description: 'Ultra-fast inference, Llama models' },
  { id: 'mistral', name: 'Mistral AI', url: 'https://mistral.ai', description: 'Mistral Large, Codestral models' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://deepseek.com', description: 'DeepSeek Coder, DeepSeek Chat' },
  { id: 'cohere', name: 'Cohere', url: 'https://cohere.com', description: 'Command, Embed, Rerank models' },
  { id: 'ai21', name: 'AI21 Labs', url: 'https://ai21.com', description: 'Jurassic, Jamba models' },
  { id: 'together', name: 'Together AI', url: 'https://together.ai', description: 'Open source model hosting' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', description: 'Sonar, Online models' },
  { id: 'fireworks', name: 'Fireworks AI', url: 'https://fireworks.ai', description: 'Fast inference platform' },
  { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai', description: 'Multi-provider gateway' },
  { id: 'xai', name: 'xAI', url: 'https://x.ai', description: 'Grok models' },
  { id: 'qwen', name: 'Alibaba Qwen', url: 'https://qwen.ai', description: 'Qwen 2.5 models' },
  { id: 'e2b', name: 'E2B Sandbox', url: 'https://e2b.dev', description: 'Secure code execution sandbox' },
  { id: 'google_search', name: 'Google Search', url: 'https://developers.google.com/custom-search', description: 'Web search grounding' },
];

export const LLMModelManagement: React.FC<LLMModelManagementProps> = ({ token }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<FullSyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);

  // Expanded sections
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [showProviderDiscovery, setShowProviderDiscovery] = useState(false);
  const [activeView, setActiveView] = useState<'models' | 'providers-keys' | 'end-user-routing' | 'internal-routing'>('models');

  // Provider testing state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testingAllProviders, setTestingAllProviders] = useState(false);
  const [providerTestResults, setProviderTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Collapsed providers state (for models view) - all collapsed by default
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set());

  // Update collapsed state when providers change - all should be collapsed by default
  useEffect(() => {
    if (providers.length > 0) {
      // Set all providers as collapsed by default
      setCollapsedProviders(new Set(providers));
    }
  }, [providers]);

  // Note: Internal Routing state is managed independently by InternalRouterSettings component
  // End User Routing state is managed independently by LLMRouterSettings component
  // Both tabs are completely independent in their data and state management

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [showEditKeyModal, setShowEditKeyModal] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; result: any } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKeyValue, setShowKeyValue] = useState(false);
  const [keyFormData, setKeyFormData] = useState<ApiKeyInput>({
    provider: 'openai',
    keyName: API_KEY_PROVIDER_LABELS['openai'],
    value: '',
    metadata: {
      enabledEnvironments: [],
      description: '',
      tags: []
    }
  });

  // Model Registry and Discovery state
  const [registryData, setRegistryData] = useState<RegistryResponse | null>(null);
  const [discoveryData, setDiscoveryData] = useState<DiscoveryResponse | null>(null);
  const [showDiscoveryAlert, setShowDiscoveryAlert] = useState(true);


  // Get configured API key providers (as string array for comparison with dynamic provider names)
  // Include both the original provider name and any reverse mappings
  const configuredApiKeyProviders: string[] = (() => {
    const activeProviders = apiKeys
      .filter(k => k.isActive)
      .map(k => {
        let p = k.provider.toLowerCase();
        // Normalize common variations
        if (p === 'google-ai' || p === 'google') return 'gemini';
        if (p === 'x-ai') return 'xai';
        return p;
      });

    return Array.from(new Set(activeProviders));
  })();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [modelsData, statusData, lastResults] = await Promise.all([
        getAllModels(token),
        getSyncStatus(token),
        getLastSyncResults(token)
      ]);

      setModels(modelsData.models);
      setProviders(modelsData.providers);
      setSyncStatus(statusData);

      // Load last sync results from database
      if (lastResults) {
        setLastSyncResult(lastResults);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadApiKeys = useCallback(async () => {
    try {
      setApiKeysLoading(true);
      setApiKeyToken(token);
      const response = await getApiKeys();
      setApiKeys(response.data.keys);
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys');
    } finally {
      setApiKeysLoading(false);
    }
  }, [token]);

  // Load model registry and discover new providers (public endpoints, no auth)
  const loadDiscoveryData = useCallback(async () => {
    try {
      const [registry, discovery] = await Promise.all([
        getModelRegistry(),
        discoverProviders()
      ]);
      setRegistryData(registry);
      setDiscoveryData(discovery);
    } catch (err: any) {
      console.warn('Failed to load registry/discovery data:', err.message || err);
      if (err.response) {
        console.warn('Error details:', err.response.data);
      }
      // Non-blocking - don't show error to user
    }
  }, []);

  useEffect(() => {
    loadData();
    loadApiKeys();
    loadDiscoveryData();
  }, [loadData, loadApiKeys, loadDiscoveryData]);

  // Note: Routing data (both End User and Internal) is loaded independently
  // by their respective components (LLMRouterSettings and InternalRouterSettings)
  // No need to load routing data here - each component manages its own state

  // API Key handlers
  const handleCreateKey = async () => {
    try {
      if (!keyFormData.value) {
        setError('API key value is required');
        return;
      }

      await createApiKey(keyFormData);
      setShowCreateKeyModal(false);
      setKeyFormData({
        provider: 'openai',
        keyName: API_KEY_PROVIDER_LABELS['openai'],
        value: '',
        metadata: { enabledEnvironments: [], description: '', tags: [] }
      });
      await loadApiKeys();
      setSuccess('API key created successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to create API key');
    }
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;

    try {
      const updates: Partial<ApiKeyInput> = {
        keyName: keyFormData.keyName,
        metadata: {
          enabledEnvironments: keyFormData.metadata?.enabledEnvironments || [],
          description: keyFormData.metadata?.description || '',
          tags: keyFormData.metadata?.tags || []
        }
      };

      if (keyFormData.value && keyFormData.value.trim()) {
        updates.value = keyFormData.value;
      }

      await updateApiKey(editingKey.id, updates);
      setShowEditKeyModal(false);
      setEditingKey(null);
      setKeyFormData({
        provider: 'openai',
        keyName: API_KEY_PROVIDER_LABELS['openai'],
        value: '',
        metadata: { enabledEnvironments: [], description: '', tags: [] }
      });
      await loadApiKeys();
      setSuccess('API key updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update API key');
    }
  };

  const handleDeleteKey = async (id: string) => {
    const key = apiKeys.find(k => k.id === id);
    const providerName = key ? API_KEY_PROVIDER_LABELS[key.provider as ApiKeyProvider] || key.provider : 'this API key';

    if (!(await showConfirm(`⚠️ WARNING: This will permanently delete ${providerName}.\n\nThis action cannot be undone.\n\nAre you sure?`))) return;

    try {
      await deleteApiKey(id);
      await loadApiKeys();
      setSuccess('API key deleted');
    } catch (err: any) {
      setError(err.message || 'Failed to delete API key');
    }
  };

  const handleToggleKeyStatus = async (key: ApiKey) => {
    try {
      if (key.isActive) {
        await deactivateApiKey(key.id);
      } else {
        await activateApiKey(key.id);
      }
      await loadApiKeys();
      setSuccess(`API key ${key.isActive ? 'deactivated' : 'activated'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle API key status');
    }
  };

  const handleTestKey = async (id: string) => {
    try {
      setTestingKeyId(id);
      setTestResult(null);
      const response = await testApiKey(id);
      setTestResult({ id, result: response.data.testResult });
    } catch (err: any) {
      setTestResult({ id, result: { valid: false, message: err.message || 'Test failed' } });
    } finally {
      setTestingKeyId(null);
    }
  };

  // Test provider API key connection
  const handleTestProvider = async (provider: string) => {
    // Map model provider to API key provider (e.g., "google" -> "gemini")
    const apiKeyProvider = getApiKeyProvider(provider);

    // Find the API key for this provider (try both original and mapped names)
    const providerKey = apiKeys.find(k =>
      (k.provider === provider || k.provider === apiKeyProvider) && k.isActive
    );

    if (!providerKey) {
      setProviderTestResults(prev => ({
        ...prev,
        [provider]: {
          success: false,
          message: `No active API key configured for ${provider}${apiKeyProvider !== provider ? ` (looking for ${apiKeyProvider})` : ''}`
        }
      }));
      return;
    }

    try {
      setTestingProvider(provider);
      const response = await testApiKey(providerKey.id);
      setProviderTestResults(prev => ({
        ...prev,
        [provider]: {
          success: response.data.testResult.valid,
          message: response.data.testResult.message
        }
      }));
    } catch (err: any) {
      setProviderTestResults(prev => ({
        ...prev,
        [provider]: { success: false, message: err.message || 'Test failed' }
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  // Test all providers with configured API keys
  const handleTestAllProviders = async () => {
    setTestingAllProviders(true);
    setProviderTestResults({}); // Clear previous results

    // Get unique providers that have enabled models and configured API keys
    const providersToTest = providers.filter(provider => provider).filter(provider => {
      const hasEnabledModels = models.some(m => m.provider === provider && m.isEnabled);
      const apiKeyProvider = getApiKeyProvider(provider);
      const hasApiKey = apiKeys.some(k =>
        (k.provider === provider || k.provider === apiKeyProvider) && k.isActive
      );
      return hasEnabledModels && hasApiKey;
    });

    // Test each provider sequentially to avoid rate limiting
    for (const provider of providersToTest) {
      await handleTestProvider(provider);
      // Small delay between tests to avoid overwhelming the APIs
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setTestingAllProviders(false);
  };

  // Toggle provider collapse state
  const toggleProviderCollapse = (provider: string) => {
    setCollapsedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(provider)) {
        newSet.delete(provider);
      } else {
        newSet.add(provider);
      }
      return newSet;
    });
  };

  // Collapse/Expand all providers
  const collapseAllProviders = () => {
    setCollapsedProviders(new Set(providers));
  };

  const expandAllProviders = () => {
    setCollapsedProviders(new Set());
  };

  const handleEditKey = (key: ApiKey) => {
    setEditingKey(key);
    const enabledEnvs = key.metadata?.enabledEnvironments ||
      (key.metadata?.environment ? [key.metadata.environment] : []);
    setKeyFormData({
      provider: key.provider,
      keyName: API_KEY_PROVIDER_LABELS[key.provider as ApiKeyProvider] || key.keyName,
      value: '',
      metadata: {
        ...key.metadata,
        enabledEnvironments: enabledEnvs,
        description: key.metadata?.description || '',
        tags: key.metadata?.tags || []
      }
    });
    setShowEditKeyModal(true);
  };

  const handleCopyMasked = (key: ApiKey) => {
    navigator.clipboard.writeText(key.maskedValue);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getEnvironmentBadge = (env: string) => {
    const colors: Record<string, string> = {
      development: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      staging: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      production: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      test: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[env] || 'bg-slate-500/20 text-slate-700 border-slate-500/30'}`}>
        {ENVIRONMENT_LABELS[env] || env}
      </span>
    );
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      const result = await syncAllProviders(token);
      setLastSyncResult(result);
      setShowSyncDetails(true);

      // Reload models, API keys, and refresh discovery data
      await Promise.all([loadData(), loadApiKeys(), loadDiscoveryData()]);

      const stats = [];
      if (result.totalModelsFound > 0) stats.push(`${result.totalModelsFound} found`);
      if (result.totalModelsAdded > 0) stats.push(`${result.totalModelsAdded} added`);
      if (result.totalModelsUpdated > 0) stats.push(`${result.totalModelsUpdated} updated`);
      if (result.totalModelsDisabled > 0) stats.push(`${result.totalModelsDisabled} disabled`);
      if ((result.totalModelsRemoved || 0) > 0) stats.push(`${result.totalModelsRemoved} removed`);

      const statsText = stats.length > 0 ? `: ${stats.join(', ')}` : '';
      setSuccess(`Sync complete! ${result.successfulProviders}/${result.totalProviders} providers synced${statsText}`);
    } catch (err: any) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncProvider = async (provider: string) => {
    try {
      setSyncing(true);
      setError(null);

      const result = await syncProvider(token, provider);

      if (result.success) {
        setSuccess(`Synced ${result.modelsFound} models from ${provider}`);
      } else {
        setError(result.error || `Failed to sync ${provider}`);
      }

      // Reload models and API keys to reflect updates
      await Promise.all([loadData(), loadApiKeys()]);
    } catch (err: any) {
      setError(err.message || `Failed to sync ${provider}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleModel = async (model: ModelInfo) => {
    try {
      // If disabling, allow it (no API key check needed)
      if (model.isEnabled) {
        await disableModel(token, model.id);
        setModels(prev => prev.map(m =>
          m.id === model.id ? { ...m, isEnabled: false } : m
        ));
        setSuccess(`Model ${model.name} disabled`);
        return;
      }

      // If enabling, check if provider has API key
      const modelProvider = model.provider.toLowerCase();
      const apiKeyProvider = getApiKeyProvider(modelProvider);
      const hasApiKey = configuredApiKeyProviders.includes(modelProvider) ||
        configuredApiKeyProviders.includes(apiKeyProvider);


      if (!hasApiKey) {
        // Automatically open the Add Key modal for this provider
        const targetProvider = apiKeyProvider || modelProvider;
        const targetProviderLabel = API_KEY_PROVIDER_LABELS[targetProvider as ApiKeyProvider] || targetProvider;

        setKeyFormData({
          provider: targetProvider as ApiKeyProvider,
          keyName: `${targetProviderLabel} Key`,
          value: '',
          metadata: {
            enabledEnvironments: ['development', 'production'], // Default to enabled in dev/prod
            description: `Key for ${model.name}`,
            tags: []
          }
        });

        setError(`Please add an API key for ${targetProviderLabel} to enable ${model.name}.`);
        setShowCreateKeyModal(true);
        setActiveView('providers-keys'); // Switch to keys view so they see the modal context
        return;
      }

      // API key exists, proceed with enabling
      await enableModel(token, model.id);

      setModels(prev => prev.map(m =>
        m.id === model.id ? { ...m, isEnabled: true } : m
      ));

      setSuccess(`Model ${model.name} enabled`);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle model');
    }
  };

  const handleRemoveModel = async (model: ModelInfo) => {
    const confirmed = await showConfirm(`Are you sure you want to remove ${model.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await removeModel(token, model.id);
      setModels(prev => prev.filter(m => m.id !== model.id));
      setSuccess(`Model ${model.name} removed`);
    } catch (err: any) {
      setError(err.message || 'Failed to remove model');
    }
  };

  // Filter models - only show from providers with API keys configured
  const filteredModels = models.filter(model => {
    // Only show models from providers with API keys configured
    const apiKeyProvider = getApiKeyProvider(model.provider);
    if (!configuredApiKeyProviders.includes(apiKeyProvider) &&
      !configuredApiKeyProviders.includes(model.provider.toLowerCase())) {
      return false;
    }
    if (searchTerm && !model.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !model.modelIdentifier.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (selectedProvider !== 'all' && model.provider !== selectedProvider) {
      return false;
    }
    if (selectedStatus !== 'all' && model.status !== selectedStatus) {
      return false;
    }
    if (showEnabledOnly && !model.isEnabled) {
      return false;
    }
    return true;
  });

  // Group by provider (filter out models with undefined providers), enabled models first
  const modelsByProvider = filteredModels
    .filter(model => model.provider) // Filter out models with undefined/null providers
    .sort((a, b) => {
      // Enabled models first, then sort by name
      if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .reduce((acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = [];
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, ModelInfo[]>);

  // Discover new providers not yet configured
  const newProviders = KNOWN_MARKET_PROVIDERS.filter(
    p => !providers.includes(p.id)
  );

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null) return '$0.00';
    if (price < 0.01) return `$${price.toFixed(4)}`;
    if (price < 1) return `$${price.toFixed(3)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-lg border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">LLM Model Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage and sync models from all LLM providers
          </p>
        </div>

      </div>

      {/* Sub-tabs - Matching ProcessManagementTab style */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-4">
          {[
            { id: 'models', label: 'Models', icon: Database },
            { id: 'providers-keys', label: 'Providers & Keys', icon: Key, badge: (newProviders.length > 0 || providers.filter(p => p && !configuredApiKeyProviders.includes(p)).length > 0) ? providers.filter(p => p && !configuredApiKeyProviders.includes(p)).length || newProviders.length : null },
            { id: 'end-user-routing', label: 'End User Routing', icon: Globe },
            { id: 'internal-routing', label: 'Internal Routing', icon: Cpu },
          ].map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveView(id as any)}
              className={`
                flex items-center gap-2 py-2 px-3 border-b-2 font-medium text-sm transition-colors
                ${activeView === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
              {badge && (
                <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={20} />
            <span className="font-medium">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X size={16} />
          </button>
        </div>
      )}

      {/* New Providers Discovered Alert */}
      {showDiscoveryAlert && discoveryData && discoveryData.newProviders.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Rocket className="text-purple-600" size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-purple-800">
                  🎉 {discoveryData.newProviders.length} New Provider{discoveryData.newProviders.length > 1 ? 's' : ''} Discovered!
                </h4>
                <p className="text-sm text-purple-600 mt-1">
                  The AI market has new providers that aren't in our registry yet:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {discoveryData.newProviders.slice(0, 5).map((provider) => (
                    <span
                      key={provider}
                      className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full capitalize"
                    >
                      {provider}
                    </span>
                  ))}
                  {discoveryData.newProviders.length > 5 && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      +{discoveryData.newProviders.length - 5} more
                    </span>
                  )}
                </div>
                <p className="text-xs text-purple-500 mt-2">
                  Discovered via OpenRouter. Configure API keys to use these providers.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDiscoveryAlert(false)}
              className="text-purple-400 hover:text-purple-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Registry Stats - Show even without API keys */}
      {registryData && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Database size={16} />
              <span className="text-sm">
                <span className="font-medium">{registryData.totalProviders}</span> Providers Known
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Cpu size={16} />
              <span className="text-sm">
                <span className="font-medium">{registryData.totalModels}</span> Models in Registry
              </span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <Key size={16} />
              <span className="text-sm">
                <span className="font-medium">{configuredApiKeyProviders.length}</span> Configured
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Models shown even without API keys for reference
          </div>
        </div>
      )}

      {/* Providers & API Keys View (Merged) */}
      {activeView === 'providers-keys' && (
        <div className="space-y-6">
          {/* Header with Add Key Button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Providers & API Keys</h3>
              <p className="text-sm text-slate-500">Manage providers and their API keys in one place</p>
            </div>
            <button
              onClick={() => {
                setKeyFormData({
                  provider: 'openai',
                  keyName: API_KEY_PROVIDER_LABELS['openai'],
                  value: '',
                  metadata: { enabledEnvironments: [], description: '', tags: [] }
                });
                setShowCreateKeyModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add API Key
            </button>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Security Features</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• API keys are encrypted using AES-256-GCM</li>
                <li>• Keys are never exposed in the UI (masked display only)</li>
                <li>• All key operations are logged for audit</li>
              </ul>
            </div>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className={`rounded-lg p-4 border ${testResult.result.valid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
              }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.result.valid ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <h4 className="font-semibold text-slate-800">
                  {testResult.result.valid ? 'Test Passed' : 'Test Failed'}
                </h4>
              </div>
              <p className="text-sm text-slate-700">{testResult.result.message}</p>
            </div>
          )}

          {/* Configured Providers with API Keys */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Configured Providers ({providers.length})
              </h4>
            </div>
            <div className="divide-y divide-slate-200">
              {Array.from(new Set([...providers, ...configuredApiKeyProviders])).filter(p => p).map(provider => {
                const providerModels = models.filter(m => m.provider === provider);
                const enabledCount = providerModels.filter(m => m.isEnabled).length;
                const providerInfo = KNOWN_MARKET_PROVIDERS.find(p => p.id === provider);
                const hasApiKey = configuredApiKeyProviders.includes(provider);
                const providerKey = apiKeys.find(k => k.provider === provider && k.isActive);

                return (
                  <div key={provider} className="p-4 hover:bg-slate-100/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${PROVIDER_COLORS[provider] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-2xl shadow-lg`}>
                          {PROVIDER_ICONS[provider] || '🔌'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-800 capitalize">{provider}</h4>
                            {hasApiKey ? (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-green-600 text-xs rounded-lg border border-emerald-500/30">
                                ✓ Key Configured
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-600 text-xs rounded-lg border border-orange-500/30">
                                ⚠ No API Key
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            {providerModels.length} models • {enabledCount} enabled
                            {providerInfo && ` • ${providerInfo.description}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* API Key Info */}
                        {providerKey && (
                          <div className="text-right mr-4">
                            <code className="text-sm font-mono text-slate-700 bg-white px-2 py-1 rounded">
                              {providerKey.maskedValue}
                            </code>
                            <p className="text-xs text-slate-600 mt-1">
                              Last used: {providerKey.lastUsed ? new Date(providerKey.lastUsed).toLocaleDateString() : 'Never'}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {hasApiKey ? (
                            <>
                              <button
                                onClick={() => handleTestProvider(provider)}
                                disabled={testingProvider === provider}
                                className="p-2 text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors"
                                title="Test API key"
                              >
                                {testingProvider === provider ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <TestTube className="w-4 h-4" />
                                )}
                              </button>
                              {providerKey && (
                                <>
                                  <button
                                    onClick={() => handleEditKey(providerKey)}
                                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleKeyStatus(providerKey)}
                                    className={`p-2 rounded-lg transition-colors ${providerKey.isActive
                                      ? 'text-orange-600 hover:bg-orange-500/20'
                                      : 'text-green-600 hover:bg-emerald-500/20'
                                      }`}
                                    title={providerKey.isActive ? 'Deactivate' : 'Activate'}
                                  >
                                    {providerKey.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteKey(providerKey.id)}
                                    className="p-2 text-red-600 hover:bg-red-500/20 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setKeyFormData({
                                  provider: provider as any,
                                  keyName: API_KEY_PROVIDER_LABELS[provider as ApiKeyProvider] || provider,
                                  value: '',
                                  metadata: { enabledEnvironments: [], description: '', tags: [] }
                                });
                                setShowCreateKeyModal(true);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-600 rounded-lg text-sm transition-colors border border-orange-500/30"
                            >
                              <Plus className="w-4 h-4" />
                              Add Key
                            </button>
                          )}
                          <button
                            onClick={() => handleSyncProvider(provider)}
                            disabled={syncing}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Sync provider"
                          >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Models Progress Bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-white rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${providerModels.length > 0 ? (enabledCount / providerModels.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600">{enabledCount}/{providerModels.length} models enabled</span>
                    </div>
                  </div>
                );
              })}
              {providers.length === 0 && (
                <div className="p-8 text-center text-slate-600">
                  <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No providers configured yet. Sync to discover providers.</p>
                </div>
              )}
            </div>
          </div>

          {/* All Market Providers */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              All Known Providers in Market ({KNOWN_MARKET_PROVIDERS.length})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {KNOWN_MARKET_PROVIDERS.map(provider => {
                const hasKey = configuredApiKeyProviders.includes(provider.id);
                const isConfigured = providers.includes(provider.id);

                return (
                  <div
                    key={provider.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer hover:scale-105 ${hasKey
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : isConfigured
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : 'bg-slate-50 border-slate-200/30 opacity-60'
                      }`}
                    onClick={() => {
                      if (!hasKey) {
                        setKeyFormData({
                          provider: provider.id as any,
                          keyName: API_KEY_PROVIDER_LABELS[provider.id as ApiKeyProvider] || provider.name,
                          value: '',
                          metadata: { enabledEnvironments: [], description: '', tags: [] }
                        });
                        setShowCreateKeyModal(true);
                      }
                    }}
                    title={hasKey ? 'API key configured' : 'Click to add API key'}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{PROVIDER_ICONS[provider.id] || '🔌'}</span>
                      {hasKey ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : isConfigured ? (
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <p className="text-sm text-slate-800 font-medium">{provider.name}</p>
                    <p className="text-xs text-slate-600">
                      {hasKey ? 'Configured' : isConfigured ? 'Needs key' : 'Not synced'}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Summary stats */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-600">
                  {configuredApiKeyProviders.length} configured
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-slate-600">
                  {providers.filter(p => p && !configuredApiKeyProviders.includes(p)).length} need keys
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <span className="text-slate-600">
                  {KNOWN_MARKET_PROVIDERS.filter(p => !providers.includes(p.id)).length} not synced
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Models View */}
      {activeView === 'models' && (
        <>
          {/* Sync Section */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500">Last Sync</div>
                <div className="text-sm text-slate-800 font-medium">
                  {formatDate(syncStatus?.lastSyncTime || null)}
                </div>
              </div>
              <div className="text-sm text-slate-600">
                Keep your models up to date by syncing with all providers
              </div>
            </div>
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md ${syncing
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg'
                }`}
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync All Providers
                </>
              )}
            </button>
          </div>

          {/* Sync Results */}
          {lastSyncResult && showSyncDetails && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Sync Results
                </h3>
                <button
                  onClick={() => setShowSyncDetails(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-slate-800">{lastSyncResult.totalModelsFound || 0}</div>
                  <div className="text-sm text-slate-500">Models Found</div>
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-emerald-600">{lastSyncResult.totalModelsAdded || 0}</div>
                  <div className="text-sm text-slate-500">Models Added</div>
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-blue-600">{lastSyncResult.totalModelsUpdated || 0}</div>
                  <div className="text-sm text-slate-500">Models Updated</div>
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-orange-600">{lastSyncResult.totalModelsDisabled || 0}</div>
                  <div className="text-sm text-slate-500">Models Disabled</div>
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-red-600">{lastSyncResult.totalModelsRemoved || 0}</div>
                  <div className="text-sm text-slate-500">Models Removed</div>
                </div>
              </div>

              <div className="space-y-2">
                {lastSyncResult.results.map(result => (
                  <div
                    key={result.provider}
                    className={`flex items-center justify-between p-3 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{PROVIDER_ICONS[result.provider] || '🔌'}</span>
                      <span className="font-medium text-slate-800 capitalize">{result.provider}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {result.success ? (
                        <>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-slate-600">{result.modelsFound || 0} found</span>
                            {result.modelsAdded > 0 && (
                              <span className="text-emerald-600 font-medium">+{result.modelsAdded} added</span>
                            )}
                            {result.modelsUpdated > 0 && (
                              <span className="text-blue-600 font-medium">~{result.modelsUpdated} updated</span>
                            )}
                            {result.modelsDisabled > 0 && (
                              <span className="text-orange-600 font-medium">-{result.modelsDisabled} disabled</span>
                            )}
                            {(result.modelsRemoved || 0) > 0 && (
                              <span className="text-red-600 font-medium">-{result.modelsRemoved} removed</span>
                            )}
                          </div>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-red-600">{result.error}</span>
                          <XCircle className="w-5 h-5 text-red-600" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-blue-600">
                  <Database size={24} className="text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 font-medium mb-1">Total Models</p>
              <h3 className="text-2xl font-bold text-slate-800">{models.length}</h3>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-emerald-600">
                  <Power size={24} className="text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 font-medium mb-1">Enabled</p>
              <h3 className="text-2xl font-bold text-slate-800">{models.filter(m => m.isEnabled).length}</h3>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-purple-600">
                  <Globe size={24} className="text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 font-medium mb-1">Providers</p>
              <h3 className="text-2xl font-bold text-slate-800">{providers.length}</h3>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-orange-600">
                  <AlertTriangle size={24} className="text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 font-medium mb-1">Deprecated</p>
              <h3 className="text-2xl font-bold text-slate-800">{models.filter(m => m.status === 'deprecated').length}</h3>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-cyan-600">
                  <Zap size={24} className="text-white" />
                </div>
              </div>
              <p className="text-sm text-slate-500 font-medium mb-1">Fast Models</p>
              <h3 className="text-2xl font-bold text-slate-800">{models.filter(m => m.capabilities?.fastResponse).length}</h3>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border border-slate-200">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Providers</option>
              {providers.filter(p => p).map(p => (
                <option key={p} value={p}>{PROVIDER_ICONS[p] || '🔌'} {p}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
              <option value="maintenance">Maintenance</option>
              <option value="beta">Beta</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={showEnabledOnly}
                onChange={(e) => setShowEnabledOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-700">Enabled Only</span>
            </label>
          </div>

          {/* Action Bar - Test All & Collapse/Expand */}
          <div className="flex items-center justify-between bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              {/* Test All Providers Button */}
              <button
                onClick={handleTestAllProviders}
                disabled={testingAllProviders || testingProvider !== null}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${testingAllProviders || testingProvider !== null
                  ? 'bg-slate-200 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg hover:shadow-xl'
                  }`}
              >
                {testingAllProviders ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing Providers...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    Test All Providers
                  </>
                )}
              </button>

              {/* Test Results Summary */}
              {Object.keys(providerTestResults).length > 0 && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-600 text-sm">Results:</span>
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {Object.values(providerTestResults).filter(r => r.success).length}
                  </span>
                  <span className="flex items-center gap-1 text-red-600 text-sm">
                    <XCircle className="w-4 h-4" />
                    {Object.values(providerTestResults).filter(r => !r.success).length}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Collapse/Expand All */}
              <button
                onClick={collapseAllProviders}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-100 rounded-lg text-slate-700 text-sm transition-colors"
                title="Collapse all providers"
              >
                <ChevronUp className="w-4 h-4" />
                Collapse All
              </button>
              <button
                onClick={expandAllProviders}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-100 rounded-lg text-slate-700 text-sm transition-colors"
                title="Expand all providers"
              >
                <ChevronDown className="w-4 h-4" />
                Expand All
              </button>
            </div>
          </div>

          {/* Models by Provider */}
          <div className="space-y-4">
            {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
              <div key={provider} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                {/* Provider Header - Clickable for collapse/expand */}
                <div
                  className={`flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors ${!collapsedProviders.has(provider) ? 'border-b border-slate-200' : ''
                    }`}
                  onClick={() => toggleProviderCollapse(provider)}
                >
                  <div className="flex items-center gap-3">
                    {/* Collapse/Expand Icon */}
                    <div className="text-slate-600">
                      {collapsedProviders.has(provider) ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${PROVIDER_COLORS[provider] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-2xl shadow-lg`}>
                      {PROVIDER_ICONS[provider] || '🔌'}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 capitalize">{provider}</h3>
                      <p className="text-sm text-slate-600">{providerModels.length} models • {providerModels.filter(m => m.isEnabled).length} enabled</p>
                    </div>
                    {/* Provider Test Result Badge */}
                    {providerTestResults[provider] && (
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${providerTestResults[provider].success
                        ? 'bg-emerald-500/20 text-green-600 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-600 border border-red-500/30'
                        }`}>
                        {providerTestResults[provider].success ? '✓ Connected' : '✗ Failed'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Test Provider Button - only show if provider has enabled models */}
                    {providerModels.some(m => m.isEnabled) && (
                      <button
                        onClick={() => handleTestProvider(provider)}
                        disabled={testingProvider === provider || testingAllProviders}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border ${configuredApiKeyProviders.includes(provider)
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-green-600 border-emerald-500/30'
                          : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-600 border-orange-500/30'
                          }`}
                        title={configuredApiKeyProviders.includes(provider) ? 'Test API connection' : 'No API key configured'}
                      >
                        {testingProvider === provider ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                        Test
                      </button>
                    )}
                    <button
                      onClick={() => handleSyncProvider(provider)}
                      disabled={syncing}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-100 rounded-lg text-slate-800 text-sm transition-colors border border-slate-300"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                  </div>
                </div>

                {/* Models List - Collapsible */}
                {!collapsedProviders.has(provider) && (
                  <div className="divide-y divide-slate-200">
                    {providerModels.map(model => (
                      <div key={model.id} className="p-4 hover:bg-slate-100/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* Enable/Disable Toggle */}
                            {(() => {
                              const modelProvider = model.provider.toLowerCase();
                              const hasApiKey = configuredApiKeyProviders.includes(modelProvider);
                              const canToggle = model.isEnabled || hasApiKey;

                              return (
                                <div className="relative">
                                  <button
                                    onClick={() => handleToggleModel(model)}
                                    disabled={!canToggle}
                                    className={`p-2.5 rounded-lg transition-all ${!canToggle
                                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                                      : model.isEnabled
                                        ? 'bg-emerald-500/20 text-green-600 hover:bg-emerald-500/30 shadow-lg shadow-emerald-500/10'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    title={!canToggle ? `No API key configured for ${model.provider}. Add API key in "Providers & Keys" tab.` : model.isEnabled ? 'Disable model' : 'Enable model'}
                                  >
                                    {model.isEnabled ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                                  </button>
                                  {!hasApiKey && !model.isEnabled && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" title="No API key configured" />
                                  )}
                                </div>
                              );
                            })()}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800">{model.name}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${model.status === 'active' ? 'bg-emerald-500/20 text-green-600' :
                                  model.status === 'deprecated' ? 'bg-red-500/20 text-red-600' :
                                    model.status === 'maintenance' ? 'bg-orange-500/20 text-orange-600' :
                                      'bg-blue-500/20 text-blue-600'
                                  }`}>
                                  {model.status}
                                </span>
                                {(() => {
                                  const modelProvider = model.provider.toLowerCase();
                                  const hasApiKey = configuredApiKeyProviders.includes(modelProvider);
                                  if (!hasApiKey && !model.isEnabled) {
                                    return (
                                      <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-600 flex items-center gap-1" title={`No API key configured for ${model.provider}`}>
                                        <Key className="w-3 h-3" />
                                        No API Key
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="text-sm text-slate-600 font-mono">{model.modelIdentifier}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Pricing */}
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-sm text-slate-700">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                {formatPrice(model.pricing?.inputCostPer1MTokens)} / {formatPrice(model.pricing?.outputCostPer1MTokens)}
                              </div>
                              <div className="text-xs text-slate-600">per 1M tokens (in/out)</div>
                            </div>

                            {/* Context */}
                            <div className="text-right">
                              <div className="text-sm text-slate-700">
                                {((model.limits?.maxContextLength || 0) / 1000).toFixed(0)}K
                              </div>
                              <div className="text-xs text-slate-600">context</div>
                            </div>

                            {/* Capabilities */}
                            <div className="flex items-center gap-1">
                              {model.capabilities?.functionCalling && (
                                <span className="p-1.5 bg-purple-500/20 rounded-lg" title="Function Calling">
                                  <Settings className="w-3.5 h-3.5 text-purple-600" />
                                </span>
                              )}
                              {model.capabilities?.fastResponse && (
                                <span className="p-1.5 bg-yellow-500/20 rounded-lg" title="Fast Response">
                                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                                </span>
                              )}
                              {model.capabilities?.longContext && (
                                <span className="p-1.5 bg-blue-500/20 rounded-lg" title="Long Context">
                                  <Database className="w-3.5 h-3.5 text-blue-600" />
                                </span>
                              )}
                              {model.capabilities?.codeGeneration && (
                                <span className="p-1.5 bg-emerald-500/20 rounded-lg" title="Code Generation">
                                  <Cpu className="w-3.5 h-3.5 text-green-600" />
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
                                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                {expandedModel === model.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>

                              {model.status === 'deprecated' && (
                                <button
                                  onClick={() => handleRemoveModel(model)}
                                  className="p-2 text-red-600 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Remove deprecated model"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedModel === model.id && (
                          <div className="mt-4 pt-4 border-t border-slate-200/30 grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/30">
                              <h4 className="text-sm font-medium text-slate-600 mb-2">Performance</h4>
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Avg Latency</span>
                                  <span className="text-slate-800">{model.performance?.avgLatencyMs || 0}ms</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Reliability</span>
                                  <span className="text-slate-800">{((model.performance?.reliability || 0) * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/30">
                              <h4 className="text-sm font-medium text-slate-600 mb-2">Limits</h4>
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Max Tokens</span>
                                  <span className="text-slate-800">{(model.limits?.maxTokens || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">Context Length</span>
                                  <span className="text-slate-800">{(model.limits?.maxContextLength || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/30">
                              <h4 className="text-sm font-medium text-slate-600 mb-2">Capabilities</h4>
                              <div className="flex flex-wrap gap-1">
                                {model.capabilities?.structuredOutput && (
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-xs text-slate-700">JSON</span>
                                )}
                                {model.capabilities?.codeGeneration && (
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-xs text-slate-700">Code</span>
                                )}
                                {model.capabilities?.streaming && (
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-xs text-slate-700">Stream</span>
                                )}
                                {model.capabilities?.functionCalling && (
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-xs text-slate-700">Functions</span>
                                )}
                                {model.capabilities?.longContext && (
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-xs text-slate-700">Long Context</span>
                                )}
                                {model.capabilities?.fastResponse && (
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-xs text-slate-700">Fast</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredModels.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600">No models found</h3>
              <p className="text-slate-600 mt-1">Try adjusting your filters or sync with providers</p>
            </div>
          )}
        </>
      )}

      {/* End User Routing View */}
      {activeView === 'end-user-routing' && (
        <div className="bg-white rounded-lg border border-slate-200">
          <LLMRouterSettings token={token} />
        </div>
      )}

      {/* Internal Routing View */}
      {activeView === 'internal-routing' && (
        <div className="bg-white rounded-lg border border-slate-200">
          <InternalRouterSettings token={token} />
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateKeyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md border border-slate-200 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              Add API Key
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <select
                  value={keyFormData.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value as ApiKeyProvider;
                    setKeyFormData({
                      ...keyFormData,
                      provider: newProvider,
                      keyName: API_KEY_PROVIDER_LABELS[newProvider]
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {API_KEY_PROVIDER_OPTIONS.map((p) => (
                    <option key={p} value={p}>{API_KEY_PROVIDER_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Key Value</label>
                <div className="relative">
                  <input
                    type={showKeyValue ? 'text' : 'password'}
                    value={keyFormData.value}
                    onChange={(e) => setKeyFormData({ ...keyFormData, value: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter API key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyValue(!showKeyValue)}
                    className="absolute right-2 top-2.5 text-slate-600 hover:text-slate-900"
                  >
                    {showKeyValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">This key will be encrypted and stored securely</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Environment Access</label>
                <div className="grid grid-cols-4 gap-2">
                  {ENVIRONMENT_OPTIONS.map(env => {
                    const enabledEnvs = keyFormData.metadata?.enabledEnvironments || [];
                    const isEnabled = enabledEnvs.includes(env);
                    return (
                      <button
                        key={env}
                        type="button"
                        onClick={() => {
                          const currentEnvs = keyFormData.metadata?.enabledEnvironments || [];
                          const newEnvs = isEnabled
                            ? currentEnvs.filter(e => e !== env)
                            : [...currentEnvs, env];
                          setKeyFormData({
                            ...keyFormData,
                            metadata: { ...keyFormData.metadata, enabledEnvironments: newEnvs }
                          });
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${isEnabled
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                      >
                        {isEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {ENVIRONMENT_LABELS[env]}
                      </button>
                    );
                  })}
                </div>
                {(keyFormData.metadata?.enabledEnvironments || []).length === 0 && (
                  <p className="text-xs text-blue-600 mt-2">✓ Available in all environments</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  value={keyFormData.metadata?.description || ''}
                  onChange={(e) => setKeyFormData({
                    ...keyFormData,
                    metadata: { ...keyFormData.metadata, description: e.target.value }
                  })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a description..."
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateKeyModal(false)}
                className="px-4 py-2 text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Create Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit API Key Modal */}
      {showEditKeyModal && editingKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md border border-slate-200 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Edit API Key
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <div className="flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xl">{PROVIDER_ICONS[editingKey.provider] || '🔑'}</span>
                  <span className="text-slate-800">{API_KEY_PROVIDER_LABELS[editingKey.provider as ApiKeyProvider] || editingKey.provider}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New API Key Value (optional)</label>
                <div className="relative">
                  <input
                    type={showKeyValue ? 'text' : 'password'}
                    value={keyFormData.value}
                    onChange={(e) => setKeyFormData({ ...keyFormData, value: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave empty to keep current key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyValue(!showKeyValue)}
                    className="absolute right-2 top-2.5 text-slate-600 hover:text-slate-900"
                  >
                    {showKeyValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Environment Access</label>
                <div className="grid grid-cols-4 gap-2">
                  {ENVIRONMENT_OPTIONS.map(env => {
                    const enabledEnvs = keyFormData.metadata?.enabledEnvironments || [];
                    const isEnabled = enabledEnvs.includes(env);
                    return (
                      <button
                        key={env}
                        type="button"
                        onClick={() => {
                          const currentEnvs = keyFormData.metadata?.enabledEnvironments || [];
                          const newEnvs = isEnabled
                            ? currentEnvs.filter(e => e !== env)
                            : [...currentEnvs, env];
                          setKeyFormData({
                            ...keyFormData,
                            metadata: { ...keyFormData.metadata, enabledEnvironments: newEnvs }
                          });
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${isEnabled
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                      >
                        {isEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {ENVIRONMENT_LABELS[env]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  value={keyFormData.metadata?.description || ''}
                  onChange={(e) => setKeyFormData({
                    ...keyFormData,
                    metadata: { ...keyFormData.metadata, description: e.target.value }
                  })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a description..."
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditKeyModal(false);
                  setEditingKey(null);
                }}
                className="px-4 py-2 text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateKey}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMModelManagement;
