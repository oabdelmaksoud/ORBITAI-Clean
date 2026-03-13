import React, { useState, useEffect } from 'react';
import { Brain, DollarSign, Zap, TrendingUp, Clock, Activity } from 'lucide-react';
import { getLiveUsage, getUsageStats, getCostBreakdown, LiveUsage, UsageStats, CostBreakdown } from '../services/llmUsageApi';
import { Loader2 } from 'lucide-react';

interface LiveLLMUsageProps {
  token: string;
  refreshInterval?: number; // milliseconds
}

const LiveLLMUsage: React.FC<LiveLLMUsageProps> = ({ token, refreshInterval = 5000 }) => {
  const [liveUsage, setLiveUsage] = useState<LiveUsage | null>(null);
  const [todayStats, setTodayStats] = useState<UsageStats | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadData = async () => {
    if (!token) {
      setError('Admin token is required');
      setLoading(false);
      return;
    }
    
    try {
      setError(null);
      // Use Promise.allSettled to prevent one failing API from breaking all
      const [liveResult, statsResult, costResult] = await Promise.allSettled([
        getLiveUsage(token, 5).catch(e => ({ calls: 0, tokens: 0, cost: 0, rate: 0, byModel: {} })),
        getUsageStats(token, {
          startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        }).catch(e => ({ totalCalls: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0, byProvider: {}, byModel: {}, recentCalls: [] })),
        getCostBreakdown(token, 'today').catch(e => ({ period: 'today', totalCost: 0, dailyCosts: [], byProvider: {} }))
      ]);

      // Extract values from settled promises
      const live = liveResult.status === 'fulfilled' ? liveResult.value : { calls: 0, tokens: 0, cost: 0, rate: 0, byModel: {} };
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : { totalCalls: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0, byProvider: {}, byModel: {}, recentCalls: [] };
      const cost = costResult.status === 'fulfilled' ? costResult.value : { period: 'today', totalCost: 0, dailyCosts: [], byProvider: {} };

      setLiveUsage(live as LiveUsage);
      setTodayStats(stats as UsageStats);
      setCostBreakdown(cost as CostBreakdown);
      setLastUpdate(new Date());
      setLoading(false);
      
      // Set error if any failed
      if (liveResult.status === 'rejected' || statsResult.status === 'rejected' || costResult.status === 'rejected') {
        setError('Some data failed to load. Showing available data.');
      }
    } catch (err: any) {
      console.error('LiveLLMUsage error:', err);
      setError(err.message || 'Failed to load LLM usage data');
      setLoading(false);
      // Set default values to prevent crash
      setLiveUsage({ calls: 0, tokens: 0, cost: 0, rate: 0, byModel: {} });
      setTodayStats({ totalCalls: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0, byProvider: {}, byModel: {}, recentCalls: [] });
      setCostBreakdown({ period: 'today', totalCost: 0, dailyCosts: [], byProvider: {} });
    }
  };

  useEffect(() => {
    if (!token) {
      setError('Admin token is required');
      setLoading(false);
      return;
    }
    
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [token, refreshInterval]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toLocaleString();
  };

  // Don't show loading screen, show empty state instead
  // if (loading && !liveUsage) {
  //   return (
  //     <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
  //       <div className="flex items-center justify-center py-8">
  //         <Loader2 className="animate-spin text-blue-600" size={32} />
  //       </div>
  //     </div>
  //   );
  // }

  // Ensure we have valid data structures
  const safeLiveUsage = liveUsage || { calls: 0, tokens: 0, cost: 0, rate: 0, byModel: {} };
  const safeTodayStats = todayStats || { totalCalls: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0, byProvider: {}, byModel: {}, recentCalls: [] };
  const safeCostBreakdown = costBreakdown || { period: 'today', totalCost: 0, dailyCosts: [], byProvider: {} };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Live Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Live Calls (Last 5 min) */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Activity size={20} className="opacity-80" />
            <span className="text-xs font-bold opacity-80 uppercase">Last 5 Min</span>
          </div>
          <div className="text-3xl font-bold mb-1">{safeLiveUsage.calls || 0}</div>
          <div className="text-sm opacity-80">LLM Calls</div>
          <div className="text-xs opacity-70 mt-2">
            {safeLiveUsage.rate ? `${safeLiveUsage.rate.toFixed(1)} calls/min` : '0 calls/min'}
          </div>
        </div>

        {/* Live Tokens (Last 5 min) */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Brain size={20} className="opacity-80" />
            <span className="text-xs font-bold opacity-80 uppercase">Last 5 Min</span>
          </div>
          <div className="text-3xl font-bold mb-1">{formatNumber(safeLiveUsage.tokens || 0)}</div>
          <div className="text-sm opacity-80">Tokens Used</div>
          <div className="text-xs opacity-70 mt-2">
            {safeLiveUsage.tokens ? `${formatNumber(safeLiveUsage.tokens / 5)} tokens/min` : '0 tokens/min'}
          </div>
        </div>

        {/* Today's Total Cost */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={20} className="opacity-80" />
            <span className="text-xs font-bold opacity-80 uppercase">Today</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {formatCurrency(safeCostBreakdown.totalCost || 0)}
          </div>
          <div className="text-sm opacity-80">Total Cost</div>
          <div className="text-xs opacity-70 mt-2">
            {safeTodayStats.totalCalls || 0} calls today
          </div>
        </div>

        {/* Live Cost (Last 5 min) */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Zap size={20} className="opacity-80" />
            <span className="text-xs font-bold opacity-80 uppercase">Last 5 Min</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {formatCurrency(safeLiveUsage.cost || 0)}
          </div>
          <div className="text-sm opacity-80">Live Cost</div>
          <div className="text-xs opacity-70 mt-2">
            {safeLiveUsage.cost ? `${formatCurrency(safeLiveUsage.cost / 5)}/min` : '$0.0000/min'}
          </div>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Usage Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={20} />
              Today's Usage
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={12} />
              <span>Updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
          
          {todayStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Total Calls</div>
                  <div className="text-2xl font-bold text-slate-800">{todayStats.totalCalls.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Total Tokens</div>
                  <div className="text-2xl font-bold text-slate-800">{formatNumber(todayStats.totalTokens)}</div>
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                <div className="text-xs font-bold text-slate-500 uppercase mb-3">Token Breakdown</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Input Tokens</span>
                    <span className="font-semibold text-slate-800">{formatNumber(todayStats.inputTokens)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Output Tokens</span>
                    <span className="font-semibold text-slate-800">{formatNumber(todayStats.outputTokens)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Usage by Provider */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Brain size={20} />
            Usage by Provider
          </h3>
          
          {todayStats && todayStats.byProvider && Object.keys(todayStats.byProvider).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(todayStats.byProvider)
                .sort(([, a], [, b]) => b.cost - a.cost)
                .map(([provider, data]) => (
                  <div key={provider} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-slate-800 capitalize">{provider}</span>
                      <span className="text-sm font-bold text-emerald-600">{formatCurrency(data.cost)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{data.calls} calls</span>
                      <span>{formatNumber(data.tokens)} tokens</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No usage data available</div>
          )}
        </div>
      </div>

      {/* Voice Conversation Usage */}
      {todayStats && todayStats.recentCalls && todayStats.recentCalls.length > 0 && (
        (() => {
          const voiceCalls = todayStats.recentCalls.filter(c => 
            c.requestType === 'voice' || c.requestType === 'voice-conversation'
          );
          if (voiceCalls.length === 0) return null;
          
          const voiceStats = voiceCalls.reduce((acc, call) => {
            acc.calls += 1;
            acc.tokens += call.inputTokens + call.outputTokens;
            acc.cost += call.totalCost;
            return acc;
          }, { calls: 0, tokens: 0, cost: 0 });
          
          return (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Activity size={20} className="text-purple-600" />
                Voice Conversation Usage (Today)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <p className="text-sm text-slate-500 mb-1">Voice Calls</p>
                  <p className="text-2xl font-bold text-purple-600">{voiceStats.calls}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <p className="text-sm text-slate-500 mb-1">Tokens</p>
                  <p className="text-2xl font-bold text-purple-600">{formatNumber(voiceStats.tokens)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <p className="text-sm text-slate-500 mb-1">Cost</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(voiceStats.cost)}</p>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Usage by Model */}
      {liveUsage && liveUsage.byModel && Object.keys(liveUsage.byModel).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Zap size={20} />
            Live Usage by Model (Last 5 Min)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(liveUsage.byModel)
              .sort(([, a], [, b]) => b.calls - a.calls)
              .map(([modelId, data]) => (
                <div key={modelId} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-sm">{modelId}</span>
                    <span className="text-xs px-2 py-1 bg-slate-200 rounded text-slate-600 capitalize">
                      {data.provider}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Calls:</span>
                      <span className="font-semibold text-slate-700">{data.calls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tokens:</span>
                      <span className="font-semibold text-slate-700">{formatNumber(data.tokens)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cost:</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(data.cost)}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default LiveLLMUsage;

