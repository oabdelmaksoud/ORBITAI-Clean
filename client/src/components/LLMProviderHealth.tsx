/**
 * LLM Provider Health Dashboard Component
 * Monitors LLM provider health, uptime, and performance
 */

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { apiRequest } from '@src/services/api';

interface LLMProviderHealthProps {
  provider?: string;
}

interface ProviderHealthMetrics {
  provider: string;
  healthScore: number;
  uptime: number;
  averageResponseTime: number;
  errorRate: number;
  rateLimitFrequency: number;
  totalRequests: number;
  recentErrors: Array<{
    timestamp: Date;
    error: string;
    statusCode?: number;
  }>;
  trends: {
    uptime: 'improving' | 'stable' | 'degrading';
    responseTime: 'improving' | 'stable' | 'degrading';
    errorRate: 'improving' | 'stable' | 'degrading';
  };
  status: 'healthy' | 'degraded' | 'unhealthy';
}

const LLMProviderHealth: React.FC<LLMProviderHealthProps> = ({ provider }) => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<ProviderHealthMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [provider]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const providerParam = provider ? '?provider=' + provider : '';
      const data = await apiRequest<ProviderHealthMetrics[]>(
        '/api/llmProviderHealth/provider-health' + providerParam
      );
      setMetrics(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load provider health');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'unhealthy': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'degrading': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const filteredMetrics = provider ? metrics.filter(m => m.provider === provider) : metrics;

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">LLM Provider Health</h2>
        </div>
        <button
          onClick={loadMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading provider health...</p>
        </div>
      ) : filteredMetrics.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No provider health data available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMetrics.map((metric, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(metric.status)}
                  <div>
                    <div className="font-semibold text-lg">{metric.provider.toUpperCase()}</div>
                    <div className={`text-2xl font-bold ${getHealthColor(metric.healthScore).split(' ')[0]}`}>
                      {metric.healthScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">Health Score</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Status</div>
                  <div className={`px-2 py-1 text-xs font-medium rounded ${
                    metric.status === 'healthy' ? 'bg-green-100 text-green-800' :
                    metric.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {metric.status.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div>
                  <div className="text-xs text-gray-600">Uptime</div>
                  <div className="text-lg font-semibold">{metric.uptime.toFixed(1)}%</div>
                  <div className="mt-1">{getTrendIcon(metric.trends.uptime)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Avg Response</div>
                  <div className="text-lg font-semibold">{metric.averageResponseTime}ms</div>
                  <div className="mt-1">{getTrendIcon(metric.trends.responseTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Error Rate</div>
                  <div className={`text-lg font-semibold ${metric.errorRate > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {(metric.errorRate * 100).toFixed(2)}%
                  </div>
                  <div className="mt-1">{getTrendIcon(metric.trends.errorRate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Rate Limits</div>
                  <div className="text-lg font-semibold">{(metric.rateLimitFrequency * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Total Requests</div>
                  <div className="text-lg font-semibold">{metric.totalRequests}</div>
                </div>
              </div>

              {metric.recentErrors.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Recent Errors:</div>
                  <div className="space-y-1">
                    {metric.recentErrors.slice(0, 3).map((err, i) => (
                      <div key={i} className="text-xs text-red-600 p-2 bg-red-50 rounded">
                        {err.error} {err.statusCode && `(${err.statusCode})`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LLMProviderHealth;



