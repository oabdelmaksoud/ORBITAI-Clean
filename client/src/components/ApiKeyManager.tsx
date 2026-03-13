/**
 * API Key Manager Component
 * Secure interface for managing API keys with encryption
 */

import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../utils/browserUtils';
import {
  Key,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Lock,
  TestTube,
  Copy,
  Check,
  CheckSquare,
  Square,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
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

const PROVIDER_OPTIONS: ApiKey['provider'][] = [
  'gemini',
  'openai',
  'anthropic',
  'deepseek',
  'grok',
  'mistral',
  'qwen',
  'huggingface',
  'e2b',
  'google_search',
  'openrouter',
  'groq',
  'vertex',
  'azure',
  'tripo',
  'flux',
  'sloyd',
  'custom'
];

const PROVIDER_LABELS: Record<ApiKey['provider'], string> = {
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
  tripo: 'Tripo AI (3D Assets)',
  flux: 'FLUX.1 (2D Assets)',
  sloyd: 'Sloyd AI (3D Procedural)',
  custom: 'Custom'
};

const ENVIRONMENT_OPTIONS = ['development', 'staging', 'production', 'test'];
const ENVIRONMENT_LABELS: Record<string, string> = {
  'development': 'Development',
  'staging': 'Pre-production',
  'production': 'Production',
  'test': 'Test'
};

interface ApiKeyManagerProps {
  token?: string;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ token }) => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; result: any } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [environmentFilter, setEnvironmentFilter] = useState<'all' | 'development' | 'staging' | 'production'>('all');

  // Form state
  const [formData, setFormData] = useState<ApiKeyInput>({
    provider: 'openai',
    keyName: PROVIDER_LABELS['openai'], // Auto-set from provider
    value: '',
    metadata: {
      enabledEnvironments: [],
      description: '',
      tags: []
    }
  });

  const [showValue, setShowValue] = useState(false);

  useEffect(() => {
    // Set token for API requests if provided
    if (token) {
      setApiKeyToken(token);
    }
    loadKeys();
  }, [token]);

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getApiKeys();
      setKeys(response.data.keys);
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.value) {
        setError('API key value is required');
        return;
      }

      // Validate Google Search Engine ID if provider is google_search
      if (formData.provider === 'google_search' && !formData.metadata?.additionalConfig?.engineId) {
        setError('Search Engine ID is required for Google Search API key');
        return;
      }

      await createApiKey(formData);
      setShowCreateModal(false);
      setFormData({
        provider: 'openai',
        keyName: PROVIDER_LABELS['openai'],
        value: '',
        metadata: {
          enabledEnvironments: [],
          description: '',
          tags: [],
          additionalConfig: {}
        }
      });
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to create API key');
    }
  };

  const handleUpdate = async () => {
    if (!editingKey) return;

    // Key name is auto-generated from provider, no validation needed

    try {
      // Only include value if it's provided (to update the key)
      // Otherwise, just update name, environment, and description
      const updates: Partial<ApiKeyInput> = {
        keyName: formData.keyName,
        metadata: {
          enabledEnvironments: formData.metadata?.enabledEnvironments || [],
          description: formData.metadata?.description || '',
          tags: formData.metadata?.tags || []
        }
      };

      // Only include value if user provided a new one
      if (formData.value && formData.value.trim()) {
        updates.value = formData.value;
      }

      // Include additionalConfig for Google Search
      if (editingKey.provider === 'google_search') {
        updates.metadata = {
          ...updates.metadata,
          additionalConfig: {
            engineId: formData.metadata?.additionalConfig?.engineId || ''
          }
        };
      }

      await updateApiKey(editingKey.id, updates);
      setShowEditModal(false);
      setEditingKey(null);
      setError(null);
      setFormData({
        provider: 'openai',
        keyName: PROVIDER_LABELS['openai'],
        value: '',
        metadata: {
          environment: 'development',
          description: '',
          tags: []
        }
      });
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to update API key');
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to deactivate this API key? It can be reactivated later.'))) return;

    try {
      await deactivateApiKey(id);
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate API key');
    }
  };

  const handleDelete = async (id: string) => {
    const key = keys.find(k => k.id === id);
    const providerName = key ? PROVIDER_LABELS[key.provider] : 'this API key';

    if (!(await showConfirm(`⚠️ WARNING: This will permanently delete ${providerName}.\n\nThis action cannot be undone. The API key will be permanently removed from the database.\n\nAre you absolutely sure you want to delete this API key?`))) return;

    try {
      await deleteApiKey(id);
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to delete API key');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateApiKey(id);
      await loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to activate API key');
    }
  };

  const handleTest = async (id: string) => {
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

  const handleEdit = (key: ApiKey) => {
    setEditingKey(key);
    // Migrate old environment field to enabledEnvironments if needed
    const enabledEnvs = key.metadata?.enabledEnvironments ||
      (key.metadata?.environment ? [key.metadata.environment] : []);
    setFormData({
      provider: key.provider,
      keyName: PROVIDER_LABELS[key.provider], // Use provider label instead of stored keyName
      value: '', // Don't show existing value
      metadata: {
        ...key.metadata,
        enabledEnvironments: enabledEnvs,
        description: key.metadata?.description || '',
        tags: key.metadata?.tags || []
      }
    });
    setShowEditModal(true);
  };

  const handleCopyMasked = (key: ApiKey) => {
    navigator.clipboard.writeText(key.maskedValue);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getProviderIcon = (provider: ApiKey['provider']) => {
    switch (provider) {
      case 'openai':
        return '🤖';
      case 'gemini':
        return '💎';
      case 'anthropic':
        return '🧠';
      case 'mistral':
        return '🌪️';
      default:
        return '🔑';
    }
  };

  const getEnvironmentBadge = (env?: string) => {
    if (!env) return null;
    const colors = {
      development: 'bg-blue-100 text-blue-800',
      staging: 'bg-yellow-100 text-yellow-800',
      production: 'bg-green-100 text-green-800',
      test: 'bg-purple-100 text-purple-800'
    };
    const labels = {
      development: 'Dev',
      staging: 'Staging',
      production: 'Prod',
      test: 'Test'
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[env as keyof typeof colors] || 'bg-slate-100 text-slate-800'}`}>
        {labels[env as keyof typeof labels] || env}
      </span>
    );
  };

  const getEnvironmentBadges = (key: ApiKey) => {
    const enabledEnvs = key.metadata?.enabledEnvironments ||
      (key.metadata?.environment ? [key.metadata.environment] : []);

    if (enabledEnvs.length === 0) {
      return <span className="text-xs text-slate-500">All Environments</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {enabledEnvs.map((env) => getEnvironmentBadge(env))}
      </div>
    );
  };

  // Filter keys by environment
  const filteredKeys = environmentFilter === 'all'
    ? keys
    : keys.filter(key => {
      const enabledEnvs = key.metadata?.enabledEnvironments ||
        (key.metadata?.environment ? [key.metadata.environment] : []);
      // If no environments specified, key is active in all environments
      if (enabledEnvs.length === 0) return true;
      return enabledEnvs.includes(environmentFilter);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            API Key Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Securely manage API keys with encryption at rest
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Environment Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Environment:</label>
            <select
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value as typeof environmentFilter)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="all">All Environments</option>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add API Key
          </button>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">Security Features</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• API keys are encrypted using AES-256-GCM</li>
            <li>• Keys are never exposed in the UI (masked display only)</li>
            <li>• All key operations are logged for audit</li>
            <li>• Rate limiting protects against brute force attacks</li>
          </ul>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Keys List */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Key Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Environment</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Masked Value</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Used</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredKeys.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  {keys.length === 0
                    ? 'No API keys found. Create your first key to get started.'
                    : `No API keys found for ${environmentFilter === 'all' ? 'any' : environmentFilter} environment.`
                  }
                </td>
              </tr>
            ) : (
              filteredKeys.map((key) => (
                <tr key={key.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getProviderIcon(key.provider)}</span>
                      <span className="font-medium text-slate-800">{PROVIDER_LABELS[key.provider]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{key.keyName}</td>
                  <td className="px-4 py-3">
                    {getEnvironmentBadges(key)}
                  </td>
                  <td className="px-4 py-3">
                    {key.metadata?.tags && key.metadata.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {key.metadata.tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                        {key.metadata.tags.length > 2 && (
                          <span className="text-xs text-slate-500">+{key.metadata.tags.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {key.maskedValue}
                      </code>
                      <button
                        onClick={() => handleCopyMasked(key)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copy masked value"
                      >
                        {copiedId === key.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {key.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTest(key.id)}
                        disabled={testingKeyId === key.id}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors border border-transparent hover:border-blue-200"
                        title="Test API key"
                      >
                        {testingKeyId === key.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(key)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors border border-transparent hover:border-blue-200 font-medium"
                        title="Edit API Key (Name, Value, Environment, Description)"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {key.isActive ? (
                        <button
                          onClick={() => handleDeactivate(key.id)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded transition-colors border border-transparent hover:border-orange-200"
                          title="Deactivate (can be reactivated)"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(key.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors border border-transparent hover:border-green-200"
                          title="Activate"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(key.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors border border-transparent hover:border-red-200"
                        title="Permanently Delete (cannot be undone)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
            <h3 className="font-semibold">
              {testResult.result.valid ? 'Test Passed' : 'Test Failed'}
            </h3>
          </div>
          <p className="text-sm">{testResult.result.message}</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create API Key</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <select
                  value={formData.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value as ApiKey['provider'];
                    setFormData({
                      ...formData,
                      provider: newProvider,
                      keyName: PROVIDER_LABELS[newProvider] // Auto-update key name
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {PROVIDER_OPTIONS.map((p) => (
                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Key name will be automatically set to: <strong>{PROVIDER_LABELS[formData.provider]}</strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Key Value</label>
                <div className="relative">
                  <input
                    type={showValue ? 'text' : 'password'}
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg pr-10"
                    placeholder="Enter API key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue(!showValue)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  This key will be encrypted and stored securely
                </p>
              </div>
              {formData.provider === 'google_search' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Search Engine ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.metadata?.additionalConfig?.engineId || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      metadata: {
                        ...formData.metadata,
                        additionalConfig: {
                          ...formData.metadata?.additionalConfig,
                          engineId: e.target.value
                        }
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter Google Custom Search Engine ID"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Required for Google Custom Search API. Get your Engine ID from{' '}
                    <a
                      href="https://programmablesearchengine.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Google Programmable Search Engine
                    </a>
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Environment Access
                  <span className="text-xs text-slate-500 ml-2">(select one or multiple)</span>
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const enabledEnvs = formData.metadata?.enabledEnvironments || [];
                      setFormData({
                        ...formData,
                        metadata: {
                          ...formData.metadata,
                          enabledEnvironments: enabledEnvs.length === 0 ? ENVIRONMENT_OPTIONS : []
                        }
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${(formData.metadata?.enabledEnvironments || []).length === 0
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                  >
                    {(formData.metadata?.enabledEnvironments || []).length === 0 ? <CheckSquare size={12} /> : <Square size={12} />}
                    All Environments
                  </button>
                  <span className="text-xs text-slate-400">or select specific:</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ENVIRONMENT_OPTIONS.map(env => {
                    const enabledEnvs = formData.metadata?.enabledEnvironments || [];
                    const isEnabled = enabledEnvs.includes(env);
                    return (
                      <button
                        key={env}
                        type="button"
                        onClick={() => {
                          const currentEnvs = formData.metadata?.enabledEnvironments || [];
                          const newEnvs = isEnabled
                            ? currentEnvs.filter(e => e !== env)
                            : [...currentEnvs, env];
                          setFormData({
                            ...formData,
                            metadata: {
                              ...formData.metadata,
                              enabledEnvironments: newEnvs
                            }
                          });
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${isEnabled
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                      >
                        {isEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {ENVIRONMENT_LABELS[env]}
                      </button>
                    );
                  })}
                </div>
                {(formData.metadata?.enabledEnvironments || []).length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Active in: {(formData.metadata?.enabledEnvironments || []).map(e => ENVIRONMENT_LABELS[e]).join(', ')}
                  </p>
                )}
                {(formData.metadata?.enabledEnvironments || []).length === 0 && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    ✓ Available in all environments
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-xs text-slate-500">(optional)</span>
                </label>
                <textarea
                  value={formData.metadata?.description || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    metadata: {
                      ...formData.metadata,
                      description: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add a description for this API key..."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tags <span className="text-xs text-slate-500">(optional, comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={formData.metadata?.tags?.join(', ') || ''}
                  onChange={(e) => {
                    const tags = e.target.value
                      .split(',')
                      .map(tag => tag.trim())
                      .filter(tag => tag.length > 0);
                    setFormData({
                      ...formData,
                      metadata: {
                        ...formData.metadata,
                        tags
                      }
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., production, primary, backup"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Separate multiple tags with commas
                </p>
                {formData.metadata?.tags && formData.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.metadata.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    provider: 'openai',
                    keyName: PROVIDER_LABELS['openai'],
                    value: '',
                    metadata: { enabledEnvironments: [], description: '', tags: [], additionalConfig: {} }
                  });
                }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setShowEditModal(false);
          setEditingKey(null);
        }}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit API Key
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingKey(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Current Key Info */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-200">
              <div className="text-sm text-slate-600 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getProviderIcon(editingKey.provider)}</span>
                  <span className="font-medium">{PROVIDER_LABELS[editingKey.provider]}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Current: {editingKey.maskedValue}
                </div>
                {editingKey.metadata?.environment && (
                  <div className="mt-2">
                    {getEnvironmentBadge(editingKey.metadata.environment)}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Provider
                </label>
                <input
                  type="text"
                  value={PROVIDER_LABELS[editingKey.provider]}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 cursor-not-allowed"
                  disabled
                />
                <p className="text-xs text-slate-500 mt-1">
                  Key name: <strong>{formData.keyName || PROVIDER_LABELS[editingKey.provider]}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New API Key Value
                </label>
                <div className="relative">
                  <input
                    type={showValue ? 'text' : 'password'}
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new key to update (leave empty to keep current)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue(!showValue)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    title={showValue ? "Hide" : "Show"}
                  >
                    {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to keep the current API key value unchanged
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Environment Access
                  <span className="text-xs text-slate-500 ml-2">(select one or multiple)</span>
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const enabledEnvs = formData.metadata?.enabledEnvironments || [];
                      setFormData({
                        ...formData,
                        metadata: {
                          ...formData.metadata,
                          enabledEnvironments: enabledEnvs.length === 0 ? ENVIRONMENT_OPTIONS : []
                        }
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${(formData.metadata?.enabledEnvironments || []).length === 0
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                  >
                    {(formData.metadata?.enabledEnvironments || []).length === 0 ? <CheckSquare size={12} /> : <Square size={12} />}
                    All Environments
                  </button>
                  <span className="text-xs text-slate-400">or select specific:</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ENVIRONMENT_OPTIONS.map(env => {
                    const enabledEnvs = formData.metadata?.enabledEnvironments || [];
                    const isEnabled = enabledEnvs.includes(env);
                    return (
                      <button
                        key={env}
                        type="button"
                        onClick={() => {
                          const currentEnvs = formData.metadata?.enabledEnvironments || [];
                          const newEnvs = isEnabled
                            ? currentEnvs.filter(e => e !== env)
                            : [...currentEnvs, env];
                          setFormData({
                            ...formData,
                            metadata: {
                              ...formData.metadata,
                              enabledEnvironments: newEnvs
                            }
                          });
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${isEnabled
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                      >
                        {isEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {ENVIRONMENT_LABELS[env]}
                      </button>
                    );
                  })}
                </div>
                {(formData.metadata?.enabledEnvironments || []).length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Active in: {(formData.metadata?.enabledEnvironments || []).map(e => ENVIRONMENT_LABELS[e]).join(', ')}
                  </p>
                )}
                {(formData.metadata?.enabledEnvironments || []).length === 0 && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    ✓ Available in all environments
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-xs text-slate-500">(optional)</span>
                </label>
                <textarea
                  value={formData.metadata?.description || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    metadata: {
                      ...formData.metadata,
                      description: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add a description for this API key..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tags <span className="text-xs text-slate-500">(optional, comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={formData.metadata?.tags?.join(', ') || ''}
                  onChange={(e) => {
                    const tags = e.target.value
                      .split(',')
                      .map(tag => tag.trim())
                      .filter(tag => tag.length > 0);
                    setFormData({
                      ...formData,
                      metadata: {
                        ...formData.metadata,
                        tags
                      }
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., production, primary, backup"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Separate multiple tags with commas
                </p>
                {formData.metadata?.tags && formData.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.metadata.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={handleUpdate}
                disabled={!formData.value.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingKey(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManager;

