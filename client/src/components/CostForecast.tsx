'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  AlertTriangle,
  Calendar,
  BarChart3,
  RefreshCw,
  Sliders,
  Play,
  ChevronDown,
  ChevronUp,
  PieChart,
  Zap,
} from 'lucide-react';
import { getCostForecast, getWhatIfScenario, CostForecast as ICostForecast } from '../services/routerEnhancedApi';

interface CostForecastProps {
  token?: string;
}

interface WhatIfScenario {
  modelChanges?: { [modelId: string]: { enabled: boolean; trafficPercent?: number } };
  tierChanges?: { [taskType: string]: string };
  trafficChange?: number;
}

interface WhatIfResult {
  currentProjected: number;
  scenarioProjected: number;
  difference: number;
  percentChange: number;
  breakdown?: Array<{ factor: string; impact: number }>;
}

export default function CostForecastComponent({ token }: CostForecastProps) {
  const [forecast, setForecast] = useState<ICostForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const [runningWhatIf, setRunningWhatIf] = useState(false);
  
  // What-if scenario state
  const [trafficChange, setTrafficChange] = useState(0);
  const [selectedTier, setSelectedTier] = useState<string>('standard');

  const fetchForecast = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getCostForecast(days, token);
      setForecast(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch forecast');
    } finally {
      setLoading(false);
    }
  }, [days, token]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const runWhatIfScenario = async () => {
    try {
      setRunningWhatIf(true);
      const scenario: WhatIfScenario = {};
      
      if (trafficChange !== 0) {
        scenario.trafficChange = trafficChange;
      }
      
      if (selectedTier !== 'standard') {
        scenario.tierChanges = { 'code-generation': selectedTier };
      }
      
      const result = await getWhatIfScenario(scenario, token);
      setWhatIfResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to run scenario');
    } finally {
      setRunningWhatIf(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-green-500" />;
      default:
        return <Minus className="w-5 h-5 text-slate-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      default:
        return 'text-slate-600';
    }
  };

  const renderChart = () => {
    if (!forecast?.historicalData || forecast.historicalData.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-slate-400">
          No historical data available
        </div>
      );
    }

    const data = forecast.historicalData;
    const maxCost = Math.max(...data.map(d => d.cost), 0.01);
    const chartWidth = 100;
    const chartHeight = 48;

    return (
      <div className="relative h-48">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={chartHeight - (y / 100) * chartHeight}
              x2={chartWidth}
              y2={chartHeight - (y / 100) * chartHeight}
              stroke="#e2e8f0"
              strokeWidth="0.2"
            />
          ))}

          {/* Area fill */}
          <path
            d={`
              M 0 ${chartHeight}
              ${data.map((d, i) => {
                const x = (i / (data.length - 1)) * chartWidth;
                const y = chartHeight - (d.cost / maxCost) * chartHeight;
                return `L ${x} ${y}`;
              }).join(' ')}
              L ${chartWidth} ${chartHeight}
              Z
            `}
            fill="url(#gradient)"
            opacity="0.3"
          />

          {/* Line */}
          <path
            d={`
              M ${data.map((d, i) => {
                const x = (i / (data.length - 1)) * chartWidth;
                const y = chartHeight - (d.cost / maxCost) * chartHeight;
                return `${i === 0 ? '' : 'L '}${x} ${y}`;
              }).join(' ')}
            `}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.5"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-400 px-2">
          <span>{data[0]?.date?.slice(5)}</span>
          <span>{data[Math.floor(data.length / 2)]?.date?.slice(5)}</span>
          <span>{data[data.length - 1]?.date?.slice(5)}</span>
        </div>
      </div>
    );
  };

  if (loading && !forecast) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Cost Forecasting
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Projected costs and trend analysis
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>

          <button
            onClick={fetchForecast}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Projections */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Daily Projected</p>
              <p className="text-xl font-bold text-slate-800">
                {formatCurrency(forecast?.projectedDaily || 0)}
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
              <p className="text-xs text-slate-500">Weekly Projected</p>
              <p className="text-xl font-bold text-slate-800">
                {formatCurrency(forecast?.projectedWeekly || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Monthly Projected</p>
              <p className="text-xl font-bold text-slate-800">
                {formatCurrency(forecast?.projectedMonthly || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              {getTrendIcon(forecast?.trend || 'stable')}
            </div>
            <div>
              <p className="text-xs text-slate-500">Trend</p>
              <p className={`text-xl font-bold capitalize ${getTrendColor(forecast?.trend || 'stable')}`}>
                {forecast?.trend || 'Stable'}
              </p>
              <p className="text-xs text-slate-400">
                {forecast?.trendPercent?.toFixed(1)}% change
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Historical Cost Trend</h3>
          <span className="text-xs text-slate-500">
            Confidence: {(forecast?.confidence || 0).toFixed(0)}%
          </span>
        </div>
        {renderChart()}
      </div>

      {/* What-If Simulator */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowWhatIf(!showWhatIf)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-slate-800">What-If Scenario Simulator</span>
          </div>
          {showWhatIf ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showWhatIf && (
          <div className="border-t border-slate-200 p-6 space-y-6">
            <p className="text-sm text-slate-500">
              Simulate how changes to your configuration would affect costs
            </p>

            <div className="grid grid-cols-2 gap-6">
              {/* Traffic change */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Traffic Change
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={-50}
                    max={100}
                    value={trafficChange}
                    onChange={(e) => setTrafficChange(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className={`w-16 text-right font-medium ${
                    trafficChange > 0 ? 'text-red-600' : trafficChange < 0 ? 'text-green-600' : 'text-slate-600'
                  }`}>
                    {trafficChange > 0 ? '+' : ''}{trafficChange}%
                  </span>
                </div>
              </div>

              {/* Tier selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Default Tier
                </label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="economy">Economy (50% cost)</option>
                  <option value="standard">Standard (100% cost)</option>
                  <option value="premium">Premium (200% cost)</option>
                </select>
              </div>
            </div>

            <button
              onClick={runWhatIfScenario}
              disabled={runningWhatIf}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {runningWhatIf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Scenario
                </>
              )}
            </button>

            {/* Results */}
            {whatIfResult && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-800 mb-4">Scenario Results</h4>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Current Projected</p>
                    <p className="text-lg font-bold text-slate-800">
                      {formatCurrency(whatIfResult.currentProjected)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Scenario Projected</p>
                    <p className={`text-lg font-bold ${
                      whatIfResult.difference > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(whatIfResult.scenarioProjected)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Difference</p>
                    <p className={`text-lg font-bold ${
                      whatIfResult.difference > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {whatIfResult.difference > 0 ? '+' : ''}
                      {formatCurrency(whatIfResult.difference)}
                      <span className="text-sm ml-1">
                        ({whatIfResult.percentChange > 0 ? '+' : ''}
                        {whatIfResult.percentChange.toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                </div>

                {whatIfResult.breakdown && whatIfResult.breakdown.length > 0 && (
                  <div className="border-t border-slate-200 pt-4">
                    <h5 className="text-sm font-medium text-slate-700 mb-2">Impact Breakdown</h5>
                    <div className="space-y-2">
                      {whatIfResult.breakdown.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{item.factor}</span>
                          <span className={item.impact > 0 ? 'text-red-600' : 'text-green-600'}>
                            {item.impact > 0 ? '+' : ''}{formatCurrency(item.impact)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Anomalies section would go here */}
      {forecast?.anomalies && forecast.anomalies.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Cost Anomalies Detected
          </h3>
          <div className="space-y-3">
            {forecast.anomalies.map((anomaly, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  anomaly.severity === 'high'
                    ? 'bg-red-50 border-red-200'
                    : anomaly.severity === 'medium'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    {anomaly.date}
                  </span>
                  <span className={`text-sm font-bold ${
                    anomaly.severity === 'high'
                      ? 'text-red-600'
                      : anomaly.severity === 'medium'
                      ? 'text-orange-600'
                      : 'text-yellow-600'
                  }`}>
                    {formatCurrency(anomaly.cost)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Z-Score: {anomaly.zScore.toFixed(2)} | Deviation: {anomaly.deviation?.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

