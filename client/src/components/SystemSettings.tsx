import React, { useState, useEffect } from 'react';
import {
  Settings, Database, Server, Activity, Zap, Clock, HardDrive,
  Cpu, Globe, Shield, RefreshCw, CheckCircle, XCircle, AlertCircle,
  TrendingUp, Users, Folder, FileText, Loader2, Save, Edit, Search
} from 'lucide-react';
import { getSystemConfig, getSystemStats, getComprehensiveSystemDetails, getEnvironmentVariables, updateEnvironmentVariables, type EnvironmentVariablesResponse } from '../services/adminApi';
import { getLLMConfig, type LLMConfig } from '../services/adminApiExtended';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface SystemSettingsProps {
  token: string;
}

interface SystemConfig {
  api: {
    geminiConfigured: boolean;
    e2bConfigured: boolean;
    openaiConfigured: boolean;
    anthropicConfigured: boolean;
    deepseekConfigured: boolean;
    grokConfigured: boolean;
    mongodbConnected: boolean;
    weaviateConfigured?: boolean;
  };
  server: {
    nodeVersion: string;
    environment: string;
    port: string | number;
  };
  limits: {
    maxProjectsPerUser: number;
    maxUsersPerPlan: Record<string, number>;
    packageLimits?: Array<{
      packageName: string;
      maxProjects: number;
      maxAgents: number;
      maxTasks: number;
      maxStorageGB: number;
      maxAPICalls: number;
      maxTeamMembers: number;
      maxMonthlyBudget: number;
    }>;
  };
}

interface SystemStats {
  counts: {
    totalUsers: number;
    totalProjects: number;
    totalTasks: number;
    totalArtifacts: number;
  };
  database: {
    collections: number;
    dataSize: number;
    storageSize: number;
  } | null;
}


const SystemSettings: React.FC<SystemSettingsProps> = ({ token }) => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [llmStatus, setLLMStatus] = useState<LLMConfig['providers'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'apis' | 'database' | 'limits' | 'users' | 'projects' | 'packages' | 'llm-usage' | 'environment'>('overview');
  const [comprehensiveData, setComprehensiveData] = useState<any>(null);
  const [envVars, setEnvVars] = useState<EnvironmentVariablesResponse | null>(null);
  const [editingEnvVar, setEditingEnvVar] = useState<string | null>(null);
  const [envVarValues, setEnvVarValues] = useState<Record<string, string>>({});
  const [savingEnv, setSavingEnv] = useState(false);
  const [envSearchTerm, setEnvSearchTerm] = useState('');
  const [envCategoryFilter, setEnvCategoryFilter] = useState<string>('all');

  const loadData = async () => {
    try {
      setError(null);
      const [configData, statsData, llmData, comprehensiveDataResult] = await Promise.allSettled([
        getSystemConfig(token),
        getSystemStats(token),
        getLLMConfig(token).catch(() => null), // Optional
        getComprehensiveSystemDetails(token).catch(() => null) // Optional but preferred
      ]);

      // Log any failures for debugging (only in dev mode and only once)
      const isConnectionError = (reason: any) => {
        const msg = reason?.message || String(reason);
        return msg.includes('Failed to fetch') || msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('Cannot connect');
      };
      
      if (configData.status === 'rejected' && !isConnectionError(configData.reason)) {
        if (import.meta.env.DEV) {
          console.debug('System config API failed:', configData.reason);
        }
      }
      if (statsData.status === 'rejected' && !isConnectionError(statsData.reason)) {
        if (import.meta.env.DEV) {
          console.debug('System stats API failed:', statsData.reason);
        }
      }
      if (comprehensiveDataResult.status === 'rejected' && !isConnectionError(comprehensiveDataResult.reason)) {
        if (import.meta.env.DEV) {
          console.debug('Comprehensive system details API failed:', comprehensiveDataResult.reason);
        }
      }

      if (comprehensiveDataResult.status === 'fulfilled' && comprehensiveDataResult.value) {
        // Use comprehensive data if available - it has everything
        setComprehensiveData(comprehensiveDataResult.value);
        
        // Set config from comprehensive data
        setConfig({
          api: comprehensiveDataResult.value.api || {},
          server: comprehensiveDataResult.value.system || {},
          limits: comprehensiveDataResult.value.limits || {}
        });
        
        // Set stats from comprehensive data
        setStats({
          counts: comprehensiveDataResult.value.summary || {},
          database: comprehensiveDataResult.value.database || null
        });
      } else {
        // Fallback to individual endpoints
        if (configData.status === 'fulfilled' && configData.value) {
          setConfig(configData.value);
        } else if (configData.status === 'rejected') {
          const errorMsg = configData.reason?.message || String(configData.reason);
          const isConnectionError = errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('ERR_CONNECTION_REFUSED');
          
          if (!isConnectionError && import.meta.env.DEV) {
            console.debug('Failed to load system config:', configData.reason);
          }
          
          if (errorMsg.includes('token') || errorMsg.includes('auth') || errorMsg.includes('401') || errorMsg.includes('403')) {
            setError('Authentication failed. Please log in again as admin.');
          } else if (isConnectionError) {
            setError('Cannot connect to backend server. Please ensure the server is running.');
          } else {
            setError(errorMsg);
          }
        }

        if (statsData.status === 'fulfilled' && statsData.value) {
          setStats(statsData.value);
        } else if (statsData.status === 'rejected') {
          const errorMsg = statsData.reason?.message || String(statsData.reason);
          const isConnectionError = errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('ERR_CONNECTION_REFUSED');
          if (!isConnectionError && import.meta.env.DEV) {
            console.debug('Failed to load system stats:', statsData.reason);
          }
        }
      }
      
      // If no config was loaded after all attempts, show error with details
      if (!config && (configData.status === 'rejected' || comprehensiveDataResult.status === 'rejected')) {
        if (!error) {
          // Get the actual error message from the failed requests
          const errors: string[] = [];
          if (configData.status === 'rejected') {
            const errMsg = configData.reason?.message || String(configData.reason);
            errors.push(`System Config: ${errMsg}`);
          }
          if (comprehensiveDataResult.status === 'rejected') {
            const errMsg = comprehensiveDataResult.reason?.message || String(comprehensiveDataResult.reason);
            errors.push(`System Details: ${errMsg}`);
          }
          
          const combinedError = errors.length > 0 
            ? `Unable to load system configuration:\n${errors.join('\n')}`
            : 'Unable to load system configuration. Please check your admin authentication.';
          
          setError(combinedError);
          // Only log detailed error info in dev mode and if not a connection error
          const hasConnectionError = errors.some(e => e.includes('Failed to fetch') || e.includes('ERR_CONNECTION_REFUSED'));
          if (import.meta.env.DEV && !hasConnectionError) {
            console.debug('System Settings - All API calls failed:', {
              configData: configData.status === 'rejected' ? configData.reason : 'OK',
              comprehensiveDataResult: comprehensiveDataResult.status === 'rejected' ? comprehensiveDataResult.reason : 'OK',
              statsData: statsData.status === 'rejected' ? statsData.reason : 'OK',
              token: token ? 'Present' : 'Missing'
            });
          }
        }
      }

      if (llmData.status === 'fulfilled' && llmData.value) {
        setLLMStatus(llmData.value.providers);
      } else {
        // If LLM status fails, set to null to show placeholder
        setLLMStatus(null);
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load system settings:', err);
      setError(err.message || 'Failed to load system settings');
      setLoading(false);
      
      // If all API calls failed, set empty config to show "Unknown" values
      if (!config) {
        setConfig({
          api: { mongodbConnected: false },
          server: {},
          limits: {}
        });
      }
    }
  };

  const loadEnvironmentVariables = async () => {
    try {
      const data = await getEnvironmentVariables(token);
      setEnvVars(data);
      // Initialize editing values
      const initialValues: Record<string, string> = {};
      for (const [key, varData] of Object.entries(data.variables)) {
        if (varData.editable) {
          initialValues[key] = varData.masked ? '' : varData.value;
        }
      }
      setEnvVarValues(initialValues);
    } catch (err: any) {
      const isConnectionError = err.message?.includes('Failed to fetch') || err.message?.includes('ERR_CONNECTION_REFUSED') || err.message?.includes('Cannot connect');
      
      if (!isConnectionError && import.meta.env.DEV) {
        console.debug('Failed to load environment variables:', err);
      }
      
      // Don't show error if user doesn't have permission (superadmin only) or if it's a connection error
      if (!err.message?.includes('403') && !err.message?.includes('permission') && !isConnectionError) {
        setError(`Failed to load environment variables: ${err.message}`);
      }
    }
  };

  const handleSaveEnvironmentVariables = async () => {
    if (!envVars) return;
    
    setSavingEnv(true);
    try {
      // Only send non-empty values that have changed
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(envVarValues)) {
        const original = envVars.variables[key];
        if (value && value !== original.value && !value.startsWith('***')) {
          updates[key] = value;
        }
      }
      
      if (Object.keys(updates).length === 0) {
        setSavingEnv(false);
        return;
      }
      
      await updateEnvironmentVariables(token, updates);
      
      // Reload environment variables
      await loadEnvironmentVariables();
      
      // Show success message
      alert(`Environment variables updated successfully!\n\nUpdated: ${Object.keys(updates).join(', ')}\n\nNote: Some changes may require server restart to take effect.`);
    } catch (err: any) {
      console.error('Failed to update environment variables:', err);
      alert(`Failed to update environment variables: ${err.message}`);
    } finally {
      setSavingEnv(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Load environment variables if user has permission
    loadEnvironmentVariables().catch(() => {
      // Silently fail if user doesn't have permission
    });

    if (autoRefresh) {
      const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [token, autoRefresh]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  if (loading && !config && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-500 mr-3" size={24} />
        <span className="text-slate-600">Loading system settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <Settings size={28} className="text-blue-600" /> System Settings
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock size={14} />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <button
            onClick={loadData}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'projects', label: 'Projects', icon: Folder },
          { id: 'llm-usage', label: 'LLM Usage', icon: Zap },
      { id: 'apis', label: 'API Status', icon: Globe },
      { id: 'database', label: 'Database', icon: Database },
      { id: 'packages', label: 'Packages', icon: FileText },
      { id: 'limits', label: 'System Limits', icon: Shield },
      { id: 'environment', label: 'Environment', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-4 py-2 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
              activeSection === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* OVERVIEW SECTION - High-level summary only */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats && (
                <>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium opacity-80">Total Users</h3>
                      <Users size={20} className="opacity-80" />
                    </div>
                    <p className="text-4xl font-bold">{formatNumber(stats.counts.totalUsers)}</p>
                    <p className="text-xs opacity-80 mt-1">Click Users tab for details</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-600 to-pink-700 text-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium opacity-80">Total Projects</h3>
                      <Folder size={20} className="opacity-80" />
                    </div>
                    <p className="text-4xl font-bold">{formatNumber(stats.counts.totalProjects)}</p>
                    <p className="text-xs opacity-80 mt-1">Click Projects tab for details</p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium opacity-80">Database Size</h3>
                      <HardDrive size={20} className="opacity-80" />
                    </div>
                    <p className="text-2xl font-bold">
                      {stats.database ? formatBytes(stats.database.dataSize) : 'N/A'}
                    </p>
                    <p className="text-xs opacity-80 mt-1">Click Database tab for details</p>
                  </div>

                  {comprehensiveData && comprehensiveData.llmUsage && (
                    <div className="bg-gradient-to-br from-yellow-600 to-orange-700 text-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium opacity-80">LLM Calls Today</h3>
                        <Zap size={20} className="opacity-80" />
                      </div>
                      <p className="text-4xl font-bold">{formatNumber(comprehensiveData.llmUsage.today.calls)}</p>
                      <p className="text-xs opacity-80 mt-1">Click LLM Usage tab for details</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* System Health Status */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Activity size={20} className="text-blue-600" />
                System Health
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      config?.api.mongodbConnected ? 'bg-emerald-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium text-slate-800">Database</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    config?.api.mongodbConnected
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {config?.api.mongodbConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      config?.api.geminiConfigured ? 'bg-emerald-500' : 'bg-slate-300'
                    }`} />
                    <span className="font-medium text-slate-800">Gemini API</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    config?.api.geminiConfigured
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {config?.api.geminiConfigured ? 'Configured' : 'Not Set'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-800">Environment</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 capitalize">
                    {config?.server.environment || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API STATUS SECTION */}
        {activeSection === 'apis' && (
          <div className="space-y-6">
            {/* LLM Providers */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Zap size={20} className="text-yellow-500" />
                LLM Provider Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {llmStatus && Object.entries(llmStatus).map(([provider, status]) => (
                  <div
                    key={provider}
                    className={`p-4 rounded-lg border-2 ${
                      status.configured && status.hasKey
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-800 capitalize">{provider}</span>
                      {status.configured && status.hasKey ? (
                        <CheckCircle size={20} className="text-emerald-600" />
                      ) : (
                        <XCircle size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          status.hasKey ? 'bg-emerald-500' : 'bg-slate-300'
                        }`} />
                        API Key: {status.hasKey ? 'Configured' : 'Not Set'}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          status.configured ? 'bg-emerald-500' : 'bg-slate-300'
                        }`} />
                        Status: {status.configured ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>
                ))}
                {!llmStatus && (
                  <p className="col-span-full text-sm text-slate-500 text-center py-4">
                    Loading LLM provider status...
                  </p>
                )}
              </div>
            </div>

            {/* API Services */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Globe size={20} className="text-blue-500" />
                API Services
              </h3>
              <div className="space-y-3">
                {/* LLM Providers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        config?.api.geminiConfigured ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium text-slate-800">Google Gemini</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      config?.api.geminiConfigured
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {config?.api.geminiConfigured ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        config?.api.openaiConfigured ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium text-slate-800">OpenAI</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      config?.api.openaiConfigured
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {config?.api.openaiConfigured ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        config?.api.anthropicConfigured ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium text-slate-800">Anthropic Claude</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      config?.api.anthropicConfigured
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {config?.api.anthropicConfigured ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        config?.api.deepseekConfigured ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium text-slate-800">DeepSeek</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      config?.api.deepseekConfigured
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {config?.api.deepseekConfigured ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        config?.api.grokConfigured ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium text-slate-800">Grok (X.AI)</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      config?.api.grokConfigured
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {config?.api.grokConfigured ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>
                </div>

                {/* Other Services */}
                <div className="border-t border-slate-200 pt-3 mt-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Infrastructure Services</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          config?.api.e2bConfigured ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        <span className="font-medium text-slate-800">E2B Code Interpreter</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        config?.api.e2bConfigured
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {config?.api.e2bConfigured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          config?.api.mongodbConnected ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        <span className="font-medium text-slate-800">MongoDB Database</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        config?.api.mongodbConnected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {config?.api.mongodbConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>

                    {config?.api.weaviateConfigured !== undefined && (
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            config?.api.weaviateConfigured ? 'bg-emerald-500' : 'bg-red-500'
                          }`} />
                          <span className="font-medium text-slate-800">Weaviate Vector DB</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          config?.api.weaviateConfigured
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {config?.api.weaviateConfigured ? 'Configured' : 'Not Configured'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DATABASE SECTION */}
        {activeSection === 'database' && (
          <div className="space-y-6">
            {stats?.database ? (
              <>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Database size={20} className="text-purple-600" />
                    Database Statistics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-700">
                        {formatNumber(stats.database.collections)}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">Collections</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">
                        {formatBytes(stats.database.dataSize)}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">Data Size</p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <p className="text-2xl font-bold text-emerald-700">
                        {formatBytes(stats.database.storageSize)}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">Storage Size</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4">Database Content</h3>
                  <div className="space-y-4">
                    {Object.entries(stats.counts).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-800 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="font-bold text-slate-900">{formatNumber(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center py-12">
                <Database size={48} className="mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Database statistics unavailable</p>
              </div>
            )}
          </div>
        )}

        {/* SYSTEM LIMITS SECTION */}
        {activeSection === 'limits' && (config || comprehensiveData) && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Shield size={20} className="text-blue-600" />
                System Limits (Derived from Packages)
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-slate-800">System-Wide Maximum</span>
                    <span className="text-2xl font-bold text-blue-700">
                      {(() => {
                        const value = (config?.limits || comprehensiveData?.limits)?.maxProjectsPerUser;
                        if (value === -1 || value === '-1') return '∞ Unlimited';
                        return value ? `${value} Projects` : 'N/A';
                      })()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Highest maxProjects limit across all active packages. 
                    Actual limits vary by package - see breakdown below.
                  </p>
                </div>

                {(config?.limits?.packageLimits || comprehensiveData?.limits?.packageLimits) && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">Package Limits Breakdown</h4>
                    <div className="space-y-3">
                      {(config?.limits?.packageLimits || comprehensiveData?.limits?.packageLimits).map((pkgLimit: any, idx: number) => (
                        <div key={idx} className="p-4 bg-white rounded-lg border border-slate-200">
                          <h5 className="font-bold text-slate-800 mb-2">{pkgLimit.packageName}</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-slate-600 text-xs">Max Projects:</span>
                              <p className="font-bold text-slate-800">{pkgLimit.maxProjects === -1 ? '∞' : formatNumber(pkgLimit.maxProjects)}</p>
                            </div>
                            <div>
                              <span className="text-slate-600 text-xs">Max Agents:</span>
                              <p className="font-bold text-slate-800">{pkgLimit.maxAgents === -1 ? '∞' : formatNumber(pkgLimit.maxAgents)}</p>
                            </div>
                            <div>
                              <span className="text-slate-600 text-xs">Max Tasks:</span>
                              <p className="font-bold text-slate-800">{pkgLimit.maxTasks === -1 ? '∞' : formatNumber(pkgLimit.maxTasks)}</p>
                            </div>
                            <div>
                              <span className="text-slate-600 text-xs">Max Storage:</span>
                              <p className="font-bold text-slate-800">{pkgLimit.maxStorageGB === -1 ? '∞' : `${formatNumber(pkgLimit.maxStorageGB)} GB`}</p>
                            </div>
                            <div>
                              <span className="text-slate-600 text-xs">Max Team Members:</span>
                              <p className="font-bold text-slate-800">{pkgLimit.maxTeamMembers === -1 ? '∞' : formatNumber(pkgLimit.maxTeamMembers)}</p>
                            </div>
                            <div>
                              <span className="text-slate-600 text-xs">Max Budget:</span>
                              <p className="font-bold text-slate-800">{pkgLimit.maxMonthlyBudget === -1 ? '∞' : `$${formatNumber(pkgLimit.maxMonthlyBudget)}`}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys((config?.limits || comprehensiveData?.limits)?.maxUsersPerPlan || {}).length > 0 && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">Active Packages</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries((config?.limits || comprehensiveData?.limits)?.maxUsersPerPlan || {}).map(([plan, limit]) => (
                        <div key={plan} className="p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-600 mb-1">{plan}</p>
                          <p className="text-xl font-bold text-slate-800">
                            {limit === -1 ? '∞' : formatNumber(limit as number)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* USERS & ROLES SECTION */}
        {activeSection === 'users' && comprehensiveData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-80">Total Users</h3>
                  <Users size={20} className="opacity-80" />
                </div>
                <p className="text-4xl font-bold">{formatNumber(comprehensiveData.summary.totalUsers)}</p>
                <p className="text-sm opacity-80 mt-2">{formatNumber(comprehensiveData.summary.activeUsers)} active</p>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-80">Active (7d)</h3>
                  <Activity size={20} className="opacity-80" />
                </div>
                <p className="text-4xl font-bold">{formatNumber(comprehensiveData.summary.activeUsers7d)}</p>
                <p className="text-sm opacity-80 mt-2">{formatNumber(comprehensiveData.summary.usersLast30Days)} last 30d</p>
              </div>

              <div className="bg-gradient-to-br from-purple-600 to-pink-700 text-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-80">New Users</h3>
                  <TrendingUp size={20} className="opacity-80" />
                </div>
                <p className="text-4xl font-bold">{formatNumber(comprehensiveData.summary.usersLast30Days)}</p>
                <p className="text-sm opacity-80 mt-2">Last 30 days</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">Users by Plan</h3>
                <div className="space-y-3">
                  {Object.entries(comprehensiveData.breakdowns.usersByPlan).map(([plan, count]: [string, any]) => (
                    <div key={plan} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium text-slate-800">{plan || 'None'}</span>
                      <span className="font-bold text-slate-900">{formatNumber(count)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">Users by Role</h3>
                <div className="space-y-3">
                  {Object.entries(comprehensiveData.breakdowns.usersByRole).map(([role, count]: [string, any]) => (
                    <div key={role} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium text-slate-800 capitalize">{role}</span>
                      <span className="font-bold text-slate-900">{formatNumber(count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">Recent Users</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left text-slate-600 font-semibold">Name</th>
                      <th className="p-3 text-left text-slate-600 font-semibold">Email</th>
                      <th className="p-3 text-left text-slate-600 font-semibold">Plan</th>
                      <th className="p-3 text-left text-slate-600 font-semibold">Status</th>
                      <th className="p-3 text-left text-slate-600 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprehensiveData.recentActivity.users.map((user: any) => (
                      <tr key={user.id} className="border-b border-slate-100">
                        <td className="p-3 text-slate-800">{user.name}</td>
                        <td className="p-3 text-slate-600">{user.email}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">
                            {user.plan || 'None'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-xs">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS SECTION */}
        {activeSection === 'projects' && comprehensiveData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-600">Total Projects</h3>
                  <Folder size={20} className="text-slate-400" />
                </div>
                <p className="text-3xl font-bold text-slate-800">{formatNumber(comprehensiveData.summary.totalProjects)}</p>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-600">Active</h3>
                  <Activity size={20} className="text-emerald-400" />
                </div>
                <p className="text-3xl font-bold text-emerald-600">{formatNumber(comprehensiveData.summary.activeProjects)}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-600">Total Tasks</h3>
                  <FileText size={20} className="text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-blue-600">{formatNumber(comprehensiveData.summary.totalTasks)}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-600">Artifacts</h3>
                  <FileText size={20} className="text-purple-400" />
                </div>
                <p className="text-3xl font-bold text-purple-600">{formatNumber(comprehensiveData.summary.totalArtifacts)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">Projects by Phase</h3>
                <div className="space-y-3">
                  {Object.entries(comprehensiveData.breakdowns.projectsByPhase).map(([phase, count]: [string, any]) => (
                    <div key={phase} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium text-slate-800">{phase || 'None'}</span>
                      <span className="font-bold text-slate-900">{formatNumber(count)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">Projects by Methodology</h3>
                <div className="space-y-3">
                  {Object.entries(comprehensiveData.breakdowns.projectsByMethodology).map(([methodology, count]: [string, any]) => (
                    <div key={methodology} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium text-slate-800">{methodology || 'None'}</span>
                      <span className="font-bold text-slate-900">{formatNumber(count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">Recent Projects</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left text-slate-600 font-semibold">Name</th>
                      <th className="p-3 text-left text-slate-600 font-semibold">Phase</th>
                      <th className="p-3 text-left text-slate-600 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprehensiveData.recentActivity.projects.map((project: any) => (
                      <tr key={project.id} className="border-b border-slate-100">
                        <td className="p-3 text-slate-800 font-medium">{project.name}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-xs font-bold">
                            {project.phase || 'Unknown'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-xs">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PACKAGES SECTION */}
        {activeSection === 'packages' && comprehensiveData && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Package Management</p>
                <p>Full package management is available in the <strong>Packages</strong> tab of the Admin Dashboard. Use the System Limits tab to view package-derived limits.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">Active Packages Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {comprehensiveData.packages && comprehensiveData.packages.length > 0 ? (
                  comprehensiveData.packages.map((pkg: any) => (
                    <div key={pkg.id} className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border border-indigo-200">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-slate-800">{pkg.displayName}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          pkg.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {pkg.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Price:</span>
                          <span className="font-bold text-slate-800">
                            ${pkg.price}/{pkg.billingCycle === 'monthly' ? 'mo' : pkg.billingCycle === 'yearly' ? 'yr' : 'lifetime'}
                          </span>
                        </div>
                        {pkg.features && Array.isArray(pkg.features) && (
                          <div className="text-xs text-slate-600">
                            {pkg.features.length} features configured
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-full text-sm text-slate-500 text-center py-4">
                    No packages configured
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ENVIRONMENT VARIABLES SECTION */}
        {activeSection === 'environment' && (
          <div className="space-y-6">
            {/* Environment Switcher */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Settings size={20} className="text-blue-600" />
                System Environment
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Current Environment
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={envVarValues['NODE_ENV'] || config?.server.environment || 'development'}
                      onChange={(e) => {
                        setEnvVarValues({ ...envVarValues, 'NODE_ENV': e.target.value });
                        setEditingEnvVar('NODE_ENV');
                      }}
                      className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    >
                      <option value="development">Development</option>
                      <option value="staging">Pre-production (Staging)</option>
                      <option value="production">Production</option>
                    </select>
                    {envVarValues['NODE_ENV'] && envVarValues['NODE_ENV'] !== (config?.server.environment || 'development') && (
                      <span className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full font-medium">
                        ⚠️ Requires server restart
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Changing the environment will affect feature flags and system behavior. Server restart required for changes to take effect.
                  </p>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Environment Variables Management</p>
                <p>Edit system environment variables. Changes are saved to the <code className="bg-blue-100 px-1 rounded">.env</code> file.</p>
                <ul className="mt-2 text-xs space-y-1 list-disc list-inside">
                  <li><strong>API Keys:</strong> API keys (GEMINI_API_KEY, OPENAI_API_KEY, etc.) are now stored securely in the database and are <strong>not shown here</strong>. Manage them via <strong>Settings → API Keys</strong> in the Admin Console.</li>
                  <li>Some changes require server restart to take effect</li>
                  <li>Variables are organized by category for easier management</li>
                  <li>Use dropdowns for standardized values (environment, log level, etc.)</li>
                </ul>
              </div>
            </div>

            {envVars ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                      <Settings size={20} className="text-blue-600" />
                      Environment Variables
                    </h3>
                    <p className="text-xs text-slate-500">
                      {envVars.editable.length} editable variable{envVars.editable.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={handleSaveEnvironmentVariables}
                    disabled={savingEnv || Object.keys(envVarValues).length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingEnv ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>

                {/* Search and Filter */}
                <div className="mb-6 space-y-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search environment variables..."
                      value={envSearchTerm}
                      onChange={(e) => setEnvSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEnvCategoryFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        envCategoryFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setEnvCategoryFilter('server')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        envCategoryFilter === 'server'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Server Config
                    </button>
                    <button
                      onClick={() => setEnvCategoryFilter('llm')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        envCategoryFilter === 'llm'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      LLM Config
                    </button>
                    <button
                      onClick={() => setEnvCategoryFilter('database')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        envCategoryFilter === 'database'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Database
                    </button>
                    <button
                      onClick={() => setEnvCategoryFilter('other')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        envCategoryFilter === 'other'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Other
                    </button>
                  </div>
                </div>

                {/* Categorized Variables */}
                {(() => {
                  // Helper function to get dropdown options for a variable
                  const getDropdownOptions = (key: string): string[] | null => {
                    switch (key) {
                      case 'NODE_ENV':
                        return ['development', 'staging', 'production'];
                      case 'LOG_LEVEL':
                        return ['error', 'warn', 'info', 'debug'];
                      case 'CORS_CREDENTIALS':
                        return ['true', 'false'];
                      case 'ENABLE_MULTI_LLM':
                        return ['true', 'false'];
                      case 'DEFAULT_LLM_PROVIDER':
                        return ['gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'mistral', 'qwen', 'openrouter', 'groq', 'vertex', 'azure-openai'];
                      case 'LLM_ROUTING_STRATEGY':
                        return ['intelligent', 'cost', 'performance', 'quality'];
                      default:
                        return null;
                    }
                  };

                  // Helper function to check if variable should use dropdown
                  const shouldUseDropdown = (key: string): boolean => {
                    return getDropdownOptions(key) !== null;
                  };

                  // API keys that should be filtered out (managed via API Keys section)
                  const API_KEY_VARS = [
                    'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY',
                    'GROK_API_KEY', 'MISTRAL_API_KEY', 'QWEN_API_KEY', 'OPENROUTER_API_KEY',
                    'GROQ_API_KEY', 'VERTEX_API_KEY', 'AZURE_OPENAI_API_KEY', 'E2B_API_KEY',
                    'GOOGLE_SEARCH_API_KEY', 'WEAVIATE_API_KEY'
                  ];

                  // Categorize variables (API keys filtered out - now in database)
                  const categories: Record<string, string[]> = {
                    'server': ['NODE_ENV', 'PORT', 'FRONTEND_URL', 'LOG_LEVEL', 'CORS_ORIGINS', 'CORS_CREDENTIALS'],
                    'llm': ['ENABLE_MULTI_LLM', 'DEFAULT_LLM_PROVIDER', 'LLM_ROUTING_STRATEGY'],
                    'database': ['WEAVIATE_URL', 'WEAVIATE_CLASS_NAME'],
                    'other': []
                  };

                  // Get category for a variable
                  const getCategory = (key: string): string => {
                    for (const [cat, keys] of Object.entries(categories)) {
                      if (keys.includes(key)) return cat;
                    }
                    return 'other';
                  };

                  // Filter variables (exclude API keys - they're managed via API Keys section)
                  const filteredVars = envVars.editable.filter((key) => {
                    // Exclude API keys - they're managed via API Keys Management
                    if (API_KEY_VARS.includes(key)) return false;
                    
                    const matchesSearch = !envSearchTerm || 
                      key.toLowerCase().includes(envSearchTerm.toLowerCase()) || 
                      (envVars.variables[key]?.value || '').toLowerCase().includes(envSearchTerm.toLowerCase());
                    const matchesCategory = envCategoryFilter === 'all' || getCategory(key) === envCategoryFilter;
                    return matchesSearch && matchesCategory;
                  });

                  // Group by category
                  const groupedVars: Record<string, string[]> = {};
                  filteredVars.forEach(key => {
                    const cat = getCategory(key);
                    if (!groupedVars[cat]) groupedVars[cat] = [];
                    groupedVars[cat].push(key);
                  });

                  // Ensure all categories exist even if empty (for consistent display)
                  const allCategories = ['server', 'llm', 'database', 'other'];
                  allCategories.forEach(cat => {
                    if (!groupedVars[cat]) groupedVars[cat] = [];
                  });

                  const categoryLabels: Record<string, string> = {
                    'server': 'Server Configuration',
                    'llm': 'LLM Configuration',
                    'database': 'Database & Vector Store',
                    'other': 'Other'
                  };

                  return (
                    <div className="space-y-6">
                      {Object.entries(groupedVars)
                        .filter(([category, keys]) => {
                          // Show category if:
                          // 1. It has items, OR
                          // 2. It's the selected filter category, OR
                          // 3. Filter is set to 'all' and category has items (or is 'other' which might have items)
                          if (keys.length > 0) return true;
                          if (envCategoryFilter === category) return true;
                          if (envCategoryFilter === 'all') {
                            // For 'all' filter, only show categories that have items
                            return false;
                          }
                          return false;
                        })
                        .map(([category, keys]) => (
                        <div key={category} className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                              <Settings size={16} />
                              {categoryLabels[category]}
                              <span className="text-xs font-normal text-slate-500 ml-2">
                                ({keys.length})
                              </span>
                            </h4>
                          </div>
                          {keys.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                              {keys.map((key) => {
                              const varData = envVars.variables[key];
                              if (!varData) return null;
                              
                              const isEditing = editingEnvVar === key;
                              const currentValue = envVarValues[key] || '';
                              const hasChanges = currentValue && currentValue !== varData.value && !currentValue.startsWith('***');
                              const requiresRestart = key === 'NODE_ENV' || key === 'PORT' || key === 'MONGODB_URI' || key === 'JWT_SECRET';
                              
                              return (
                                <div key={key} className="p-4 hover:bg-slate-50 transition-colors">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <label className="text-sm font-bold text-slate-800">
                                          {key}
                                        </label>
                                        {key === 'DEFAULT_LLM_PROVIDER' && (
                                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium" title="Fallback provider preference when intelligent routing fails or when routing strategy is not 'intelligent'. With intelligent routing enabled, this is informational only.">
                                            Fallback Only
                                          </span>
                                        )}
                                        {varData.masked && (
                                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                            Masked
                                          </span>
                                        )}
                                        {requiresRestart && (
                                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                            Requires Restart
                                          </span>
                                        )}
                                      </div>
                                      {key === 'DEFAULT_LLM_PROVIDER' && (
                                        <p className="text-xs text-slate-500 mb-2 italic">
                                          ⓘ Fallback provider preference. With intelligent routing enabled, model selection is automatic. This setting only affects fallback behavior when routing fails.
                                        </p>
                                      )}
                                      
                                      {isEditing ? (
                                        <div className="space-y-2">
                                          {shouldUseDropdown(key) ? (
                                            <select
                                              value={currentValue || ''}
                                              onChange={(e) => setEnvVarValues({ ...envVarValues, [key]: e.target.value })}
                                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white"
                                            >
                                              {!currentValue && (
                                                <option value="">Select a value...</option>
                                              )}
                                              {getDropdownOptions(key)?.map((option) => (
                                                <option key={option} value={option}>
                                                  {option}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <input
                                              type={key === 'PORT' ? 'number' : (varData.masked || key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') ? 'password' : 'text')}
                                              value={currentValue}
                                              onChange={(e) => setEnvVarValues({ ...envVarValues, [key]: e.target.value })}
                                              placeholder={varData.masked ? 'Enter new value' : varData.value || 'Enter value'}
                                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                            />
                                          )}
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => {
                                                setEditingEnvVar(null);
                                                setEnvVarValues({ ...envVarValues, [key]: varData.masked ? '' : varData.value });
                                              }}
                                              className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                                            >
                                              Cancel
                                            </button>
                                            {hasChanges && (
                                              <span className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded font-medium">
                                                Unsaved changes
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono break-all">
                                            {varData.masked ? '***' + varData.value.slice(-4) : varData.value || '(not set)'}
                                          </code>
                                          <button
                                            onClick={() => {
                                              setEditingEnvVar(key);
                                              setEnvVarValues({ ...envVarValues, [key]: varData.masked ? '' : varData.value });
                                            }}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0"
                                          >
                                            <Edit size={14} />
                                            Edit
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-slate-400">
                              <Settings size={32} className="mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No variables in this category</p>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {filteredVars.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                          <Search size={48} className="mx-auto mb-4 text-slate-300 opacity-50" />
                          <p className="font-medium">No variables found</p>
                          <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center py-12">
                <Loader2 size={48} className="mx-auto mb-4 text-slate-300 animate-spin" />
                <p className="text-slate-500">Loading environment variables...</p>
              </div>
            )}
          </div>
        )}

        {/* LLM USAGE SECTION */}
        {activeSection === 'llm-usage' && comprehensiveData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-yellow-600 to-orange-700 text-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-80">Calls Today</h3>
                  <Activity size={20} className="opacity-80" />
                </div>
                <p className="text-4xl font-bold">{formatNumber(comprehensiveData.llmUsage.today.calls)}</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-80">Tokens Today</h3>
                  <FileText size={20} className="opacity-80" />
                </div>
                <p className="text-4xl font-bold">{formatNumber(comprehensiveData.llmUsage.today.tokens)}</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-80">Cost Today</h3>
                  <TrendingUp size={20} className="opacity-80" />
                </div>
                <p className="text-4xl font-bold">${comprehensiveData.llmUsage.today.cost.toFixed(4)}</p>
              </div>
            </div>

            {Object.keys(comprehensiveData.llmUsage.today.byProvider || {}).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">Usage by Provider</h3>
                <div className="space-y-3">
                  {Object.entries(comprehensiveData.llmUsage.today.byProvider).map(([provider, data]: [string, any]) => (
                    <div key={provider} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-800 capitalize">{provider}</span>
                        <span className="text-sm font-medium text-slate-600">
                          ${((data.cost || 0) / (data.calls || 1)).toFixed(4)} per call
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Calls:</span>
                          <span className="font-bold text-slate-800 ml-2">{formatNumber(data.calls || 0)}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Tokens:</span>
                          <span className="font-bold text-slate-800 ml-2">{formatNumber(data.tokens || 0)}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Cost:</span>
                          <span className="font-bold text-slate-800 ml-2">${(data.cost || 0).toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;

