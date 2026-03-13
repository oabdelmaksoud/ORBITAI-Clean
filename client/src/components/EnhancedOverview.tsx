/**
 * Enhanced Overview Component
 * Comprehensive dashboard with charts, visualizations, and detailed metrics
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  LayoutGrid,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Brain,
  Zap,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  PieChart,
  LineChart,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Database,
  Shield,
  Globe,
  Cpu,
  HardDrive,
  MemoryStick,
  Cloud,
  Code
} from 'lucide-react';
import {
  getDashboardStats,
  DashboardStats
} from '../services/adminApi';
import {
  getFinancialDashboard,
  getAnalyticsOverview,
  FinancialDashboard
} from '../services/adminApiExtended';
import {
  getLiveUsage,
  getUsageStats,
  getCostBreakdown,
  LiveUsage,
  UsageStats,
  CostBreakdown
} from '../services/llmUsageApi';
import { getActivityStats, getActivityEvents } from '../services/activityApi';
import { getIntegrationStatus } from '../services/adminIntegrationsApi';
import { getRateLimitStats } from '../services/adminRateLimitingApi';
import { useBackendConnection } from '../hooks/useBackendConnection';
import { healthApi } from '@src/services/api';
import { getSystemHealth, SystemHealth } from '../services/adminSystemControlApi';

interface EnhancedOverviewProps {
  token: string;
}

const EnhancedOverview: React.FC<EnhancedOverviewProps> = ({ token }) => {
  const backendConnection = useBackendConnection();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [liveLLMUsage, setLiveLLMUsage] = useState<LiveUsage | null>(null);
  const [todayLLMStats, setTodayLLMStats] = useState<UsageStats | null>(null);
  const [weekLLMStats, setWeekLLMStats] = useState<UsageStats | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [financialData, setFinancialData] = useState<FinancialDashboard | null>(null);
  const [analyticsOverview, setAnalyticsOverview] = useState<any>(null);
  const [activityStats, setActivityStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [rateLimitStats, setRateLimitStats] = useState<any>(null);
  const [databaseStatus, setDatabaseStatus] = useState<'connected' | 'disconnected' | 'error' | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      loadAllData();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      if (timeRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setHours(0, 0, 0, 0);
      }

      const [
        stats,
        live,
        todayStats,
        weekStats,
        costData,
        financial,
        analytics,
        activity,
        recentActivityData,
        integrations,
        rateLimits,
        health,
        systemHealthData
      ] = await Promise.allSettled([
        getDashboardStats(token),
        getLiveUsage(token, 5),
        getUsageStats(token, { startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() }),
        getUsageStats(token, { startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }),
        getCostBreakdown(token, timeRange === 'today' ? 'today' : timeRange === 'week' ? 'week' : 'month'),
        getFinancialDashboard(token),
        getAnalyticsOverview(token),
        getActivityStats(token),
        getActivityEvents(token, { limit: 20 }),
        getIntegrationStatus(token).catch(() => null),
        getRateLimitStats(token).catch(() => null),
        healthApi.detailed().catch(() => null),
        getSystemHealth(token).catch(() => null)
      ]);

      if (stats.status === 'fulfilled') setDashboardStats(stats.value);
      if (live.status === 'fulfilled') setLiveLLMUsage(live.value);
      if (todayStats.status === 'fulfilled') setTodayLLMStats(todayStats.value);
      if (weekStats.status === 'fulfilled') setWeekLLMStats(weekStats.value);
      if (costData.status === 'fulfilled') setCostBreakdown(costData.value);
      if (financial.status === 'fulfilled') setFinancialData(financial.value);
      if (analytics.status === 'fulfilled') setAnalyticsOverview(analytics.value);
      if (activity.status === 'fulfilled') setActivityStats(activity.value);
      if (recentActivityData.status === 'fulfilled') setRecentActivity(recentActivityData.value);
      if (integrations.status === 'fulfilled') setIntegrationStatus(integrations.value);
      if (rateLimits.status === 'fulfilled') setRateLimitStats(rateLimits.value);
      if (health.status === 'fulfilled' && health.value) {
        setHealthData(health.value);
        if (health.value.dependencies?.database) {
          setDatabaseStatus(health.value.dependencies.database.status);
        }
      }
      
      if (systemHealthData.status === 'fulfilled' && systemHealthData.value) {
        setSystemHealth(systemHealthData.value);
      }

      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('Failed to load overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    label, 
    value, 
    change, 
    changeType, 
    icon: Icon, 
    color, 
    subtitle 
  }: {
    label: string;
    value: string | number;
    change?: string;
    changeType?: 'up' | 'down' | 'neutral';
    icon: any;
    color: string;
    subtitle?: string;
  }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${
            changeType === 'up' ? 'text-emerald-600' : 
            changeType === 'down' ? 'text-red-600' : 
            'text-slate-600'
          }`}>
            {changeType === 'up' && <ArrowUpRight className="w-4 h-4" />}
            {changeType === 'down' && <ArrowDownRight className="w-4 h-4" />}
            {change}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-3xl font-bold text-slate-800 mb-1">{value}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );

  const MiniChart = ({ data, color }: { data: number[]; color: string }) => {
    const max = Math.max(...data, 1);
    return (
      <div className="flex items-end gap-1 h-12">
        {data.map((value, idx) => (
          <div
            key={idx}
            className="flex-1 bg-slate-200 rounded-t"
            style={{
              height: `${(value / max) * 100}%`,
              backgroundColor: color,
              opacity: 0.7
            }}
          />
        ))}
      </div>
    );
  };

  // Calculate trends
  const userGrowth = analyticsOverview?.users?.last7Days || 0;
  const projectGrowth = analyticsOverview?.projects?.last7Days || 0;
  const costTrend = weekLLMStats && todayLLMStats 
    ? ((todayLLMStats.totalCost - (weekLLMStats.totalCost / 7)) / (weekLLMStats.totalCost / 7) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['today', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  timeRange === range
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Users"
          value={dashboardStats?.stats.totalUsers || 0}
          change={`+${userGrowth} (7d)`}
          changeType={userGrowth > 0 ? 'up' : 'neutral'}
          icon={Users}
          color="bg-blue-500"
          subtitle={`${dashboardStats?.stats.activeUsers || 0} active`}
        />
        <StatCard
          label="Total Projects"
          value={dashboardStats?.stats.totalProjects || 0}
          change={`+${projectGrowth} (7d)`}
          changeType={projectGrowth > 0 ? 'up' : 'neutral'}
          icon={LayoutGrid}
          color="bg-purple-500"
          subtitle={`${dashboardStats?.stats.activeProjects || 0} active`}
        />
        <StatCard
          label="LLM Usage Today"
          value={todayLLMStats?.totalCalls || 0}
          change={`${liveLLMUsage?.rate.toFixed(1) || 0}/min`}
          changeType="neutral"
          icon={Brain}
          color="bg-indigo-500"
          subtitle={`${todayLLMStats?.totalTokens.toLocaleString() || 0} tokens`}
        />
        <StatCard
          label="Today's Cost"
          value={`$${(todayLLMStats?.totalCost || 0).toFixed(2)}`}
          change={costTrend > 0 ? `+${costTrend.toFixed(1)}%` : costTrend < 0 ? `${costTrend.toFixed(1)}%` : '0%'}
          changeType={costTrend > 0 ? 'up' : costTrend < 0 ? 'down' : 'neutral'}
          icon={DollarSign}
          color="bg-emerald-500"
          subtitle={`Avg: $${((todayLLMStats?.totalCost || 0) / Math.max(todayLLMStats?.totalCalls || 1, 1)).toFixed(4)}/call`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Users (7d)</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {analyticsOverview?.users?.active7d || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Activity (24h)</span>
            <Zap className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {activityStats?.last24Hours || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">MCP Servers</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {integrationStatus?.mcpServers?.active || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Rate Limits</span>
            <Shield className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {rateLimitStats?.active || 0}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Cost Breakdown by Provider
            </h3>
          </div>
          {costBreakdown?.byProvider ? (
            <div className="space-y-3">
              {Object.entries(costBreakdown.byProvider)
                .sort(([, a]: any, [, b]: any) => b - a)
                .slice(0, 5)
                .map(([provider, cost]: [string, any]) => {
                  const total = Object.values(costBreakdown.byProvider).reduce((a: any, b: any) => a + b, 0);
                  const percentage = total > 0 ? (cost / total) * 100 : 0;
                  return (
                    <div key={provider}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{provider}</span>
                        <span className="text-sm font-bold text-slate-800">${cost.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">No cost data available</div>
          )}
        </div>

        {/* Model Usage Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Top Models by Usage
            </h3>
          </div>
          {todayLLMStats?.byModel ? (
            <div className="space-y-3">
              {Object.entries(todayLLMStats.byModel)
                .sort(([, a]: any, [, b]: any) => b.calls - a.calls)
                .slice(0, 5)
                .map(([model, stats]: [string, any]) => {
                  const maxCalls = Math.max(...Object.values(todayLLMStats.byModel).map((s: any) => s.calls));
                  const percentage = maxCalls > 0 ? (stats.calls / maxCalls) * 100 : 0;
                  return (
                    <div key={model}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 truncate">{model}</span>
                        <span className="text-sm font-bold text-slate-800">{stats.calls} calls</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">No model usage data</div>
          )}
        </div>
      </div>

      {/* Daily Cost Trend */}
      {costBreakdown?.dailyCosts && costBreakdown.dailyCosts.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <LineChart className="w-5 h-5" />
              Daily Cost Trend
            </h3>
          </div>
          <div className="h-48 flex items-end gap-2">
            {costBreakdown.dailyCosts.slice(-7).map((day: any, idx: number) => {
              const maxCost = Math.max(...costBreakdown.dailyCosts.map((d: any) => d.cost));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-700 hover:to-blue-500"
                    style={{ height: `${(day.cost / maxCost) * 100}%` }}
                    title={`${day.date}: $${day.cost.toFixed(2)}`}
                  />
                  <div className="text-xs text-slate-500 mt-2 text-center">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    ${day.cost.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            System Health
          </h3>
          <div className="space-y-3">
            {/* Backend Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <Server className="w-4 h-4" />
                Backend Status
              </span>
              {backendConnection.isConnected ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Online
                  {backendConnection.latency && (
                    <span className="text-xs text-slate-500">({backendConnection.latency}ms)</span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  Offline
                </span>
              )}
            </div>
            
            {/* Database */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Database
              </span>
              {databaseStatus === 'connected' ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Connected
                  {healthData?.dependencies?.database?.latency && (
                    <span className="text-xs text-slate-500">({healthData.dependencies.database.latency}ms)</span>
                  )}
                </span>
              ) : databaseStatus === 'disconnected' || databaseStatus === 'error' ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {databaseStatus === 'error' ? 'Error' : 'Disconnected'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-500">
                  <Clock className="w-4 h-4" />
                  Checking...
                </span>
              )}
            </div>
            
            {/* Redis */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <MemoryStick className="w-4 h-4" />
                Redis Cache
              </span>
              {healthData?.dependencies?.redis ? (
                healthData.dependencies.redis.status === 'connected' ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                    {healthData.dependencies.redis.latency && (
                      <span className="text-xs text-slate-500">({healthData.dependencies.redis.latency}ms)</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {healthData.dependencies.redis.status === 'error' ? 'Error' : 'Disconnected'}
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-500">
                  <Clock className="w-4 h-4" />
                  Checking...
                </span>
              )}
            </div>
            
            {/* Gemini API */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Gemini API
              </span>
              {healthData?.dependencies?.externalApis?.gemini ? (
                healthData.dependencies.externalApis.gemini.status === 'available' ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Available
                    {healthData.dependencies.externalApis.gemini.responseTime && (
                      <span className="text-xs text-slate-500">({healthData.dependencies.externalApis.gemini.responseTime}ms)</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {healthData.dependencies.externalApis.gemini.status === 'error' ? 'Error' : 'Unavailable'}
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-500">
                  <Clock className="w-4 h-4" />
                  Checking...
                </span>
              )}
            </div>
            
            {/* E2B API */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <Code className="w-4 h-4" />
                E2B Sandbox
              </span>
              {healthData?.dependencies?.externalApis?.e2b ? (
                healthData.dependencies.externalApis.e2b.status === 'available' ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Available
                    {healthData.dependencies.externalApis.e2b.responseTime && (
                      <span className="text-xs text-slate-500">({healthData.dependencies.externalApis.e2b.responseTime}ms)</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {healthData.dependencies.externalApis.e2b.status === 'error' ? 'Error' : 'Unavailable'}
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-500">
                  <Clock className="w-4 h-4" />
                  Checking...
                </span>
              )}
            </div>
            
            {/* System Uptime */}
            {healthData?.uptime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Uptime
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {Math.floor(healthData.uptime / 3600)}h {Math.floor((healthData.uptime % 3600) / 60)}m
                </span>
              </div>
            )}
            
            {/* Version */}
            {healthData?.version && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Version
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  v{healthData.version}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* System Resources */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            System Resources
          </h3>
          <div className="space-y-3">
            {/* CPU Usage */}
            {systemHealth?.cpu && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    CPU Usage
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {systemHealth.cpu.cores} cores
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      systemHealth.cpu.usage > 80 ? 'bg-red-500' :
                      systemHealth.cpu.usage > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(systemHealth.cpu.usage, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {systemHealth.cpu.usage.toFixed(1)}% used
                </div>
              </div>
            )}
            
            {/* Memory Usage */}
            {systemHealth?.memory && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <MemoryStick className="w-4 h-4" />
                    Memory Usage
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {systemHealth.memory.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      systemHealth.memory.percentage > 80 ? 'bg-red-500' :
                      systemHealth.memory.percentage > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${systemHealth.memory.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {(systemHealth.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB / {(systemHealth.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB
                </div>
              </div>
            )}
            
            {/* Node Version */}
            {systemHealth?.nodeVersion && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Node.js Version
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {systemHealth.nodeVersion}
                </span>
              </div>
            )}
            
            {/* Platform */}
            {systemHealth?.platform && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Platform
                </span>
                <span className="text-sm font-semibold text-slate-800 capitalize">
                  {systemHealth.platform}
                </span>
              </div>
            )}
            
            {/* System Uptime */}
            {systemHealth?.uptime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  System Uptime
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Recent Activity
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentActivity.slice(0, 5).map((event: any, idx: number) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">{event.type || 'Activity'}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-4">No recent activity</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Quick Stats
          </h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Avg Response Time</div>
              <div className="text-lg font-bold text-slate-800">
                {liveLLMUsage ? `${(60000 / Math.max(liveLLMUsage.rate, 1)).toFixed(0)}ms` : '--'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Tokens per Call</div>
              <div className="text-lg font-bold text-slate-800">
                {todayLLMStats && todayLLMStats.totalCalls > 0
                  ? Math.round(todayLLMStats.totalTokens / todayLLMStats.totalCalls).toLocaleString()
                  : '--'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Success Rate</div>
              <div className="text-lg font-bold text-emerald-600">
                {todayLLMStats?.recentCalls && todayLLMStats.recentCalls.length > 0
                  ? `${((todayLLMStats.recentCalls.filter((c: any) => c.success).length / todayLLMStats.recentCalls.length) * 100).toFixed(1)}%`
                  : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      {financialData && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-600 mb-1">Monthly Recurring Revenue</div>
              <div className="text-2xl font-bold text-slate-800">
                ${financialData.mrr?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Annual Recurring Revenue</div>
              <div className="text-2xl font-bold text-slate-800">
                ${financialData.arr?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-slate-800">
                ${financialData.totalRevenue?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Active Subscriptions</div>
              <div className="text-2xl font-bold text-slate-800">
                {financialData.activeSubscriptions || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedOverview;

