import React, { useState, useEffect } from 'react';
import {
  Brain, TrendingUp, DollarSign, Activity, BarChart3,
  Clock, Zap, AlertCircle, CheckCircle, Loader2, Calendar,
  Filter, RefreshCw, Download
} from 'lucide-react';
import {
  getLLMTrends,
  getModelComparison,
  getCostAnalysis,
  getPerformanceMetrics,
  getContextBreakdown,
  TrendsResponse,
  ModelComparison,
  CostAnalysisResponse,
  PerformanceMetrics,
  ContextBreakdownResponse
} from '../services/llmAnalyticsApi';

interface LLMAnalyticsProps {
  token: string;
}

// Simple bar chart component
const SimpleBarChart: React.FC<{
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  formatValue?: (value: number) => string;
}> = ({ data, height = 200, formatValue = (v) => v.toString() }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg width="100%" height={height} className="overflow-visible">
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 40);
          const barWidth = 100 / data.length;
          const x = (index * barWidth);
          const color = item.color || '#3b82f6';
          
          return (
            <g key={index}>
              <rect
                x={`${x + 2}%`}
                y={height - barHeight - 20}
                width={`${barWidth - 4}%`}
                height={barHeight}
                fill={color}
                rx={4}
                className="hover:opacity-80 transition-opacity"
              />
              <text
                x={`${x + barWidth / 2}%`}
                y={height - 5}
                textAnchor="middle"
                className="text-xs fill-slate-600 font-medium"
              >
                {item.label.length > 8 ? item.label.slice(0, 6) + '...' : item.label}
              </text>
              <text
                x={`${x + barWidth / 2}%`}
                y={height - barHeight - 25}
                textAnchor="middle"
                className="text-xs fill-slate-800 font-bold"
              >
                {formatValue(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Simple line chart component
const SimpleLineChart: React.FC<{
  data: Array<{ x: string; y: number }>;
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
}> = ({ data, height = 200, color = '#3b82f6', formatValue = (v) => v.toString() }) => {
  if (data.length === 0) return <div className="text-center py-8 text-slate-400">No data available</div>;
  
  const maxValue = Math.max(...data.map(d => d.y), 1);
  const minValue = Math.min(...data.map(d => d.y), 0);
  const range = maxValue - minValue || 1;
  
  // SVG polyline requires numeric coordinates, not percentages
  // Use a viewBox coordinate system (0-100 scale)
  const padding = 10;
  const chartWidth = 100 - (padding * 2);
  const chartHeight = 100 - (padding * 2);
  
  const points = data.map((item, index) => {
    // Calculate x coordinate (0-100 scale)
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    // Calculate y coordinate (inverted: higher values at top, 0-100 scale)
    const normalizedY = ((item.y - minValue) / range);
    const y = padding + chartHeight - (normalizedY * chartHeight);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          className="drop-shadow-sm"
        />
        {data.map((item, index) => {
          const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
          const normalizedY = ((item.y - minValue) / range);
          const y = padding + chartHeight - (normalizedY * chartHeight);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="4"
              fill={color}
              className="hover:r-6 transition-all cursor-pointer"
            >
              <title>{item.x}: {formatValue(item.y)}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

const LLMAnalytics: React.FC<LLMAnalyticsProps> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [modelComparison, setModelComparison] = useState<ModelComparison[]>([]);
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysisResponse | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [contextBreakdown, setContextBreakdown] = useState<ContextBreakdownResponse | null>(null);
  
  // Filter states
  const [trendPeriod, setTrendPeriod] = useState<'24h' | '7d' | '30d' | '90d' | 'custom'>('7d');
  const [costPeriod, setCostPeriod] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  
  useEffect(() => {
    loadAllData();
  }, [token, trendPeriod, costPeriod, selectedProvider, selectedModel, selectedContext]);
  
  const loadAllData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    
    try {
      // Calculate date range for custom periods
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (trendPeriod === 'custom' && customStartDate && customEndDate) {
        startDate = new Date(customStartDate).toISOString();
        endDate = new Date(customEndDate).toISOString();
      }
      
      const [trendsData, comparisonData, costData, perfData, contextData] = await Promise.all([
        getLLMTrends(
          token,
          trendPeriod === 'custom' ? '7d' : trendPeriod, // Use default period for API, but we'll filter client-side
          selectedProvider !== 'all' ? selectedProvider : undefined,
          selectedModel !== 'all' ? selectedModel : undefined,
          selectedContext !== 'all' ? selectedContext : undefined
        ).catch(() => null),
        getModelComparison(token, startDate, endDate).catch(() => ({ models: [] })),
        getCostAnalysis(token, costPeriod === 'custom' ? '30d' : costPeriod).catch(() => null),
        getPerformanceMetrics(
          token,
          startDate,
          endDate,
          selectedModel !== 'all' ? selectedModel : undefined,
          selectedProvider !== 'all' ? selectedProvider : undefined
        ).catch(() => null),
        getContextBreakdown(token, startDate, endDate).catch(() => null)
      ]);
      
      // Filter trends data if custom date range
      let filteredTrends = trendsData;
      if (trendPeriod === 'custom' && customStartDate && customEndDate && trendsData) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        filteredTrends = {
          ...trendsData,
          trends: trendsData.trends.filter(t => {
            const trendDate = new Date(t.date);
            return trendDate >= start && trendDate <= end;
          })
        };
      }
      
      setTrends(filteredTrends);
      setModelComparison(comparisonData.models);
      setCostAnalysis(costData);
      setPerformance(perfData);
      setContextBreakdown(contextData);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Failed to load LLM analytics:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };
  
  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toLocaleString();
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (trendPeriod === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleExport = () => {
    if (!trends) return;

    // Prepare CSV data
    const csvRows: string[] = [];
    
    // Header
    csvRows.push('Date,Calls,Tokens,Cost,Avg Latency,Error Rate');
    
    // Trends data
    trends.trends.forEach(trend => {
      csvRows.push([
        trend.date,
        trend.calls.toString(),
        trend.tokens.toString(),
        trend.cost.toFixed(4),
        Math.round(trend.avgLatency).toString(),
        trend.errorRate.toFixed(2)
      ].join(','));
    });
    
    // Summary
    csvRows.push('');
    csvRows.push('Summary');
    csvRows.push(`Total Calls,${trends.summary.totalCalls}`);
    csvRows.push(`Total Tokens,${trends.summary.totalTokens}`);
    csvRows.push(`Total Cost,${trends.summary.totalCost.toFixed(4)}`);
    csvRows.push(`Avg Latency,${Math.round(trends.summary.avgLatency)}`);
    
    // Model comparison
    if (modelComparison.length > 0) {
      csvRows.push('');
      csvRows.push('Model Comparison');
      csvRows.push('Model,Provider,Calls,Total Cost,Avg Cost/Call,Avg Latency,Success Rate');
      modelComparison.forEach(model => {
        csvRows.push([
          model.modelId,
          model.provider,
          model.calls.toString(),
          model.totalCost.toFixed(4),
          model.avgCostPerCall.toFixed(4),
          Math.round(model.avgLatency).toString(),
          model.successRate.toFixed(2)
        ].join(','));
      });
    }
    
    // Cost analysis
    if (costAnalysis) {
      csvRows.push('');
      csvRows.push('Cost Analysis');
      csvRows.push('Date,Total Cost,Input Cost,Output Cost');
      costAnalysis.analysis.forEach(item => {
        csvRows.push([
          item.date,
          item.totalCost.toFixed(4),
          item.inputCost.toFixed(4),
          item.outputCost.toFixed(4)
        ].join(','));
      });
    }
    
    // Create and download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `llm-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Get unique providers and models
  const providers = Array.from(new Set(modelComparison.map(m => m.provider)));
  const models = Array.from(new Set(modelComparison.map(m => m.modelId)));
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 size={28} className="text-purple-600" />
            LLM Analytics Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive analytics and insights for LLM usage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={loading || !trends}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button
            onClick={loadAllData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <Filter size={16} className="text-slate-400" />
        <div className="flex items-center gap-2">
          <select
            value={trendPeriod}
            onChange={(e) => {
              const value = e.target.value as any;
              setTrendPeriod(value);
              if (value !== 'custom') {
                setShowCustomDatePicker(false);
              } else {
                setShowCustomDatePicker(true);
              }
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          {showCustomDatePicker && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="Start Date"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="End Date"
              />
              <button
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    loadAllData();
                  }
                }}
                disabled={!customStartDate || !customEndDate}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Apply
              </button>
            </div>
          )}
        </div>
        <select
          value={costPeriod}
          onChange={(e) => setCostPeriod(e.target.value as any)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Providers</option>
          {providers.map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Models</option>
          {models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={selectedContext}
          onChange={(e) => setSelectedContext(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Contexts</option>
          <option value="wizard">Wizard Only</option>
          <option value="workspace">Workspace Only</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      
      {loading && !trends && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}
      
      {/* Summary Cards */}
      {trends && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Activity size={20} className="opacity-80" />
              <span className="text-xs font-bold opacity-80 uppercase">{trendPeriod}</span>
            </div>
            <div className="text-3xl font-bold mb-1">{formatNumber(trends.summary.totalCalls)}</div>
            <div className="text-sm opacity-80">Total Calls</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Brain size={20} className="opacity-80" />
              <span className="text-xs font-bold opacity-80 uppercase">{trendPeriod}</span>
            </div>
            <div className="text-3xl font-bold mb-1">{formatNumber(trends.summary.totalTokens)}</div>
            <div className="text-sm opacity-80">Total Tokens</div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={20} className="opacity-80" />
              <span className="text-xs font-bold opacity-80 uppercase">{trendPeriod}</span>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(trends.summary.totalCost)}</div>
            <div className="text-sm opacity-80">Total Cost</div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock size={20} className="opacity-80" />
              <span className="text-xs font-bold opacity-80 uppercase">Avg</span>
            </div>
            <div className="text-3xl font-bold mb-1">{Math.round(trends.summary.avgLatency)}ms</div>
            <div className="text-sm opacity-80">Avg Latency</div>
          </div>
        </div>
      )}
      
      {/* Wizard vs Workspace Breakdown */}
      {contextBreakdown && contextBreakdown.breakdown.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Brain size={20} />
            Usage by Context: Wizard vs Workspace
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {contextBreakdown.breakdown.map((context) => (
              <div
                key={context.context}
                className={`rounded-xl p-6 ${
                  context.context === 'wizard'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                    : context.context === 'workspace'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                    : 'bg-gradient-to-br from-slate-500 to-slate-600 text-white'
                }`}
              >
                <div className="text-sm font-bold uppercase opacity-80 mb-2">
                  {context.context === 'wizard' ? '🎯 Wizard' : context.context === 'workspace' ? '💼 Workspace' : '📋 Other'}
                </div>
                <div className="text-3xl font-bold mb-4">{formatNumber(context.calls)}</div>
                <div className="space-y-1 text-sm opacity-90">
                  <div>Cost: {formatCurrency(context.totalCost)}</div>
                  <div>Tokens: {formatNumber(context.totalTokens)}</div>
                  <div>Avg Latency: {Math.round(context.avgLatency)}ms</div>
                  <div>Success Rate: {context.successRate.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Context Comparison Chart */}
          <div className="mt-6">
            <h4 className="text-sm font-bold text-slate-700 mb-4">Calls by Context</h4>
            <SimpleBarChart
              data={contextBreakdown.breakdown.map((c, i) => ({
                label: c.context === 'wizard' ? 'Wizard' : c.context === 'workspace' ? 'Workspace' : 'Other',
                value: c.calls,
                color: c.context === 'wizard' ? '#3b82f6' : c.context === 'workspace' ? '#8b5cf6' : '#64748b'
              }))}
              height={200}
              formatValue={(v) => formatNumber(v)}
            />
          </div>
          
          {/* Detailed Breakdown Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="p-3 text-left">Context</th>
                  <th className="p-3 text-center">Calls</th>
                  <th className="p-3 text-center">Total Cost</th>
                  <th className="p-3 text-center">Avg Cost/Call</th>
                  <th className="p-3 text-center">Total Tokens</th>
                  <th className="p-3 text-center">Avg Latency</th>
                  <th className="p-3 text-center">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contextBreakdown.breakdown.map((context) => (
                  <tr key={context.context} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded text-xs font-bold ${
                        context.context === 'wizard'
                          ? 'bg-blue-100 text-blue-700'
                          : context.context === 'workspace'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {context.context === 'wizard' ? '🎯 Wizard' : context.context === 'workspace' ? '💼 Workspace' : '📋 Other'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-semibold">{formatNumber(context.calls)}</td>
                    <td className="p-3 text-center font-bold text-emerald-600">{formatCurrency(context.totalCost)}</td>
                    <td className="p-3 text-center text-slate-600">{formatCurrency(context.avgCostPerCall)}</td>
                    <td className="p-3 text-center text-slate-600">{formatNumber(context.totalTokens)}</td>
                    <td className="p-3 text-center text-slate-600">{Math.round(context.avgLatency)}ms</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        context.successRate >= 95 ? 'bg-emerald-100 text-emerald-700' :
                        context.successRate >= 80 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {context.successRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Context Trends Over Time */}
          {trends && trends.trends.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-bold text-slate-700 mb-4">Context Trends Over Time</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contextBreakdown.breakdown.map((context) => {
                  // Extract context trend from overall trends
                  const contextTrends = trends.trends
                    .filter(t => t.byContext && t.byContext[context.context])
                    .map(t => ({
                      x: formatDate(t.date),
                      y: t.byContext[context.context]?.calls || 0
                    }));
                  
                  if (contextTrends.length === 0) return null;
                  
                  return (
                    <div key={context.context} className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs font-bold text-slate-600 mb-2 uppercase">
                        {context.context === 'wizard' ? 'Wizard' : context.context === 'workspace' ? 'Workspace' : 'Other'} Usage
                      </div>
                      <SimpleLineChart
                        data={contextTrends}
                        height={150}
                        color={context.context === 'wizard' ? '#3b82f6' : context.context === 'workspace' ? '#8b5cf6' : '#64748b'}
                        formatValue={(v) => formatNumber(v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Trends Charts */}
      {trends && trends.trends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usage Trends */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Usage Trends
            </h3>
            <SimpleLineChart
              data={trends.trends.map(t => ({
                x: formatDate(t.date),
                y: t.calls
              }))}
              height={250}
              color="#3b82f6"
              formatValue={(v) => formatNumber(v)}
            />
          </div>
          
          {/* Cost Trends */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <DollarSign size={20} />
              Cost Trends
            </h3>
            <SimpleLineChart
              data={trends.trends.map(t => ({
                x: formatDate(t.date),
                y: t.cost
              }))}
              height={250}
              color="#10b981"
              formatValue={(v) => formatCurrency(v)}
            />
          </div>
        </div>
      )}
      
      {/* Model Comparison */}
      {modelComparison.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Brain size={20} />
            Model Comparison
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="p-3 text-left">Model</th>
                  <th className="p-3 text-center">Calls</th>
                  <th className="p-3 text-center">Total Cost</th>
                  <th className="p-3 text-center">Avg Cost/Call</th>
                  <th className="p-3 text-center">Avg Latency</th>
                  <th className="p-3 text-center">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modelComparison.slice(0, 10).map((model, index) => (
                  <tr key={model.modelId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{model.modelId}</div>
                      <div className="text-xs text-slate-500 capitalize">{model.provider}</div>
                    </td>
                    <td className="p-3 text-center font-semibold">{formatNumber(model.calls)}</td>
                    <td className="p-3 text-center font-bold text-emerald-600">{formatCurrency(model.totalCost)}</td>
                    <td className="p-3 text-center text-slate-600">{formatCurrency(model.avgCostPerCall)}</td>
                    <td className="p-3 text-center text-slate-600">{Math.round(model.avgLatency)}ms</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        model.successRate >= 95 ? 'bg-emerald-100 text-emerald-700' :
                        model.successRate >= 80 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {model.successRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Model Usage Chart */}
          <div className="mt-6">
            <h4 className="text-sm font-bold text-slate-700 mb-4">Usage by Model</h4>
            <SimpleBarChart
              data={modelComparison.slice(0, 8).map((m, i) => ({
                label: m.modelId,
                value: m.calls,
                color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'][i % 8]
              }))}
              height={200}
              formatValue={(v) => formatNumber(v)}
            />
          </div>
        </div>
      )}
      
      {/* Cost Analysis */}
      {costAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <DollarSign size={20} />
              Cost Breakdown
            </h3>
            <SimpleLineChart
              data={costAnalysis.analysis.map(a => ({
                x: formatDate(a.date),
                y: a.totalCost
              }))}
              height={250}
              color="#10b981"
              formatValue={(v) => formatCurrency(v)}
            />
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-500">Total Cost</div>
                <div className="font-bold text-slate-800">{formatCurrency(costAnalysis.totals.totalCost)}</div>
              </div>
              <div>
                <div className="text-slate-500">Projected Monthly</div>
                <div className="font-bold text-emerald-600">{formatCurrency(costAnalysis.projections.projectedMonthly)}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Cost Projections</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Average Daily Cost</span>
                <span className="font-bold text-slate-800">{formatCurrency(costAnalysis.projections.avgDailyCost)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-blue-700">Projected Monthly</span>
                <span className="font-bold text-blue-800">{formatCurrency(costAnalysis.projections.projectedMonthly)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                <span className="text-emerald-700">Projected Yearly</span>
                <span className="font-bold text-emerald-800">{formatCurrency(costAnalysis.projections.projectedYearly)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Performance Metrics */}
      {performance && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Zap size={20} />
            Performance Metrics
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Success Rate</div>
              <div className={`text-2xl font-bold ${
                performance.successRate >= 95 ? 'text-emerald-600' :
                performance.successRate >= 80 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {performance.successRate.toFixed(1)}%
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Avg Latency</div>
              <div className="text-2xl font-bold text-slate-800">{Math.round(performance.latency.avg)}ms</div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">P95 Latency</div>
              <div className="text-2xl font-bold text-slate-800">{Math.round(performance.latency.p95)}ms</div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Token Efficiency</div>
              <div className="text-2xl font-bold text-slate-800">{formatNumber(performance.tokenEfficiency)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-500 mb-1">P50 Latency</div>
              <div className="font-bold">{Math.round(performance.latency.p50)}ms</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">P99 Latency</div>
              <div className="font-bold">{Math.round(performance.latency.p99)}ms</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Failed Calls</div>
              <div className="font-bold text-red-600">{performance.failedCalls}</div>
            </div>
          </div>
        </div>
      )}
      
      {!loading && !trends && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Brain size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No analytics data available yet</p>
          <p className="text-sm text-slate-400 mt-2">Analytics will appear once LLM usage data is collected</p>
        </div>
      )}
    </div>
  );
};

export default LLMAnalytics;
