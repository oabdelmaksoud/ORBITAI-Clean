/**
 * End User LLM Router Settings Component
 * Admin console interface for managing LLM router configuration for end-user features
 */

import React, { useState, useEffect } from 'react';
import {
  Settings, Route, DollarSign, TrendingUp, Users, BarChart3,
  Plus, Edit2, Trash2, Save, X, Play, RefreshCw, AlertTriangle,
  CheckCircle, Info, ChevronDown, ChevronUp, GripVertical, Copy, Zap,
  Sparkles, MessageSquare, Settings2, Activity, BarChart, LayoutGrid, List, Filter, FileText, Sliders,
  FlaskConical, Gauge, Shield, GitBranch
} from 'lucide-react';
import AIRuleConfigurator from './AIRuleConfigurator';
import RouterDashboard from './RouterDashboard';
import RouterABTestManager from './RouterABTestManager';
import CostForecast from './CostForecast';
import QuotaManager from './QuotaManager';
import RoutingExplainer from './RoutingExplainer';
import { showAlert, showConfirm } from '../utils/browserUtils';
import { getLLMModels, LLMModel } from '../services/adminApiExtended';
import {
  getRouterSettings,
  getGlobalSettings,
  updateGlobalSettings,
  getUserSettings,
  updateUserSettings,
  resetUserSettings,
  getRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  testRoutingRule,
  getRoutingAnalytics,
  RouterSettings,
  RoutingRule,
  RoutingAnalytics
} from '../services/adminLLMRouterApi';

interface LLMRouterSettingsProps {
  token?: string;
}

const LLMRouterSettings: React.FC<LLMRouterSettingsProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'ai-config' | 'users' | 'analytics' | 'dashboard' | 'ab-tests' | 'forecast' | 'quotas' | 'explainer'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for global settings
  const [globalSettings, setGlobalSettings] = useState<RouterSettings | null>(null);

  // State for routing rules
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);

  // State for user overrides
  const [userSettings, setUserSettings] = useState<RouterSettings[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // State for analytics
  const [analytics, setAnalytics] = useState<RoutingAnalytics | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsData, rulesData, analyticsData] = await Promise.all([
        getRouterSettings(token),
        getRoutingRules(token, 'end-user'), // Only load End User Router rules
        getRoutingAnalytics(token)
      ]);

      setGlobalSettings(settingsData.global);
      setUserSettings(settingsData.users);
      setRules(rulesData);
      setAnalytics(analyticsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load router settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGlobalSettings = async () => {
    if (!globalSettings) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await updateGlobalSettings(globalSettings, token);
      setSuccess('Global settings saved successfully');

      // Reload to get updated data
      setTimeout(() => {
        setSuccess(null);
        loadData();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save global settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRule = async (rule: RoutingRule): Promise<RoutingRule> => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Ensure routerType is set to 'end-user' for End User Router
      const ruleWithRouterType: RoutingRule = {
        ...rule,
        routerType: 'end-user'
      };

      let savedRule: RoutingRule;
      if (rule._id) {
        savedRule = await updateRoutingRule(rule._id, ruleWithRouterType, token);
        setSuccess('Routing rule updated successfully');
      } else {
        savedRule = await createRoutingRule(ruleWithRouterType, token);
        setSuccess('Routing rule created successfully');
      }

      // Update local rules state immediately (don't reload all data)
      setRules(prevRules => {
        if (rule._id) {
          return prevRules.map(r => r._id === rule._id ? savedRule : r);
        } else {
          return [...prevRules, savedRule];
        }
      });

      setShowRuleForm(false);
      setEditingRule(null);
      setTimeout(() => {
        setSuccess(null);
      }, 2000);

      return savedRule;
    } catch (err: any) {
      setError(err.message || 'Failed to save routing rule');
      throw err; // Re-throw so caller can handle
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    // Don't show confirmation for bulk deletions during AI optimize
    const shouldConfirm = true; // Can be made configurable if needed

    if (shouldConfirm && !(await showConfirm('Are you sure you want to delete this routing rule?'))) return;

    try {
      setError(null);
      await deleteRoutingRule(ruleId, token);

      // Update local rules state immediately (don't reload all data)
      setRules(prevRules => prevRules.filter(r => r._id !== ruleId));

      if (shouldConfirm) {
        setSuccess('Routing rule deleted successfully');
        setTimeout(() => {
          setSuccess(null);
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete routing rule');
    }
  };

  const handleTestRule = async (rule: RoutingRule) => {
    try {
      setError(null);
      const sampleTask = {
        agentRole: 'Orchestrator',
        taskType: 'chat',
        complexity: 'simple' as const,
        requestType: 'chat',
        estimatedTokens: 1000
      };

      const result = await testRoutingRule(rule, sampleTask, token);
      alert(`Rule Test Result: ${result.matches ? 'MATCHES' : 'NO MATCH'}\nReason: ${result.reason}`);
    } catch (err: any) {
      setError(err.message || 'Failed to test routing rule');
    }
  };

  const handleResetUserSettings = async (userId: string) => {
    if (!(await showConfirm('Reset this user\'s router settings to global defaults?'))) return;

    try {
      setError(null);
      await resetUserSettings(userId, token);
      setSuccess('User settings reset successfully');
      setTimeout(() => {
        setSuccess(null);
        loadData();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset user settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading router settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">End User Router Settings</h2>
          <p className="text-slate-500 mt-1">
            Configure intelligent routing for end-user features • Cost controls • Model priorities
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 rounded-lg text-slate-700 transition-colors border border-slate-200 shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Sub-tabs - Matching Models tab style */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-4">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Gauge },
            { id: 'ai-config', label: 'AI Config', icon: Sparkles },
            { id: 'ab-tests', label: 'A/B Tests', icon: FlaskConical },
            { id: 'forecast', label: 'Forecast', icon: TrendingUp },
            { id: 'quotas', label: 'Quotas', icon: Shield },
            { id: 'explainer', label: 'Explainer', icon: GitBranch },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`
                flex items-center gap-2 py-2 px-3 border-b-2 font-medium text-sm transition-colors
                ${activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        {activeTab === 'dashboard' && (
          <RouterDashboard token={token} routerType="enduser" />
        )}

        {activeTab === 'ai-config' && (
          <AIRuleConfigurator
            rules={rules}
            editingRule={editingRule}
            onEditRule={setEditingRule}
            onSaveRule={handleSaveRule}
            onDeleteRule={handleDeleteRule}
            onTestRule={handleTestRule}
            onRulesChange={setRules}
            token={token}
          />
        )}

        {activeTab === 'ab-tests' && (
          <RouterABTestManager token={token} />
        )}

        {activeTab === 'forecast' && (
          <CostForecast token={token} />
        )}

        {activeTab === 'quotas' && (
          <QuotaManager token={token} />
        )}

        {activeTab === 'explainer' && (
          <RoutingExplainer token={token} />
        )}

        {activeTab === 'users' && (
          <UserOverridesTab
            userSettings={userSettings}
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
            onResetUser={handleResetUserSettings}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab analytics={analytics} />
        )}
      </div>
    </div>
  );
};

// All sub-components use consistent light theme

// Global Settings Tab Component
const GlobalSettingsTab: React.FC<{
  settings: RouterSettings | null;
  onSettingsChange: (settings: RouterSettings | null) => void;
  onSave: () => void;
  saving: boolean;
}> = ({ settings, onSettingsChange, onSave, saving }) => {
  if (!settings) {
    return <div className="text-slate-500">No global settings found. Creating defaults...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">General Settings</h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => onSettingsChange({ ...settings, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Enable Router</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableIntelligentRouting}
              onChange={(e) => onSettingsChange({ ...settings, enableIntelligentRouting: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Enable Intelligent Routing</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableCostOptimization}
              onChange={(e) => onSettingsChange({ ...settings, enableCostOptimization: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Enable Cost Optimization</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enablePerformanceOptimization}
              onChange={(e) => onSettingsChange({ ...settings, enablePerformanceOptimization: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Enable Performance Optimization</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// Configuration Tab Component (combines Cost Controls, Model Priorities, and Performance Tuning)
const ConfigurationTab: React.FC<{
  settings: RouterSettings | null;
  onSettingsChange: (settings: RouterSettings | null) => void;
  onSave: () => void;
  saving: boolean;
  token?: string;
}> = ({ settings, onSettingsChange, onSave, saving, token }) => {
  const [configSection, setConfigSection] = useState<'cost' | 'priorities' | 'performance'>('cost');

  if (!settings) return null;

  const costControls = settings.costControls || {
    costPreference: 'balanced',
    globalBudget: {},
    alertThresholds: {}
  };

  const performanceTuning = settings.performanceTuning || {
    latencyWeight: 0.33,
    costWeight: 0.33,
    qualityWeight: 0.34,
    enableCaching: true
  };

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-4">
          {[
            { id: 'cost', label: 'Cost Controls', icon: DollarSign },
            { id: 'priorities', label: 'Model Priorities', icon: TrendingUp },
            { id: 'performance', label: 'Performance Tuning', icon: Zap }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setConfigSection(id as any)}
              className={`
                flex items-center gap-2 py-2 px-3 border-b-2 font-medium text-sm transition-colors
                ${configSection === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Cost Controls Section */}
      {configSection === 'cost' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Cost Controls</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Limit ($)</label>
              <input
                type="number"
                value={costControls.globalBudget?.monthlyLimit || ''}
                onChange={(e) => onSettingsChange({
                  ...settings,
                  costControls: {
                    ...costControls,
                    globalBudget: {
                      ...costControls.globalBudget,
                      monthlyLimit: parseFloat(e.target.value) || undefined
                    }
                  }
                })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily Limit ($)</label>
              <input
                type="number"
                value={costControls.globalBudget?.dailyLimit || ''}
                onChange={(e) => onSettingsChange({
                  ...settings,
                  costControls: {
                    ...costControls,
                    globalBudget: {
                      ...costControls.globalBudget,
                      dailyLimit: parseFloat(e.target.value) || undefined
                    }
                  }
                })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Per-Request Limit ($)</label>
              <input
                type="number"
                value={costControls.globalBudget?.perRequestLimit || ''}
                onChange={(e) => onSettingsChange({
                  ...settings,
                  costControls: {
                    ...costControls,
                    globalBudget: {
                      ...costControls.globalBudget,
                      perRequestLimit: parseFloat(e.target.value) || undefined
                    }
                  }
                })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Default Cost Preference</label>
            <select
              value={costControls.costPreference}
              onChange={(e) => onSettingsChange({
                ...settings,
                costControls: {
                  ...costControls,
                  costPreference: e.target.value as any
                }
              })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low Cost</option>
              <option value="balanced">Balanced</option>
              <option value="quality">Quality</option>
            </select>
          </div>
        </div>
      )}

      {/* Model Priorities Section */}
      {configSection === 'priorities' && (
        <ModelPrioritiesSection
          settings={settings}
          onSettingsChange={onSettingsChange}
          token={token}
        />
      )}

      {/* Performance Tuning Section */}
      {configSection === 'performance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Performance Tuning</h3>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Latency Weight: <span className="text-blue-600">{performanceTuning.latencyWeight.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={performanceTuning.latencyWeight}
                onChange={(e) => {
                  const latencyWeight = parseFloat(e.target.value);
                  const remaining = 1 - latencyWeight;
                  const costWeight = remaining * (performanceTuning.costWeight / (performanceTuning.costWeight + performanceTuning.qualityWeight));
                  const qualityWeight = remaining - costWeight;
                  onSettingsChange({
                    ...settings,
                    performanceTuning: {
                      ...performanceTuning,
                      latencyWeight,
                      costWeight,
                      qualityWeight
                    }
                  });
                }}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Cost Weight: <span className="text-emerald-600">{performanceTuning.costWeight.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={performanceTuning.costWeight}
                onChange={(e) => {
                  const costWeight = parseFloat(e.target.value);
                  const remaining = 1 - costWeight;
                  const latencyWeight = remaining * (performanceTuning.latencyWeight / (performanceTuning.latencyWeight + performanceTuning.qualityWeight));
                  const qualityWeight = remaining - latencyWeight;
                  onSettingsChange({
                    ...settings,
                    performanceTuning: {
                      ...performanceTuning,
                      latencyWeight,
                      costWeight,
                      qualityWeight
                    }
                  });
                }}
                className="w-full accent-emerald-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quality Weight: <span className="text-purple-600">{performanceTuning.qualityWeight.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={performanceTuning.qualityWeight}
                onChange={(e) => {
                  const qualityWeight = parseFloat(e.target.value);
                  const remaining = 1 - qualityWeight;
                  const latencyWeight = remaining * (performanceTuning.latencyWeight / (performanceTuning.latencyWeight + performanceTuning.costWeight));
                  const costWeight = remaining - latencyWeight;
                  onSettingsChange({
                    ...settings,
                    performanceTuning: {
                      ...performanceTuning,
                      latencyWeight,
                      costWeight,
                      qualityWeight
                    }
                  });
                }}
                className="w-full accent-purple-600"
              />
            </div>

            <div className="pt-4 border-t border-slate-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={performanceTuning.enableCaching}
                  onChange={(e) => onSettingsChange({
                    ...settings,
                    performanceTuning: {
                      enableCaching: e.target.checked
                    }
                  })}
                  className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Enable Response Caching</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
      </div>
    </div>
  );
};

// Cost Controls Tab Component
const CostControlsTab: React.FC<{
  settings: RouterSettings | null;
  onSettingsChange: (settings: RouterSettings | null) => void;
  onSave: () => void;
  saving: boolean;
}> = ({ settings, onSettingsChange, onSave, saving }) => {
  if (!settings) return null;

  const costControls = settings.costControls || {
    costPreference: 'balanced',
    globalBudget: {},
    alertThresholds: {}
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Global Budget Limits</h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Limit ($)</label>
            <input
              type="number"
              value={costControls.globalBudget?.monthlyLimit || ''}
              onChange={(e) => onSettingsChange({
                ...settings,
                costControls: {
                  ...costControls,
                  globalBudget: {
                    ...costControls.globalBudget,
                    monthlyLimit: parseFloat(e.target.value) || undefined
                  }
                }
              })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Daily Limit ($)</label>
            <input
              type="number"
              value={costControls.globalBudget?.dailyLimit || ''}
              onChange={(e) => onSettingsChange({
                ...settings,
                costControls: {
                  ...costControls,
                  globalBudget: {
                    ...costControls.globalBudget,
                    dailyLimit: parseFloat(e.target.value) || undefined
                  }
                }
              })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Per-Request Limit ($)</label>
            <input
              type="number"
              value={costControls.globalBudget?.perRequestLimit || ''}
              onChange={(e) => onSettingsChange({
                ...settings,
                costControls: {
                  ...costControls,
                  globalBudget: {
                    ...costControls.globalBudget,
                    perRequestLimit: parseFloat(e.target.value) || undefined
                  }
                }
              })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Default Cost Preference</label>
          <select
            value={costControls.costPreference}
            onChange={(e) => onSettingsChange({
              ...settings,
              costControls: {
                ...costControls,
                costPreference: e.target.value as any
              }
            })}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low">Low Cost</option>
            <option value="balanced">Balanced</option>
            <option value="quality">Quality</option>
          </select>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Cost Controls
          </button>
        </div>
      </div>
    </div>
  );
};

// Model Priorities Tab Component
const ModelPrioritiesTab: React.FC<{
  settings: RouterSettings | null;
  onSettingsChange: (settings: RouterSettings | null) => void;
  onSave: () => void;
  saving: boolean;
}> = ({ settings, onSettingsChange, onSave, saving }) => {
  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Model Priorities</h3>
        <p className="text-sm text-slate-500 mb-4">
          Configure provider and model rankings. Lower numbers = higher priority.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Priorities
          </button>
        </div>
      </div>
    </div>
  );
};

// Performance Tuning Tab Component
const PerformanceTuningTab: React.FC<{
  settings: RouterSettings | null;
  onSettingsChange: (settings: RouterSettings | null) => void;
  onSave: () => void;
  saving: boolean;
}> = ({ settings, onSettingsChange, onSave, saving }) => {
  if (!settings) return null;

  const performanceTuning = settings.performanceTuning || {
    latencyWeight: 0.33,
    costWeight: 0.33,
    qualityWeight: 0.34,
    enableCaching: true
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Performance Tuning</h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Latency Weight: <span className="text-blue-600">{performanceTuning.latencyWeight.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={performanceTuning.latencyWeight}
              onChange={(e) => {
                const latencyWeight = parseFloat(e.target.value);
                const remaining = 1 - latencyWeight;
                const costWeight = remaining * (performanceTuning.costWeight / (performanceTuning.costWeight + performanceTuning.qualityWeight));
                const qualityWeight = remaining - costWeight;
                onSettingsChange({
                  ...settings,
                  performanceTuning: {
                    ...performanceTuning,
                    latencyWeight,
                    costWeight,
                    qualityWeight
                  }
                });
              }}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Cost Weight: <span className="text-emerald-600">{performanceTuning.costWeight.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={performanceTuning.costWeight}
              onChange={(e) => {
                const costWeight = parseFloat(e.target.value);
                const remaining = 1 - costWeight;
                const latencyWeight = remaining * (performanceTuning.latencyWeight / (performanceTuning.latencyWeight + performanceTuning.qualityWeight));
                const qualityWeight = remaining - latencyWeight;
                onSettingsChange({
                  ...settings,
                  performanceTuning: {
                    ...performanceTuning,
                    latencyWeight,
                    costWeight,
                    qualityWeight
                  }
                });
              }}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quality Weight: <span className="text-purple-600">{performanceTuning.qualityWeight.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={performanceTuning.qualityWeight}
              onChange={(e) => {
                const qualityWeight = parseFloat(e.target.value);
                const remaining = 1 - qualityWeight;
                const latencyWeight = remaining * (performanceTuning.latencyWeight / (performanceTuning.latencyWeight + performanceTuning.costWeight));
                const costWeight = remaining - latencyWeight;
                onSettingsChange({
                  ...settings,
                  performanceTuning: {
                    ...performanceTuning,
                    latencyWeight,
                    costWeight,
                    qualityWeight
                  }
                });
              }}
              className="w-full accent-purple-600"
            />
          </div>

          <div className="pt-4 border-t border-slate-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={performanceTuning.enableCaching}
                onChange={(e) => onSettingsChange({
                  ...settings,
                  performanceTuning: {
                    ...performanceTuning,
                    enableCaching: e.target.checked
                  }
                })}
                className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Enable Response Caching</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Performance Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// User Overrides Tab Component
const UserOverridesTab: React.FC<{
  userSettings: RouterSettings[];
  selectedUserId: string | null;
  onSelectUser: (userId: string | null) => void;
  onResetUser: (userId: string) => void;
}> = ({ userSettings, selectedUserId, onSelectUser, onResetUser }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">User-Specific Overrides</h3>

      {userSettings.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p>No user-specific overrides configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {userSettings.map((userSetting) => (
            <div key={userSetting._id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">User ID: {userSetting.userId}</p>
                  <p className="text-sm text-slate-500">
                    {userSetting.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <button
                  onClick={() => userSetting.userId && onResetUser(userSetting.userId)}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Analytics Tab Component
const AnalyticsTab: React.FC<{
  analytics: RoutingAnalytics | null;
}> = ({ analytics }) => {
  if (!analytics) {
    return <div className="text-slate-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-800">Routing Analytics</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total Rules</p>
          <p className="text-2xl font-bold text-slate-800">{analytics.totalRules}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Enabled Rules</p>
          <p className="text-2xl font-bold text-emerald-600">{analytics.enabledRules}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">User Overrides</p>
          <p className="text-2xl font-bold text-blue-600">{analytics.userOverrides}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Router Status</p>
          <p className="text-lg font-semibold text-slate-800">
            {analytics.globalSettingsEnabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h4 className="text-md font-semibold text-slate-800 mb-4">Feature Status</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Intelligent Routing</span>
            <span className={analytics.intelligentRoutingEnabled ? 'text-emerald-600' : 'text-slate-400'}>
              {analytics.intelligentRoutingEnabled ? '✓ Enabled' : '✗ Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Cost Optimization</span>
            <span className={analytics.costOptimizationEnabled ? 'text-emerald-600' : 'text-slate-400'}>
              {analytics.costOptimizationEnabled ? '✓ Enabled' : '✗ Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Performance Optimization</span>
            <span className={analytics.performanceOptimizationEnabled ? 'text-emerald-600' : 'text-slate-400'}>
              {analytics.performanceOptimizationEnabled ? '✓ Enabled' : '✗ Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Model Priorities Section Component
const ModelPrioritiesSection: React.FC<{
  settings: RouterSettings | null;
  onSettingsChange: (settings: RouterSettings | null) => void;
  token?: string;
}> = ({ settings, onSettingsChange, token }) => {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'providers' | 'models' | 'taskTypes' | 'agentRoles'>('providers');

  const modelPriorities = settings?.modelPriorities || {
    providerRankings: {},
    modelRankings: {},
    taskTypePreferences: {},
    agentRolePreferences: {}
  };

  const taskTypes: string[] = [
    'chat', 'conversation', 'prompt-enhancement', 'project-preview',
    'code-generation', 'structured-output', 'documentation', 'analysis',
    'creative', 'long-context', 'writing', 'simple-tasks'
  ];

  const agentRoles: string[] = [
    'Orchestrator', 'Requirements Agent', 'UI/UX Designer', 'QA/Audit Agent',
    'Design/Architecture Agent', 'Test Requirements Engineer', 'Implementation Agent',
    'Integration Agent', 'Test Agent', 'Remediation/Bug Agent'
  ];

  const providers = ['gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'mistral', 'qwen', 'openrouter', 'groq', 'vertex', 'azure'];

  useEffect(() => {
    loadModels();
  }, [token]);

  const loadModels = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getLLMModels(token);
      setModels(data.models.filter(m => m.status === 'active'));
    } catch (err: any) {
      showAlert(`Failed to load models: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateProviderRanking = (provider: string, ranking: number) => {
    if (!settings) return;
    onSettingsChange({
      ...settings,
      modelPriorities: {
        ...modelPriorities,
        providerRankings: {
          ...modelPriorities.providerRankings,
          [provider]: ranking
        }
      }
    });
  };

  const updateModelRanking = (modelId: string, ranking: number) => {
    if (!settings) return;
    onSettingsChange({
      ...settings,
      modelPriorities: {
        ...modelPriorities,
        modelRankings: {
          ...modelPriorities.modelRankings,
          [modelId]: ranking
        }
      }
    });
  };

  const updateTaskTypePreference = (taskType: string, preferredModels: string[]) => {
    if (!settings) return;
    onSettingsChange({
      ...settings,
      modelPriorities: {
        ...modelPriorities,
        taskTypePreferences: {
          ...modelPriorities.taskTypePreferences,
          [taskType]: preferredModels
        }
      }
    });
  };

  const updateAgentRolePreference = (agentRole: string, preferredModels: string[]) => {
    if (!settings) return;
    onSettingsChange({
      ...settings,
      modelPriorities: {
        ...modelPriorities,
        agentRolePreferences: {
          ...modelPriorities.agentRolePreferences,
          [agentRole]: preferredModels
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Model Priorities</h3>
      <p className="text-sm text-slate-500 mb-4">
        Configure provider and model rankings. Lower numbers = higher priority.
      </p>

      {/* Sub-tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {[
            { id: 'providers', label: 'Provider Rankings', icon: TrendingUp },
            { id: 'models', label: 'Model Rankings', icon: BarChart3 },
            { id: 'taskTypes', label: 'Task Type Preferences', icon: FileText },
            { id: 'agentRoles', label: 'Agent Role Preferences', icon: Users }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`
                flex items-center gap-2 py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                ${activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Provider Rankings */}
      {activeTab === 'providers' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 mb-4">
            Set priority rankings for each provider. Lower numbers = higher priority (e.g., 1 = highest priority).
          </p>
          <div className="space-y-3">
            {providers.map((provider) => (
              <div key={provider} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700 capitalize">
                    {provider === 'openai_compatible' ? 'OpenAI Compatible' : provider}
                  </label>
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={modelPriorities.providerRankings?.[provider] || ''}
                    onChange={(e) => {
                      const ranking = parseInt(e.target.value) || undefined;
                      updateProviderRanking(provider, ranking || 999);
                    }}
                    placeholder="Priority"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Rankings */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 mb-4">
            Set priority rankings for individual models. Lower numbers = higher priority.
          </p>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {models.map((model) => (
              <div key={model.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{model.name}</div>
                  <div className="text-xs text-slate-500">{model.provider} • {model.modelIdentifier}</div>
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={modelPriorities.modelRankings?.[model.id] || ''}
                    onChange={(e) => {
                      const ranking = parseInt(e.target.value) || undefined;
                      updateModelRanking(model.id, ranking || 999);
                    }}
                    placeholder="Priority"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Type Preferences */}
      {activeTab === 'taskTypes' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500 mb-4">
            Select preferred models for each task type. Models are prioritized in the order they appear below.
          </p>
          {taskTypes.map((taskType) => {
            const preferredModels = modelPriorities.taskTypePreferences?.[taskType] || [];
            const availableModels = models.filter(m => !preferredModels.includes(m.id));

            return (
              <div key={taskType} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <label className="block text-sm font-medium text-slate-700 mb-3 capitalize">
                  {taskType.replace(/-/g, ' ')}
                </label>

                {/* Selected Models (in priority order) */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-slate-500 mb-2">Preferred Models (in order):</div>
                  {preferredModels.length === 0 ? (
                    <div className="text-sm text-slate-400 italic py-2">No models selected</div>
                  ) : (
                    <div className="space-y-2">
                      {preferredModels.map((modelId, index) => {
                        const model = models.find(m => m.id === modelId);
                        if (!model) return null;
                        return (
                          <div key={modelId} className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-800">{model.name}</div>
                              <div className="text-xs text-slate-500">{model.provider}</div>
                            </div>
                            <button
                              onClick={() => {
                                const updated = preferredModels.filter(id => id !== modelId);
                                updateTaskTypePreference(taskType, updated);
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            {index > 0 && (
                              <button
                                onClick={() => {
                                  const updated = [...preferredModels];
                                  [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
                                  updateTaskTypePreference(taskType, updated);
                                }}
                                className="p-1 text-slate-500 hover:bg-slate-200 rounded transition-colors"
                                title="Move up"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                            )}
                            {index < preferredModels.length - 1 && (
                              <button
                                onClick={() => {
                                  const updated = [...preferredModels];
                                  [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                                  updateTaskTypePreference(taskType, updated);
                                }}
                                className="p-1 text-slate-500 hover:bg-slate-200 rounded transition-colors"
                                title="Move down"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Available Models */}
                {availableModels.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Add Model:</div>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          updateTaskTypePreference(taskType, [...preferredModels, e.target.value]);
                          // Reset select by setting value to empty
                          setTimeout(() => {
                            (e.target as HTMLSelectElement).value = '';
                          }, 0);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a model to add...</option>
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({model.provider})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Role Preferences */}
      {activeTab === 'agentRoles' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500 mb-4">
            Select preferred models for each agent role. Models are prioritized in the order they appear below.
          </p>
          {agentRoles.map((agentRole) => {
            const preferredModels = modelPriorities.agentRolePreferences?.[agentRole] || [];
            const availableModels = models.filter(m => !preferredModels.includes(m.id));

            return (
              <div key={agentRole} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  {agentRole}
                </label>

                {/* Selected Models (in priority order) */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-slate-500 mb-2">Preferred Models (in order):</div>
                  {preferredModels.length === 0 ? (
                    <div className="text-sm text-slate-400 italic py-2">No models selected</div>
                  ) : (
                    <div className="space-y-2">
                      {preferredModels.map((modelId, index) => {
                        const model = models.find(m => m.id === modelId);
                        if (!model) return null;
                        return (
                          <div key={modelId} className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-800">{model.name}</div>
                              <div className="text-xs text-slate-500">{model.provider}</div>
                            </div>
                            <button
                              onClick={() => {
                                const updated = preferredModels.filter(id => id !== modelId);
                                updateAgentRolePreference(agentRole, updated);
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            {index > 0 && (
                              <button
                                onClick={() => {
                                  const updated = [...preferredModels];
                                  [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
                                  updateAgentRolePreference(agentRole, updated);
                                }}
                                className="p-1 text-slate-500 hover:bg-slate-200 rounded transition-colors"
                                title="Move up"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                            )}
                            {index < preferredModels.length - 1 && (
                              <button
                                onClick={() => {
                                  const updated = [...preferredModels];
                                  [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                                  updateAgentRolePreference(agentRole, updated);
                                }}
                                className="p-1 text-slate-500 hover:bg-slate-200 rounded transition-colors"
                                title="Move down"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Available Models */}
                {availableModels.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Add Model:</div>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          updateAgentRolePreference(agentRole, [...preferredModels, e.target.value]);
                          // Reset select by setting value to empty
                          setTimeout(() => {
                            (e.target as HTMLSelectElement).value = '';
                          }, 0);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a model to add...</option>
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({model.provider})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LLMRouterSettings;
