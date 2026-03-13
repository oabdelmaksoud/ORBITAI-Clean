import React, { useState, useEffect } from 'react';
import { Activity, Database, AlertTriangle, CheckCircle, RefreshCw, Loader2, Clock, Zap, Server } from 'lucide-react';
import { getAPIMetrics, getSlowQueries, getSystemHealth, APIMetricsResponse, SlowQueriesResponse, SystemHealthResponse } from '../services/performanceApi';

interface PerformanceMonitoringProps {
  token: string;
}

const PerformanceMonitoring: React.FC<PerformanceMonitoringProps> = ({ token }) => {
  const [activeView, setActiveView] = useState<'api' | 'queries' | 'health'>('api');
  const [apiMetrics, setApiMetrics] = useState<APIMetricsResponse | null>(null);
  const [slowQueries, setSlowQueries] = useState<SlowQueriesResponse | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('1h');

  useEffect(() => {
    loadData();
  }, [activeView, timeRange, token]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      switch (activeView) {
        case 'api':
          const api = await getAPIMetrics(token, { timeRange });
          setApiMetrics(api);
          break;
        case 'queries':
          const queries = await getSlowQueries(token);
          setSlowQueries(queries);
          break;
        case 'health':
          const health = await getSystemHealth(token);
          setSystemHealth(health);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load performance data');
      console.error('Failed to load performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading && !apiMetrics && !slowQueries && !systemHealth) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-semibold">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'api', label: 'API Metrics', icon: Activity },
          { id: 'queries', label: 'Slow Queries', icon: Database },
          { id: 'health', label: 'System Health', icon: Server }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id as any)}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeView === view.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <view.icon size={16} className="inline mr-2" />
            {view.label}
          </button>
        ))}
        {activeView === 'api' && (
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="ml-auto px-3 py-2 text-sm border border-slate-300 rounded-lg"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        )}
        <button
          onClick={loadData}
          className="px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* API Metrics View */}
      {activeView === 'api' && apiMetrics && (
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Requests</p>
              <p className="text-xl font-bold text-slate-800">{apiMetrics.overall.totalRequests.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Errors</p>
              <p className="text-xl font-bold text-red-600">{apiMetrics.overall.totalErrors}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Success Rate</p>
              <p className="text-xl font-bold text-emerald-600">{apiMetrics.overall.successRate.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Avg Response</p>
              <p className="text-xl font-bold text-slate-800">{formatDuration(apiMetrics.overall.avgResponseTime)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">P95 Response</p>
              <p className="text-xl font-bold text-slate-800">{formatDuration(apiMetrics.overall.p95ResponseTime)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">P99 Response</p>
              <p className="text-xl font-bold text-slate-800">{formatDuration(apiMetrics.overall.p99ResponseTime)}</p>
            </div>
          </div>

          {/* Endpoint Stats */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">Endpoint Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Endpoint</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Requests</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Avg Response</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Min</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Max</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Errors</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Success Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {apiMetrics.endpoints.map((endpoint) => (
                    <tr key={`${endpoint.method} ${endpoint.endpoint}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded mr-2">{endpoint.method}</span>
                          <span className="text-sm text-slate-800">{endpoint.endpoint}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{endpoint.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{formatDuration(endpoint.avgResponseTime)}</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-sm">{formatDuration(endpoint.minResponseTime)}</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-sm">{formatDuration(endpoint.maxResponseTime)}</td>
                      <td className="px-4 py-3 text-right">
                        {endpoint.errorCount > 0 ? (
                          <span className="text-red-600 font-medium">{endpoint.errorCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${endpoint.successRate >= 99 ? 'text-emerald-600' : endpoint.successRate >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {endpoint.successRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Slow Queries View */}
      {activeView === 'queries' && slowQueries && (
        <div className="space-y-6">
          {slowQueries.message ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <p className="text-yellow-800">{slowQueries.message}</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Slow Queries</p>
                  <p className="text-xl font-bold text-slate-800">{slowQueries.summary.total}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Avg Duration</p>
                  <p className="text-xl font-bold text-slate-800">{formatDuration(slowQueries.summary.avgDuration)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Max Duration</p>
                  <p className="text-xl font-bold text-red-600">{formatDuration(slowQueries.summary.maxDuration)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Collections</p>
                  <p className="text-xl font-bold text-slate-800">{slowQueries.summary.byCollection.length}</p>
                </div>
              </div>

              {/* Slow Queries Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-slate-800">Slow Queries</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Collection</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {slowQueries.slowQueries.map((query, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-slate-800">{query.collection}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${query.duration > 1000 ? 'text-red-600' : 'text-orange-600'}`}>
                              {formatDuration(query.duration)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {new Date(query.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommendations */}
              {slowQueries.recommendations.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl">
                  <h3 className="font-bold text-blue-800 mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {slowQueries.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-blue-700">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* System Health View */}
      {activeView === 'health' && systemHealth && (
        <div className="space-y-6">
          {/* Database Status */}
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Database Status</h3>
              <div className="flex items-center gap-2">
                {systemHealth.database.isConnected ? (
                  <CheckCircle className="text-emerald-600" size={20} />
                ) : (
                  <AlertTriangle className="text-red-600" size={20} />
                )}
                <span className={`font-semibold ${systemHealth.database.isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                  {systemHealth.database.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Collections</p>
                <p className="text-xl font-bold text-slate-800">{systemHealth.database.totalCollections}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Documents</p>
                <p className="text-xl font-bold text-slate-800">{systemHealth.database.totalDocuments.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Top Collections</p>
                <div className="space-y-1 mt-2">
                  {systemHealth.database.collections.slice(0, 5).map((col) => (
                    <div key={col.name} className="flex justify-between text-sm">
                      <span className="text-slate-600">{col.name}</span>
                      <span className="font-medium text-slate-800">{col.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* API Status */}
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">API Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Metrics</p>
                <p className="text-xl font-bold text-slate-800">{systemHealth.api.totalMetrics.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Recent Errors</p>
                <p className="text-xl font-bold text-red-600">{systemHealth.api.recentErrors}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Avg Response Time</p>
                <p className="text-xl font-bold text-slate-800">{formatDuration(systemHealth.api.avgResponseTime)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitoring;
















