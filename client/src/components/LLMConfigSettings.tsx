import React, { useState, useEffect } from 'react';
import { Key, Server, Trash2, TestTube, CheckCircle, XCircle, Loader, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getLLMConfig, updateLLMConfig, testLLMConnection, deleteApiKey, deleteLocalLLM, LLMConfig, LocalLLMConfig } from '../services/userSettingsApi';
import { toast } from '../services/toastService';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface LLMConfigSettingsProps {
  token: string;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...' },
  { id: 'grok', name: 'Grok (xAI)', placeholder: 'xai-...' },
  { id: 'mistral', name: 'Mistral', placeholder: '...' },
  { id: 'qwen', name: 'Qwen', placeholder: '...' },
  { id: 'groq', name: 'Groq', placeholder: 'gsk_...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'gemini', name: 'Gemini', placeholder: 'AIza...' }
];

const LOCAL_LLM_TYPES = [
  { id: 'ollama', name: 'Ollama', defaultUrl: 'http://localhost:11434' },
  { id: 'vllm', name: 'vLLM', defaultUrl: 'http://localhost:8000' },
  { id: 'openai_compatible', name: 'OpenAI-Compatible', defaultUrl: 'http://localhost:8000' }
];

export const LLMConfigSettings: React.FC<LLMConfigSettingsProps> = ({ token }) => {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string; models?: string[] }>>({});
  const [localLLMs, setLocalLLMs] = useState<LocalLLMConfig[]>([]);
  const [newLocalLLM, setNewLocalLLM] = useState<Partial<LocalLLMConfig>>({
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    enabled: true
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async (preserveScroll: boolean = false) => {
    try {
      // Save scroll position if requested
      const scrollPosition = preserveScroll ? window.scrollY : undefined;
      
      setLoading(true);
      const loadedConfig = await getLLMConfig(token);
      setConfig(loadedConfig);
      setLocalLLMs(loadedConfig.localLLMs || []);
      
      // Restore scroll position after state update
      if (preserveScroll && scrollPosition !== undefined) {
        // Use multiple animation frames to ensure DOM has updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: scrollPosition,
              behavior: 'instant'
            });
          });
        });
      }
    } catch (error: any) {
      toast.error(`Failed to load LLM configuration: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeyChange = (provider: string, value: string) => {
    setApiKeys({ ...apiKeys, [provider]: value });
    // Clear test result if user changes the API key
    if (value.trim() === '') {
      setTestResults({ ...testResults, [provider]: undefined });
    }
  };

  const handleSaveApiKey = async (provider: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    const apiKey = apiKeys[provider];
    if (!apiKey || !apiKey.trim()) {
      toast.warning('Please enter an API key first');
      return;
    }

    // Check if API key has been tested successfully
    const testResult = testResults[provider];
    if (!testResult || !testResult.success) {
      toast.warning('Please test the API key before saving. The test must be successful.');
      return;
    }

    try {
      setSaving(true);
      const currentApiKeys = config?.apiKeys || [];
      const updatedApiKeys = [
        ...currentApiKeys.filter(k => k.provider !== provider),
        {
          provider,
          apiKey: apiKey.trim(),
          createdAt: new Date(),
          lastUsed: undefined
        }
      ];

      await updateLLMConfig(token, {
        ...config,
        apiKeys: updatedApiKeys as any
      });

      await loadConfig(true); // Preserve scroll position
      setApiKeys({ ...apiKeys, [provider]: '' });
      setEditingKeys({ ...editingKeys, [provider]: false });
      // Keep test result for future reference
      toast.success(`${provider} API key saved successfully`);
    } catch (error: any) {
      toast.error(`Failed to save API key: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditApiKey = (provider: string) => {
    setEditingKeys({ ...editingKeys, [provider]: true });
    setApiKeys({ ...apiKeys, [provider]: '' });
    // Clear test results when editing (user needs to test new key)
    setTestResults({ ...testResults, [provider]: undefined });
  };

  const handleCancelEditApiKey = (provider: string) => {
    setEditingKeys({ ...editingKeys, [provider]: false });
    setApiKeys({ ...apiKeys, [provider]: '' });
  };

  const handleTestApiKey = async (provider: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    const apiKey = apiKeys[provider];
    const existingKey = config?.apiKeys?.find(k => k.provider === provider);
    
    // If no key entered but there's an existing saved key, test the saved one
    if (!apiKey || !apiKey.trim()) {
      if (existingKey) {
        // Test saved key
        try {
          setTesting({ ...testing, [provider]: true });
          const result = await testLLMConnection(token, {
            type: 'api_key',
            provider
            // No apiKey provided - backend will use saved key
          });
          setTestResults({ ...testResults, [provider]: result });
          if (result.success) {
            toast.success(`${provider} API key is valid`);
          } else {
            toast.error(`${provider} API key test failed: ${result.error || 'Unknown error'}`);
          }
        } catch (error: any) {
          setTestResults({ ...testResults, [provider]: { success: false, error: error.message } });
          toast.error(`Failed to test API key: ${error.message || 'Unknown error'}`);
        } finally {
          setTesting({ ...testing, [provider]: false });
        }
        return;
      } else {
        toast.warning('Please enter an API key first');
        return;
      }
    }

    // Test the entered key
    try {
      setTesting({ ...testing, [provider]: true });
      const result = await testLLMConnection(token, {
        type: 'api_key',
        provider,
        apiKey: apiKey.trim()
      });
      setTestResults({ ...testResults, [provider]: result });
      if (result.success) {
        toast.success(`${provider} API key is valid`);
      } else {
        toast.error(`${provider} API key test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setTestResults({ ...testResults, [provider]: { success: false, error: error.message } });
      toast.error(`Failed to test API key: ${error.message || 'Unknown error'}`);
    } finally {
      setTesting({ ...testing, [provider]: false });
    }
  };

  const handleDeleteApiKey = async (provider: string) => {
    toast.confirm(
      `Are you sure you want to delete the API key for ${provider}?`,
      async () => {
        try {
      await deleteApiKey(token, provider);
      await loadConfig(true); // Preserve scroll position
      toast.success(`${provider} API key deleted successfully`);
        } catch (error: any) {
          toast.error(`Failed to delete API key: ${error.message || 'Unknown error'}`);
        }
      },
      () => {
        toast.info('API key deletion cancelled');
      },
      'Delete',
      'Cancel'
    );
  };

  const handleAddLocalLLM = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!newLocalLLM.type || !newLocalLLM.baseUrl) {
      toast.warning('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const updatedLocalLLMs = [
        ...localLLMs,
        {
          type: newLocalLLM.type!,
          baseUrl: newLocalLLM.baseUrl!,
          models: [],
          enabled: newLocalLLM.enabled !== false,
          createdAt: new Date()
        }
      ];

      await updateLLMConfig(token, {
        ...config,
        localLLMs: updatedLocalLLMs as any
      });

      await loadConfig(true); // Preserve scroll position
      setNewLocalLLM({
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        enabled: true
      });
      toast.success(`Local LLM (${newLocalLLM.type}) added successfully`);
    } catch (error: any) {
      toast.error(`Failed to add local LLM: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestLocalLLM = async (llm: LocalLLMConfig, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    try {
      setTesting({ ...testing, [`local-${llm.type}-${llm.baseUrl}`]: true });
      const result = await testLLMConnection(token, {
        type: 'local_llm',
        localLLMType: llm.type,
        baseUrl: llm.baseUrl
      });
      setTestResults({ ...testResults, [`local-${llm.type}-${llm.baseUrl}`]: result });
      if (result.success) {
        toast.success(`Connected to ${LOCAL_LLM_TYPES.find(t => t.id === llm.type)?.name || llm.type}! Found ${result.models?.length || 0} model(s)`);
      } else {
        toast.error(`Connection test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      setTestResults({ ...testResults, [`local-${llm.type}-${llm.baseUrl}`]: { success: false, error: errorMessage } });
      toast.error(`Connection test failed: ${errorMessage}`);
    } finally {
      setTesting({ ...testing, [`local-${llm.type}-${llm.baseUrl}`]: false });
    }
  };

  const handleDeleteLocalLLM = async (llm: LocalLLMConfig) => {
    toast.confirm(
      `Are you sure you want to remove the local LLM (${LOCAL_LLM_TYPES.find(t => t.id === llm.type)?.name || llm.type}) at ${llm.baseUrl}?`,
      async () => {
        try {
      await deleteLocalLLM(token, llm.type, llm.baseUrl);
      await loadConfig(true); // Preserve scroll position
      toast.success('Local LLM removed successfully');
        } catch (error: any) {
          toast.error(`Failed to remove local LLM: ${error.message || 'Unknown error'}`);
        }
      },
      () => {
        toast.info('Local LLM removal cancelled');
      },
      'Remove',
      'Cancel'
    );
  };

  const handleUpdatePreference = async (preference: 'user' | 'platform' | 'user_then_platform') => {
    try {
      setSaving(true);
      await updateLLMConfig(token, {
        ...config,
        apiKeyPreference: preference
      });
      await loadConfig(true); // Preserve scroll position
      toast.success('API key preference updated');
    } catch (error: any) {
      toast.error(`Failed to update preference: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProviderOverride = async (provider: string, preference: 'user' | 'platform' | 'user_then_platform' | null) => {
    try {
      setSaving(true);
      const overrides = { ...(config?.providerOverrides || {}) };
      if (preference === null) {
        delete overrides[provider];
      } else {
        overrides[provider] = preference;
      }
      await updateLLMConfig(token, {
        ...config,
        providerOverrides: Object.keys(overrides).length > 0 ? overrides : undefined
      });
      await loadConfig(true); // Preserve scroll position
      toast.success(`${provider} preference override ${preference ? 'updated' : 'removed'}`);
    } catch (error: any) {
      toast.error(`Failed to update provider override: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* API Key Preference */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">API Key Preference</h3>
            <p className="text-sm text-slate-500">Choose which API keys to use for LLM requests</p>
          </div>
          <div className="text-xs text-slate-500">
            {config?.apiKeys?.length || 0} user key{config?.apiKeys?.length !== 1 ? 's' : ''} configured
          </div>
        </div>
        
        {/* Global Preference */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Global Preference</label>
          <div className="space-y-2">
            {(['user', 'platform', 'user_then_platform'] as const).map((pref) => {
              const isSelected = config?.apiKeyPreference === pref;
              return (
                <label 
                  key={pref} 
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="apiKeyPreference"
                    value={pref}
                    checked={isSelected}
                    onChange={() => handleUpdatePreference(pref)}
                    className="mt-1 text-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium text-slate-800">
                        {pref === 'user' && 'User Keys Only'}
                        {pref === 'platform' && 'Platform Keys Only'}
                        {pref === 'user_then_platform' && 'User Keys First, Then Platform'}
                      </div>
                      {isSelected && (
                        <span className="text-xs px-2 py-0.5 bg-primary text-white rounded">Active</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      {pref === 'user' && 'Only use your own API keys. Requests will fail if a provider doesn\'t have a user key configured.'}
                      {pref === 'platform' && 'Only use platform-provided API keys. Your user keys will be ignored.'}
                      {pref === 'user_then_platform' && 'Try your keys first, then automatically fallback to platform keys if unavailable. Recommended for flexibility.'}
                    </div>
                    {pref === 'user_then_platform' && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>User key available</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span>Platform fallback</span>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Provider Status Overview */}
        {config?.apiKeys && config.apiKeys.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-sm font-medium text-slate-700 mb-3">Provider Status</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PROVIDERS.map((provider) => {
                const hasUserKey = config.apiKeys?.some(k => k.provider === provider.id);
                const userKey = config.apiKeys?.find(k => k.provider === provider.id);
                return (
                  <div 
                    key={provider.id} 
                    className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      hasUserKey ? 'bg-green-500' : 'bg-slate-300'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{provider.name}</div>
                      {hasUserKey && userKey?.lastUsed && (
                        <div className="text-xs text-slate-500">
                          Used {new Date(userKey.lastUsed).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>User key configured</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                  <span>Using platform key</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-Provider Overrides */}
        {config?.apiKeys && config.apiKeys.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Per-Provider Overrides</label>
                <p className="text-xs text-slate-500 mt-1">Override global preference for specific providers</p>
              </div>
            </div>
            <div className="space-y-2">
              {PROVIDERS.filter(p => config.apiKeys?.some(k => k.provider === p.id)).map((provider) => {
                const override = config?.providerOverrides?.[provider.id];
                const effectivePreference = override || config?.apiKeyPreference || 'user_then_platform';
                return (
                  <div key={provider.id} className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium text-slate-700">{provider.name}</span>
                        {override && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Override</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={override || 'inherit'}
                          onChange={(e) => {
                            const value = e.target.value;
                            handleUpdateProviderOverride(
                              provider.id,
                              value === 'inherit' ? null : value as 'user' | 'platform' | 'user_then_platform'
                            );
                          }}
                          className="text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          disabled={saving}
                        >
                          <option value="inherit">Use Global ({config?.apiKeyPreference?.replace('_', ' ')})</option>
                          <option value="user">User Only</option>
                          <option value="platform">Platform Only</option>
                          <option value="user_then_platform">User Then Platform</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Current: <span className="font-medium">{effectivePreference.replace('_', ' ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* API Keys Section */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">API Keys</h3>
        <p className="text-sm text-slate-500 mb-4">Add your own API keys for different providers</p>
        
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const existingKey = config?.apiKeys?.find(k => k.provider === provider.id);
            const isTesting = testing[provider.id];
            const testResult = testResults[provider.id];
            
            return (
              <div key={provider.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-slate-500" />
                    <span className="font-medium text-slate-700">{provider.name}</span>
                    {existingKey && !editingKeys[provider.id] && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Configured</span>
                    )}
                    {testResults[provider.id]?.success && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1">
                        <CheckCircle size={12} />
                        Tested
                      </span>
                    )}
                    {testResults[provider.id] && !testResults[provider.id]?.success && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1">
                        <XCircle size={12} />
                        Test Failed
                      </span>
                    )}
                    </div>
                    {existingKey && !editingKeys[provider.id] && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEditApiKey(provider.id);
                          }}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="Replace API key"
                        >
                          <Key size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteApiKey(provider.id);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete API key"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showKeys[provider.id] ? 'text' : 'password'}
                      placeholder={existingKey && !editingKeys[provider.id] ? '••••••••' : provider.placeholder}
                      value={apiKeys[provider.id] || ''}
                      onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={!!existingKey && !editingKeys[provider.id]}
                    />
                    {apiKeys[provider.id] && (
                      <button
                        type="button"
                        onClick={() => setShowKeys({ ...showKeys, [provider.id]: !showKeys[provider.id] })}
                        className="absolute right-2 top-2 text-slate-500 hover:text-slate-700"
                      >
                        {showKeys[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {editingKeys[provider.id] && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelEditApiKey(provider.id);
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                    {/* Show test button - always available if there's a key to test */}
                    {(existingKey || apiKeys[provider.id]) && (
                      <button
                        type="button"
                        onClick={(e) => handleTestApiKey(provider.id, e)}
                        disabled={isTesting || (editingKeys[provider.id] && !apiKeys[provider.id])}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        title={existingKey && !editingKeys[provider.id] ? 'Test saved API key' : 'Test API key'}
                      >
                        {isTesting ? <Loader className="animate-spin" size={16} /> : <TestTube size={16} />}
                        Test
                      </button>
                    )}
                    {/* Show save/update button only when editing or adding new */}
                    {(!existingKey || editingKeys[provider.id]) && (
                      <button
                        type="button"
                        onClick={(e) => handleSaveApiKey(provider.id, e)}
                        disabled={saving || !apiKeys[provider.id] || !testResults[provider.id]?.success}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                        title={
                          !apiKeys[provider.id] 
                            ? 'Please enter an API key' 
                            : !testResults[provider.id]?.success 
                            ? 'Please test the API key successfully before saving' 
                            : ''
                        }
                      >
                        {saving ? (
                          <>
                            <Loader className="animate-spin" size={16} />
                            Saving...
                          </>
                        ) : (
                          editingKeys[provider.id] ? 'Update' : 'Save'
                        )}
                      </button>
                    )}
                  </div>
                </div>
                
                {testResult && (
                  <div className={`mt-2 p-2 rounded flex items-center gap-2 text-sm ${
                    testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {testResult.success ? 'Connection successful!' : testResult.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Local LLMs Section */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Local LLMs</h3>
        <p className="text-sm text-slate-500 mb-4">Configure locally deployed LLM servers</p>
        
        {/* Existing Local LLMs */}
        {localLLMs.length > 0 && (
          <div className="space-y-4 mb-6">
            {localLLMs.map((llm, index) => {
              const testKey = `local-${llm.type}-${llm.baseUrl}`;
              const isTesting = testing[testKey];
              const testResult = testResults[testKey];
              
              return (
                <div key={index} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server size={16} className="text-slate-500" />
                      <span className="font-medium text-slate-700">
                        {LOCAL_LLM_TYPES.find(t => t.id === llm.type)?.name || llm.type}
                      </span>
                      <span className="text-xs text-slate-500">{llm.baseUrl}</span>
                      {llm.enabled && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Enabled</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteLocalLLM(llm);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove local LLM"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  {llm.models && llm.models.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-slate-500 mb-1">Available Models:</div>
                      <div className="flex flex-wrap gap-2">
                        {llm.models.map((model, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            {model}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleTestLocalLLM(llm, e)}
                      disabled={isTesting}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {isTesting ? <Loader className="animate-spin" size={16} /> : <TestTube size={16} />}
                      Test Connection
                    </button>
                  </div>
                  
                  {testResult && (
                    <div className={`mt-2 p-2 rounded flex items-center gap-2 text-sm ${
                      testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      {testResult.success 
                        ? `Connected! Found ${testResult.models?.length || 0} model(s)`
                        : testResult.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Add New Local LLM */}
        <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
          <h4 className="font-medium text-slate-700 mb-3">Add Local LLM</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={newLocalLLM.type}
                onChange={(e) => setNewLocalLLM({ ...newLocalLLM, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LOCAL_LLM_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
              <input
                type="text"
                value={newLocalLLM.baseUrl}
                onChange={(e) => setNewLocalLLM({ ...newLocalLLM, baseUrl: e.target.value })}
                placeholder={LOCAL_LLM_TYPES.find(t => t.id === newLocalLLM.type)?.defaultUrl}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="button"
              onClick={(e) => handleAddLocalLLM(e)}
              disabled={saving || !newLocalLLM.type || !newLocalLLM.baseUrl}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Add Local LLM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

