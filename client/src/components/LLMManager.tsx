/**
 * LLM Manager Component - Admin interface for managing LLM models
 */

import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle, XCircle, Loader2, AlertTriangle, Info, Zap, Shield, Settings as SettingsIcon, DollarSign, Clock, HelpCircle, Play } from 'lucide-react';
import { getLLMModels, updateLLMModel, enableLLMModel, testLLMModel, LLMModel, LLMConfig, ModelTestResult } from '../services/adminApiExtended';

interface LLMManagerProps {
  token: string;
}

const LLMManager: React.FC<LLMManagerProps> = ({ token }) => {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, ModelTestResult>>({});

  useEffect(() => {
    loadModels();
  }, [token]);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLLMModels(token);
      setModels(data.models);
      setConfig(data.config);
    } catch (err: any) {
      setError(err.message || 'Failed to load LLM models');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (modelId: string, currentState: boolean) => {
    try {
      setUpdating(prev => new Set(prev).add(modelId));
      setError(null);
      
      const updated = await enableLLMModel(token, modelId, !currentState);
      
      setModels(prev => prev.map(m => m.id === modelId ? updated : m));
    } catch (err: any) {
      setError(err.message || 'Failed to update model');
    } finally {
      setUpdating(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
  };

  const handleTestModel = async (modelId: string) => {
    try {
      setTesting(prev => new Set(prev).add(modelId));
      setError(null);
      
      const result = await testLLMModel(token, modelId);
      
      setTestResults(prev => ({
        ...prev,
        [modelId]: result
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to test model');
      setTestResults(prev => ({
        ...prev,
        [modelId]: {
          model: modelId,
          status: 'test_failed',
          error: err.message,
          message: 'Test failed'
        }
      }));
    } finally {
      setTesting(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'gemini':
        return '🔮';
      case 'openai':
        return '🧠';
      case 'anthropic':
        return '🤖';
      case 'deepseek':
        return '🔍';
      case 'grok':
        return '⚡';
      case 'mistral':
        return '🌊';
      case 'qwen':
        return '🐉';
      case 'openrouter':
        return '🌐';
      case 'groq':
        return '⚡';
      case 'vertex':
        return '☁️';
      case 'azure':
        return '🔵';
      default:
        return '⚙️';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'gemini':
        return 'text-purple-600 bg-purple-100';
      case 'openai':
        return 'text-green-600 bg-green-100';
      case 'anthropic':
        return 'text-orange-600 bg-orange-100';
      case 'deepseek':
        return 'text-blue-600 bg-blue-100';
      case 'grok':
        return 'text-red-600 bg-red-100';
      case 'mistral':
        return 'text-indigo-600 bg-indigo-100';
      case 'qwen':
        return 'text-cyan-600 bg-cyan-100';
      case 'openrouter':
        return 'text-emerald-600 bg-emerald-100';
      case 'groq':
        return 'text-yellow-600 bg-yellow-100';
      case 'vertex':
        return 'text-blue-500 bg-blue-100';
      case 'azure':
        return 'text-sky-600 bg-sky-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Brain size={24} /> LLM Model Management
          </h2>
          <p className="text-slate-500 mt-1">Configure and manage AI models for intelligent routing</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Configuration Status */}
      {config && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <Info size={16} /> System Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Multi-LLM:</span>{' '}
              <span className={config.enableMultiLLM ? 'text-green-600' : 'text-slate-600'}>
                {config.enableMultiLLM ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="relative group">
              <div className="flex items-center gap-1">
                <span className="text-blue-700 font-medium">Default Provider:</span>
                <HelpCircle 
                  size={14} 
                  className="text-slate-400 cursor-help" 
                  title="Fallback provider used only if intelligent routing fails. With intelligent routing enabled, models are selected automatically based on task requirements."
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-slate-700 ${config.llmRoutingStrategy === 'intelligent' ? 'opacity-60' : ''}`}>
                  {config.defaultLLMProvider}
                </span>
                {config.llmRoutingStrategy === 'intelligent' && (
                  <span className="text-xs text-slate-500 italic" title="Intelligent routing overrides this setting">
                    (informational)
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Routing Strategy:</span>{' '}
              <span className={`capitalize ${config.llmRoutingStrategy === 'intelligent' ? 'text-green-600 font-medium' : 'text-slate-700'}`}>
                {config.llmRoutingStrategy}
              </span>
              {config.llmRoutingStrategy === 'intelligent' && (
                <span className="ml-1 text-xs text-green-600" title="Models are automatically selected based on task analysis">
                  ✓ Active
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Gemini:</span>{' '}
                {config.providers.gemini.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">OpenAI:</span>{' '}
                {config.providers.openai.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">Anthropic:</span>{' '}
                {config.providers.anthropic.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">DeepSeek:</span>{' '}
                {config.providers.deepseek?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">Grok:</span>{' '}
                {config.providers.grok?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">Mistral:</span>{' '}
                {config.providers.mistral?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">Qwen:</span>{' '}
                {config.providers.qwen?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">OpenRouter:</span>{' '}
                {config.providers.openrouter?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">Groq:</span>{' '}
                {config.providers.groq?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">Vertex AI:</span>{' '}
                {config.providers.vertex?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
              <div>
                <span className="text-blue-700 font-medium">Azure OpenAI:</span>{' '}
                {config.providers.azure?.configured ? (
                  <span className="text-green-600">✓ Configured</span>
                ) : (
                  <span className="text-red-600">✗ Not Configured</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Intelligent Routing Notice */}
          {config.llmRoutingStrategy === 'intelligent' && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-2">
                <Zap size={16} className="text-green-600 mt-0.5 shrink-0" />
                <div className="text-xs text-green-800">
                  <p className="font-medium mb-1">Intelligent Routing Active</p>
                  <p className="text-green-700">
                    The system automatically selects the best model for each task based on requirements, cost, and performance. 
                    The Default Provider setting above is only used as a fallback if routing fails (rare).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Models Grouped by Provider */}
      {['gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'mistral', 'qwen', 'openrouter', 'groq', 'vertex', 'azure'].map(provider => {
        const providerModels = models.filter(m => m.provider === provider);
        if (providerModels.length === 0) return null;

        return (
          <div key={provider} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getProviderIcon(provider)}</span>
              <h3 className="text-xl font-bold text-slate-800 capitalize">{provider} Models</h3>
              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                {providerModels.filter(m => m.status === 'active').length} active
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {providerModels.map(model => (
          <div
            key={model.id}
            className={`bg-white border rounded-xl p-6 shadow-sm transition-all ${
              !model.apiKeyConfigured
                ? 'border-red-200 bg-red-50/30 opacity-75'
                : model.isEnabled && model.status === 'active'
                ? 'border-green-200 hover:border-green-300'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getProviderIcon(model.provider)}</span>
                <div>
                  <h3 className="font-bold text-slate-800">{model.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getProviderColor(model.provider)}`}>
                      {model.provider}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      model.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {model.status}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Enable/Disable Toggle */}
              <div className="flex flex-col items-end gap-1">
                <label className={`relative inline-flex items-center ${!model.apiKeyConfigured ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={model.isEnabled}
                    onChange={() => handleToggleEnabled(model.id, model.isEnabled)}
                    disabled={updating.has(model.id) || model.status !== 'active' || !model.apiKeyConfigured}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                    !model.apiKeyConfigured 
                      ? 'bg-slate-300 peer-checked:bg-slate-400' 
                      : 'bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 peer-checked:bg-blue-600'
                  }`}></div>
                </label>
                {!model.apiKeyConfigured && (
                  <span className="text-xs text-red-600 font-medium" title="API key not configured for this provider">
                    No API Key
                  </span>
                )}
              </div>
            </div>

            {/* API Key Warning */}
            {!model.apiKeyConfigured && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">API Key Not Configured</p>
                    <p className="text-xs text-red-700 mt-1">
                      Add an API key for {model.provider} in API Keys Management to enable this model.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Capabilities */}
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Capabilities</div>
              <div className="flex flex-wrap gap-2">
                {model.capabilities.structuredOutput && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">Structured Output</span>
                )}
                {model.capabilities.codeGeneration && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">Code Generation</span>
                )}
                {model.capabilities.longContext && (
                  <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">Long Context</span>
                )}
                {model.capabilities.fastResponse && (
                  <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs">Fast Response</span>
                )}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-slate-400" />
                <div>
                  <div className="text-slate-500 text-xs">Input Cost</div>
                  <div className="font-medium text-slate-700">
                    ${model.pricing.inputCostPer1MTokens}/1M tokens
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <div>
                  <div className="text-slate-500 text-xs">Avg Latency</div>
                  <div className="font-medium text-slate-700">{model.performance.avgLatencyMs}ms</div>
                </div>
              </div>
            </div>

            {/* Recommended For */}
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recommended For</div>
              <div className="text-sm text-slate-600">
                <div className="mb-1">
                  <span className="font-medium">Roles:</span>{' '}
                  {model.recommendedFor.agentRoles.slice(0, 3).join(', ')}
                  {model.recommendedFor.agentRoles.length > 3 && '...'}
                </div>
                <div>
                  <span className="font-medium">Complexity:</span>{' '}
                  {model.recommendedFor.complexity.join(', ')}
                </div>
              </div>
            </div>

            {/* Test Model Button */}
            {model.isEnabled && model.status === 'active' && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => handleTestModel(model.id)}
                  disabled={testing.has(model.id) || updating.has(model.id) || model.status !== 'active'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing.has(model.id) ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Test Model
                    </>
                  )}
                </button>
                
                {testResults[model.id] && (
                  <div className={`mt-3 p-3 rounded-lg text-xs ${
                    testResults[model.id].status === 'operational'
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    <div className="font-bold mb-1 flex items-center gap-2">
                      {testResults[model.id].status === 'operational' ? (
                        <>
                          <CheckCircle size={14} />
                          Test Successful
                        </>
                      ) : (
                        <>
                          <XCircle size={14} />
                          Test Failed
                        </>
                      )}
                    </div>
                    {testResults[model.id].testResult && (
                      <div className="space-y-1 text-xs mt-2">
                        {testResults[model.id].testResult.response && (
                          <div>Response: {testResults[model.id].testResult.response.substring(0, 100)}...</div>
                        )}
                        <div>Tokens Used: {testResults[model.id].testResult.tokensUsed || 0}</div>
                        <div>Provider: {testResults[model.id].testResult.provider}</div>
                      </div>
                    )}
                    {testResults[model.id].error && (
                      <div className="mt-2 text-xs font-medium">
                        <div className="font-bold mb-1">Error:</div>
                        <div className="text-red-700">{testResults[model.id].error}</div>
                      </div>
                    )}
                    {testResults[model.id].message && testResults[model.id].status === 'test_failed' && (
                      <div className="mt-2 text-xs text-red-700">
                        {testResults[model.id].message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Status Message */}
            {!model.isEnabled && model.status === 'active' && (
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-600">
                Model is disabled. Enable to use in routing.
              </div>
            )}
            {model.status === 'deprecated' && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                <div className="font-medium mb-1">⚠️ Deprecated Model</div>
                <div>This model is no longer available and cannot be tested or used.</div>
              </div>
            )}
            {model.status === 'maintenance' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-700">
                <div className="font-medium mb-1">🔧 Under Maintenance</div>
                <div>This model is under maintenance and not available for testing.</div>
              </div>
            )}
            {!config?.providers[model.provider as keyof typeof config.providers]?.configured && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                API key not configured for {model.provider}
              </div>
            )}

            {updating.has(model.id) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                <Loader2 size={12} className="animate-spin" />
                Updating...
              </div>
            )}
          </div>
            ))}
            </div>
          </div>
        );
      })}

      {/* Info Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-slate-400 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">About LLM Routing</p>
            {config?.llmRoutingStrategy === 'intelligent' ? (
              <>
                <p className="mb-2">
                  With <span className="font-medium text-slate-700">Intelligent Routing</span> enabled, the system automatically selects the best LLM model for each task based on:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Task complexity and type</li>
                  <li>Agent role requirements</li>
                  <li>Required capabilities (structured output, function calling, etc.)</li>
                  <li>Cost constraints and package limits</li>
                  <li>Performance and latency requirements</li>
                </ul>
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  <p className="font-medium mb-1">💡 Default Provider Explained:</p>
                  <p>
                    The "Default Provider" setting is <span className="font-medium">informational only</span> when intelligent routing is active. 
                    It serves as a fallback provider if intelligent routing fails (which is rare). 
                    To change it, set the <code className="bg-blue-100 px-1 rounded">DEFAULT_LLM_PROVIDER</code> environment variable.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2">
                  The system selects LLM models based on:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Task complexity and type</li>
                  <li>Agent role requirements</li>
                  <li>Cost constraints and package limits</li>
                  <li>Performance and latency requirements</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Only enabled models with configured API keys will be used for routing.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LLMManager;

