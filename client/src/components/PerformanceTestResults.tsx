/**
 * Performance Test Results Component
 * Displays k6 performance test results (load, stress, spike, endurance)
 */

import React, { useState, useEffect } from 'react';
import { Zap, Activity, TrendingUp, Clock, Users, AlertTriangle, Download, RefreshCw, Play } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface PerformanceTestResultsProps {
  projectId: string;
}

interface PerformanceTest {
  id: string;
  name: string;
  type: 'load' | 'stress' | 'spike' | 'endurance';
  status: 'passed' | 'failed' | 'running';
  metrics: {
    requestsPerSecond: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
    virtualUsers: number;
    duration: number;
  };
  thresholds: Array<{
    metric: string;
    threshold: string;
    passed: boolean;
  }>;
  executedAt: Date;
}

const PerformanceTestResults: React.FC<PerformanceTestResultsProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<PerformanceTest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadTests();
  }, [projectId]);

  const loadTests = async () => {
    setLoading(true);
    try {
      // TODO(#44): Implement GET /api/projects/:projectId/performance-tests when backend is ready
      setTests([]);
      setError('Performance test results are not yet available. The backend endpoint is pending implementation.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load test results');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'load': return 'bg-blue-100 text-blue-800';
      case 'stress': return 'bg-red-100 text-red-800';
      case 'spike': return 'bg-orange-100 text-orange-800';
      case 'endurance': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTests = tests.filter(test => filterType === 'all' || test.type === filterType);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">Performance Test Results</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTests}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          <option value="load">Load Tests</option>
          <option value="stress">Stress Tests</option>
          <option value="spike">Spike Tests</option>
          <option value="endurance">Endurance Tests</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading test results...</p>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No performance test results available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTests.map((test, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-semibold text-lg">{test.name}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(test.executedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(test.type)}`}>
                    {test.type.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    test.status === 'passed' ? 'bg-green-100 text-green-800' :
                    test.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {test.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-600">Requests/sec</div>
                  <div className="text-lg font-semibold">{test.metrics.requestsPerSecond.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Avg Response</div>
                  <div className="text-lg font-semibold">{test.metrics.averageResponseTime}ms</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">P95 Response</div>
                  <div className="text-lg font-semibold">{test.metrics.p95ResponseTime}ms</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Error Rate</div>
                  <div className={`text-lg font-semibold ${test.metrics.errorRate > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {test.metrics.errorRate.toFixed(2)}%
                  </div>
                </div>
              </div>

              {test.thresholds.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Thresholds:</div>
                  <div className="space-y-1">
                    {test.thresholds.map((threshold, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {threshold.passed ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                        <span>{threshold.metric}: {threshold.threshold}</span>
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

export default PerformanceTestResults;



