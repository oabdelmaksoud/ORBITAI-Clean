/**
 * Internal Router Settings Component
 * Admin console interface for managing internal/system task routing configuration
 * Design consistent with LLMModelManagement
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, BarChart3,
  X, RefreshCw, AlertTriangle,
  CheckCircle, Cpu, Clock,
  Activity, History, Sparkles, Loader2,
  Gauge, FlaskConical, Shield, GitBranch, Users
} from 'lucide-react';
import { showConfirm } from '../utils/browserUtils';
import InternalAIRuleConfigurator from './InternalAIRuleConfigurator';
import RouterDashboard from './RouterDashboard';
import RouterABTestManager from './RouterABTestManager';
import CostForecast from './CostForecast';
import QuotaManager from './QuotaManager';
import RoutingExplainer from './RoutingExplainer';
import {
  getInternalRouterConfig,
  updateInternalRouterConfig,
  getRoutingStatistics,
  getRoutingHistory,
  InternalRoutingConfig,
  RoutingStatistics,
  RoutingHistoryItem
} from '../services/adminInternalRouterApi';

interface InternalRouterSettingsProps {
  token?: string;
}

const InternalRouterSettings: React.FC<InternalRouterSettingsProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'ai-config' | 'users' | 'analytics' | 'dashboard' | 'ab-tests' | 'forecast' | 'quotas' | 'explainer'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for configuration
  const [config, setConfig] = useState<InternalRoutingConfig | null>(null);
  
  // State for statistics
  const [statistics, setStatistics] = useState<RoutingStatistics | null>(null);
  const [statsTimeRange, setStatsTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  
  // State for history
  const [history, setHistory] = useState<RoutingHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadStatistics();
      loadHistory();
    }
  }, [activeTab, statsTimeRange, historyPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getInternalRouterConfig(token);
      setConfig(data.config);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const days = statsTimeRange === '7d' ? 7 : statsTimeRange === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const data = await getRoutingStatistics(startDate, endDate, token);
      setStatistics(data.statistics);
    } catch (err: any) {
      setError(err.message || 'Failed to load statistics');
    }
  };

  const loadHistory = async () => {
    try {
      const data = await getRoutingHistory({ page: historyPage, limit: 20 }, token);
      setHistory(data.history);
      setHistoryTotal(data.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      await updateInternalRouterConfig(config, token);
      setSuccess('Configuration saved successfully');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Internal Router Settings</h2>
          <p className="text-slate-500 mt-1">
            AI-powered routing for internal/system tasks • Cost optimization
          </p>
        </div>
        
        {/* Action Buttons */}
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
          <RouterDashboard token={token} routerType="internal" />
        )}

        {activeTab === 'ai-config' && config && (
          <InternalAIRuleConfigurator
            token={token}
            onConfigChange={(newConfig) => {
              setConfig(newConfig);
              setSuccess('Configuration updated by AI optimizer');
              setTimeout(() => setSuccess(null), 3000);
            }}
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
          <UserOverridesTab />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            statistics={statistics}
            history={history}
            historyPage={historyPage}
            historyTotal={historyTotal}
            statsTimeRange={statsTimeRange}
            setStatsTimeRange={setStatsTimeRange}
            setHistoryPage={setHistoryPage}
          />
        )}
      </div>
    </div>
  );
};

// User Overrides Tab Component (Internal Router)
const UserOverridesTab: React.FC = () => {
  return (
    <div className="text-center py-12 text-slate-500">
      <Users className="w-12 h-12 mx-auto mb-4 text-slate-400" />
      <p className="text-lg font-medium mb-2">User Overrides</p>
      <p className="text-sm">User-specific overrides are not currently supported for internal routing.</p>
      <p className="text-sm mt-2">Internal routing uses global configuration and task/context overrides only.</p>
    </div>
  );
};

// Analytics Tab Component (Internal Router)
const AnalyticsTab: React.FC<{
  statistics: RoutingStatistics | null;
  history: RoutingHistoryItem[];
  historyPage: number;
  historyTotal: number;
  statsTimeRange: '7d' | '30d' | '90d';
  setStatsTimeRange: (range: '7d' | '30d' | '90d') => void;
  setHistoryPage: (page: number | ((prev: number) => number)) => void;
}> = ({
  statistics,
  history,
  historyPage,
  historyTotal,
  statsTimeRange,
  setStatsTimeRange,
  setHistoryPage,
}) => {
  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Routing Analytics
        </h3>
        <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setStatsTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statsTimeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-slate-500 text-sm">Total Requests</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{statistics?.totalDecisions?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-slate-500 text-sm">Success Rate</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{((statistics?.successRate || 0) * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-slate-500 text-sm">Avg Cost</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">${(statistics?.avgCost || 0).toFixed(4)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-slate-500 text-sm">Avg Confidence</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{((statistics?.avgConfidence || 0) * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          Recent Routing Decisions
        </h3>
        <div className="space-y-2">
          {history.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-4">
                <span className="text-slate-500 text-sm">{new Date(item.timestamp).toLocaleString()}</span>
                <span className="text-slate-800 font-medium">{item.selectedModelId}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  item.selectedTier === 'economy' ? 'bg-emerald-100 text-emerald-700' :
                  item.selectedTier === 'standard' ? 'bg-blue-100 text-blue-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {item.selectedTier}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-500 text-sm">{item.processingTimeMs}ms</span>
                <span className={`text-sm ${item.outcome?.success !== false ? 'text-emerald-600' : 'text-red-600'}`}>
                  {item.outcome?.success !== false ? 'Success' : 'Failed'}
                </span>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">No routing history available</p>
          )}
        </div>

        {/* Pagination */}
        {historyTotal > 20 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={historyPage === 1}
              className="px-3 py-1 bg-slate-200 rounded text-slate-700 disabled:opacity-50 hover:bg-slate-300"
            >
              Previous
            </button>
            <span className="text-slate-500">
              Page {historyPage} of {Math.ceil(historyTotal / 20)}
            </span>
            <button
              onClick={() => setHistoryPage(p => p + 1)}
              disabled={historyPage >= Math.ceil(historyTotal / 20)}
              className="px-3 py-1 bg-slate-200 rounded text-slate-700 disabled:opacity-50 hover:bg-slate-300"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InternalRouterSettings;
