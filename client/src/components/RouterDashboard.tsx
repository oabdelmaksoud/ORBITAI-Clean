'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Zap,
  Server,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Gauge,
  Thermometer,
} from 'lucide-react';
import {
  getRealTimeMetrics,
  getModelHealth,
  RealTimeMetrics,
  ModelHealthStatus,
  ModelMetrics,
  CostBurnRate,
  HourlyMetric,
} from '../services/routerEnhancedApi';

interface RouterDashboardProps {
  token?: string;
  routerType?: 'enduser' | 'internal' | 'both';
  refreshInterval?: number; // in seconds
}

export default function RouterDashboard({
  token,
  routerType = 'both',
  refreshInterval = 30,
}: RouterDashboardProps) {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'5min' | '1hour' | '24hours'>('1hour');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      // Map routerType prop to API parameter format
      const apiRouterType = routerType === 'enduser' ? 'end-user' : routerType === 'internal' ? 'internal' : undefined;
      const data = await getRealTimeMetrics(period, token, apiRouterType);
      setMetrics(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [period, token, routerType]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4" />;
      case 'unhealthy':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 500) return 'bg-green-500';
    if (latency < 1000) return 'bg-green-400';
    if (latency < 2000) return 'bg-yellow-400';
    if (latency < 3000) return 'bg-orange-400';
    return 'bg-red-500';
  };

  const renderCostGauge = (burnRate: CostBurnRate) => {
    const monthlyBudget = 1000; // This could be configurable
    const usagePercent = Math.min((burnRate.projectedMonthly / monthlyBudget) * 100, 100);
    const gaugeColor =
      usagePercent < 50
        ? 'from-green-500 to-green-600'
        : usagePercent < 75
        ? 'from-yellow-500 to-yellow-600'
        : 'from-red-500 to-red-600';

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-blue-600" />
            Cost Burn Rate
          </h3>
          <span className="text-xs text-slate-500">Projected Monthly</span>
        </div>

        {/* Gauge visualization */}
        <div className="relative h-32 flex items-center justify-center mb-4">
          <div className="relative w-48 h-24 overflow-hidden">
            {/* Background arc */}
            <div className="absolute inset-0 border-[16px] border-slate-200 rounded-t-full" />
            {/* Filled arc */}
            <div
              className={`absolute inset-0 border-[16px] rounded-t-full bg-gradient-to-r ${gaugeColor}`}
              style={{
                clipPath: `polygon(0 100%, 0 0, ${usagePercent}% 0, ${usagePercent}% 100%)`,
                borderColor: 'currentColor',
              }}
            />
            {/* Center value */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
              <div className="text-2xl font-bold text-slate-800">
                {formatCurrency(burnRate.projectedMonthly)}
              </div>
              <div className="text-xs text-slate-500">of {formatCurrency(monthlyBudget)}</div>
            </div>
          </div>
        </div>

        {/* Burn rate breakdown */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <div className="text-xs text-slate-500">Hourly</div>
            <div className="text-sm font-semibold text-slate-800">{formatCurrency(burnRate.hourly)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <div className="text-xs text-slate-500">Daily</div>
            <div className="text-sm font-semibold text-slate-800">{formatCurrency(burnRate.daily)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <div className="text-xs text-slate-500">Weekly</div>
            <div className="text-sm font-semibold text-slate-800">{formatCurrency(burnRate.weekly)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <div className="text-xs text-slate-500">Monthly</div>
            <div className="text-sm font-semibold text-slate-800">{formatCurrency(burnRate.monthly)}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderModelHealth = (health: ModelHealthStatus[]) => {
    const healthCounts = {
      healthy: health.filter((h) => h.status === 'healthy').length,
      degraded: health.filter((h) => h.status === 'degraded').length,
      unhealthy: health.filter((h) => h.status === 'unhealthy').length,
    };

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            Model Health
          </h3>
          <div className="flex gap-2">
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="w-3 h-3" /> {healthCounts.healthy}
            </span>
            <span className="flex items-center gap-1 text-xs text-yellow-600">
              <AlertCircle className="w-3 h-3" /> {healthCounts.degraded}
            </span>
            <span className="flex items-center gap-1 text-xs text-red-600">
              <XCircle className="w-3 h-3" /> {healthCounts.unhealthy}
            </span>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {health.map((model) => (
            <div
              key={model.modelId}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                selectedModel === model.modelId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedModel(selectedModel === model.modelId ? null : model.modelId)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-full ${getHealthColor(model.status)}`}>
                  {getHealthIcon(model.status)}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">{model.modelId}</div>
                  <div className="text-xs text-slate-500">{model.provider}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-800">
                  {model.successRate.toFixed(1)}% success
                </div>
                <div className="text-xs text-slate-500">{formatLatency(model.avgLatency)} avg</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLatencyHeatmap = (heatmap: HourlyMetric[], modelMetrics: ModelMetrics[]) => {
    // Group by hour and model
    const models = [...new Set(heatmap.map((h) => h.modelId))];
    const hours = [...new Set(heatmap.map((h) => h.hour))].sort();
    
    // Get max latency for scaling
    const maxLatency = Math.max(...heatmap.map((h) => h.avgLatency), 1);

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-blue-600" />
            Latency Heatmap
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" /> &lt;500ms
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-400" /> &lt;2s
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" /> &gt;3s
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Time axis */}
            <div className="flex mb-2">
              <div className="w-32" />
              {hours.slice(-12).map((hour) => (
                <div key={hour} className="flex-1 text-center text-xs text-slate-500">
                  {new Date(hour).toLocaleTimeString([], { hour: '2-digit' })}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            {models.slice(0, 8).map((modelId) => (
              <div key={modelId} className="flex items-center mb-1">
                <div className="w-32 text-xs text-slate-600 truncate pr-2" title={modelId}>
                  {modelId}
                </div>
                {hours.slice(-12).map((hour) => {
                  const metric = heatmap.find((h) => h.modelId === modelId && h.hour === hour);
                  const latency = metric?.avgLatency || 0;
                  const opacity = metric ? Math.min(metric.requestCount / 10, 1) : 0.1;

                  return (
                    <div
                      key={hour}
                      className={`flex-1 h-6 mx-0.5 rounded ${getLatencyColor(latency)}`}
                      style={{ opacity }}
                      title={`${modelId}: ${formatLatency(latency)} (${metric?.requestCount || 0} requests)`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderErrorSparklines = (modelMetrics: ModelMetrics[]) => {
    const topErrorModels = modelMetrics
      .filter((m) => m.errorCount > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Error Rates
          </h3>
        </div>

        <div className="space-y-3">
          {topErrorModels.length === 0 ? (
            <div className="text-center py-4 text-slate-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">No errors in selected period</p>
            </div>
          ) : (
            topErrorModels.map((model) => (
              <div key={model.modelId} className="flex items-center gap-3">
                <div className="w-32 text-xs text-slate-600 truncate" title={model.modelId}>
                  {model.modelId}
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${Math.min(model.errorRate, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right text-xs font-medium text-red-600">
                  {model.errorRate.toFixed(1)}%
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderTopErrors = (errors: Array<{ error: string; count: number; lastOccurred: string }>) => {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Top Errors
          </h3>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {errors.length === 0 ? (
            <div className="text-center py-4 text-slate-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">No errors recorded</p>
            </div>
          ) : (
            errors.map((err, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 bg-red-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-xs text-red-800 font-mono line-clamp-2">{err.error}</p>
                  <p className="text-xs text-red-600 mt-1">
                    {err.count} occurrences • Last: {new Date(err.lastOccurred).toLocaleString()}
                  </p>
                </div>
                <div className="text-lg font-bold text-red-600">{err.count}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show diagnostic message for internal router when there's no data
  const isInternalRouter = routerType === 'internal';
  const hasNoData = metrics && metrics.totalRequests === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Router Dashboard</h2>
          <p className="text-sm text-slate-500">
            Real-time monitoring and health status
            {lastRefresh && (
              <span className="ml-2">
                • Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['5min', '1hour', '24hours'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {p === '5min' ? '5 Min' : p === '1hour' ? '1 Hour' : '24 Hours'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Diagnostic message for internal router with no data */}
      {isInternalRouter && hasNoData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">No Internal Router Activity</h3>
              <p className="text-sm text-blue-800 mb-2">
                The internal router dashboard shows 0 because no requests have been tracked with <code className="bg-blue-100 px-1 rounded">routerType: 'internal'</code> yet.
              </p>
              <p className="text-sm text-blue-700">
                <strong>To see data here:</strong> Services need to use <code className="bg-blue-100 px-1 rounded">llmRouter.executeInternalTask()</code> or pass <code className="bg-blue-100 px-1 rounded">routerType: 'internal'</code> to <code className="bg-blue-100 px-1 rounded">executeWithFallback()</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key metrics cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Requests</p>
              <p className="text-xl font-bold text-slate-800">
                {formatNumber(metrics?.totalRequests || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Cost</p>
              <p className="text-xl font-bold text-slate-800">
                {formatCurrency(metrics?.totalCost || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Avg Latency</p>
              <p className="text-xl font-bold text-slate-800">
                {formatLatency(metrics?.avgLatency || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Error Rate</p>
              <p className="text-xl font-bold text-slate-800">
                {(metrics?.errorRate || 0).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main dashboard grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Cost Gauge */}
        {metrics?.costBurnRate && renderCostGauge(metrics.costBurnRate)}

        {/* Model Health */}
        {metrics?.modelHealth && renderModelHealth(metrics.modelHealth)}
      </div>

      {/* Latency Heatmap */}
      {metrics?.latencyHeatmap && metrics?.modelMetrics && (
        renderLatencyHeatmap(metrics.latencyHeatmap, metrics.modelMetrics)
      )}

      {/* Error panels */}
      <div className="grid grid-cols-2 gap-6">
        {/* Error Rates */}
        {metrics?.modelMetrics && renderErrorSparklines(metrics.modelMetrics)}

        {/* Top Errors */}
        {metrics?.topErrors && renderTopErrors(metrics.topErrors)}
      </div>

      {/* Model Metrics Table */}
      {metrics?.modelMetrics && metrics.modelMetrics.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Model Performance
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Model</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Provider</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">Requests</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">Success</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">Tokens</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">Cost</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">Avg Latency</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">P95</th>
                </tr>
              </thead>
              <tbody>
                {metrics.modelMetrics.map((model) => (
                  <tr
                    key={model.modelId}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 px-3 font-medium text-slate-800">{model.modelId}</td>
                    <td className="py-2 px-3 text-slate-600">{model.provider}</td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {formatNumber(model.requestCount)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`${
                          model.errorRate < 1
                            ? 'text-green-600'
                            : model.errorRate < 5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {(100 - model.errorRate).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {formatNumber(model.totalTokens)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {formatCurrency(model.totalCost)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {formatLatency(model.avgLatency)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {formatLatency(model.latencyPercentiles.p95)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

