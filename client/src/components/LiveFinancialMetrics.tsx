import React, { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Activity, Zap,
  RefreshCw, Loader2, AlertCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { getLiveFinancialMetrics, LiveFinancialMetrics as LiveFinancialMetricsData } from '../services/financialLiveApi';

interface LiveFinancialMetricsProps {
  token: string;
  refreshInterval?: number; // milliseconds
}

const LiveFinancialMetrics: React.FC<LiveFinancialMetricsProps> = ({ 
  token, 
  refreshInterval = 10000 // 10 seconds
}) => {
  const [metrics, setMetrics] = useState<LiveFinancialMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadMetrics = async () => {
    if (!token) {
      setError('Admin token is required');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getLiveFinancialMetrics(token);
      setMetrics(data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err: any) {
      console.error('LiveFinancialMetrics error:', err);
      setError(err.message || 'Failed to load live financial metrics');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    
    loadMetrics();
    const interval = setInterval(loadMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [token, refreshInterval]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toLocaleString();
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  if (!metrics) return null;

  const profitMargin = metrics.profit.profitMargin;
  const isProfitable = profitMargin > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity size={24} className="text-emerald-600" />
            Live Financial Metrics
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Real-time cost and revenue tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono">
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={20} className="opacity-80" />
            <span className="text-xs font-bold opacity-80 uppercase">Live MRR</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(metrics.revenue.liveMRR)}</div>
          <div className="text-sm opacity-80">Annual: {formatCurrency(metrics.revenue.annualRunRate)}</div>
        </div>

        {/* Cost Card */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Zap size={20} className="opacity-80" />
            <span className="text-xs font-bold opacity-80 uppercase">Projected Monthly Cost</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(metrics.costs.projected.monthly)}</div>
          <div className="text-sm opacity-80">Today: {formatCurrency(metrics.costs.today.total)}</div>
        </div>

        {/* Profit Card */}
        <div className={`bg-gradient-to-br rounded-xl p-6 text-white shadow-lg ${
          isProfitable ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'
        }`}>
          <div className="flex items-center justify-between mb-2">
            {isProfitable ? <TrendingUp size={20} className="opacity-80" /> : <TrendingDown size={20} className="opacity-80" />}
            <span className="text-xs font-bold opacity-80 uppercase">Net Revenue</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatCurrency(metrics.profit.netRevenue)}</div>
          <div className="text-sm opacity-80">
            Margin: {profitMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <DollarSign size={16} />
            Revenue by Plan (Live)
          </h4>
          <div className="space-y-3">
            {Object.entries(metrics.revenue.byPlan)
              .sort(([, a], [, b]) => b.mrr - a.mrr)
              .map(([plan, data]) => (
                <div key={plan} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-bold text-slate-800">{plan}</div>
                    <div className="text-xs text-slate-500">{data.users} active users</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">{formatCurrency(data.mrr)}</div>
                    <div className="text-xs text-slate-500">${data.price}/user</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Zap size={16} />
            LLM Costs Breakdown
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <div className="font-bold text-slate-800">Today</div>
                <div className="text-xs text-slate-500">{formatNumber(metrics.costs.today.calls)} calls</div>
              </div>
              <div className="font-bold text-red-600">{formatCurrency(metrics.costs.today.total)}</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div>
                <div className="font-bold text-slate-800">Last 7 Days</div>
                <div className="text-xs text-slate-500">Avg: {formatCurrency(metrics.costs.last7Days.avgDaily)}/day</div>
              </div>
              <div className="font-bold text-orange-600">{formatCurrency(metrics.costs.last7Days.total)}</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <div className="font-bold text-slate-800">Last 30 Days</div>
                <div className="text-xs text-slate-500">Avg: {formatCurrency(metrics.costs.last30Days.avgDaily)}/day</div>
              </div>
              <div className="font-bold text-yellow-600">{formatCurrency(metrics.costs.last30Days.total)}</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border-2 border-purple-200">
              <div>
                <div className="font-bold text-slate-800">Projected Monthly</div>
                <div className="text-xs text-slate-500">Based on current usage</div>
              </div>
              <div className="font-bold text-purple-600">{formatCurrency(metrics.costs.projected.monthly)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profit Analysis */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Activity size={16} />
          Profitability Analysis
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-emerald-50 rounded-lg">
            <div className="text-xs font-bold text-emerald-600 uppercase mb-1">Monthly Revenue</div>
            <div className="text-xl font-bold text-emerald-700">{formatCurrency(metrics.revenue.liveMRR)}</div>
          </div>
          
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-xs font-bold text-red-600 uppercase mb-1">Monthly Costs</div>
            <div className="text-xl font-bold text-red-700">{formatCurrency(metrics.costs.projected.monthly)}</div>
          </div>
          
          <div className={`p-4 rounded-lg ${isProfitable ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <div className={`text-xs font-bold uppercase mb-1 ${isProfitable ? 'text-blue-600' : 'text-orange-600'}`}>
              Net Revenue
            </div>
            <div className={`text-xl font-bold ${isProfitable ? 'text-blue-700' : 'text-orange-700'}`}>
              {formatCurrency(metrics.profit.netRevenue)}
            </div>
          </div>
          
          <div className={`p-4 rounded-lg ${isProfitable ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <div className={`text-xs font-bold uppercase mb-1 flex items-center gap-1 ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
              {isProfitable ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              Profit Margin
            </div>
            <div className={`text-xl font-bold ${isProfitable ? 'text-emerald-700' : 'text-red-700'}`}>
              {profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Break-even indicator */}
        {metrics.profit.breakEvenMRR > metrics.revenue.liveMRR && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm font-bold text-yellow-800">
              ⚠️ Break-Even: You need {formatCurrency(metrics.profit.breakEvenMRR - metrics.revenue.liveMRR)} more MRR to cover LLM costs
            </div>
          </div>
        )}
      </div>

      {/* Cost by Provider */}
      {Object.keys(metrics.costs.byProvider).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h4 className="text-sm font-bold text-slate-700 mb-4">Cost by LLM Provider (Last 30 Days)</h4>
          <div className="space-y-2">
            {Object.entries(metrics.costs.byProvider)
              .sort(([, a], [, b]) => (b as any).cost - (a as any).cost)
              .map(([provider, data]: [string, any]) => (
                <div key={provider} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-800 capitalize">{provider}</div>
                  <div className="text-right">
                    <div className="font-bold text-slate-800">{formatCurrency(data.cost || 0)}</div>
                    <div className="text-xs text-slate-500">{formatNumber(data.calls || 0)} calls</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveFinancialMetrics;

