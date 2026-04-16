/**
 * Agent Health Monitoring Component
 * Monitors agent health metrics and performance
 */

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, BarChart3 } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface AgentHealthMonitoringProps {
  projectId?: string;
  agentId?: string;
  agentRole?: string;
}

interface AgentHealthMetrics {
  agentId: string;
  agentRole: string;
  healthScore: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  totalExecutions: number;
  recentErrors: Array<{
    timestamp: Date;
    error: string;
    taskId: string;
  }>;
  trends: {
    healthScore: 'improving' | 'stable' | 'degrading';
    successRate: 'improving' | 'stable' | 'degrading';
    executionTime: 'improving' | 'stable' | 'degrading';
  };
  issues: string[];
}

const AgentHealthMonitoring: React.FC<AgentHealthMonitoringProps> = ({ projectId, agentId, agentRole }) => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<AgentHealthMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Feature flag: backend endpoint not yet implemented (TODO #44)
  const isBackendAvailable = false;

  useEffect(() => {
    if (isBackendAvailable && (agentId || agentRole)) {
      loadMetrics();
    }
  }, [agentId, agentRole, projectId]);

  const loadMetrics = async () => {
    if (!isBackendAvailable) return;
    setLoading(true);
    try {
      // TODO(#44): Implement GET /api/agents/:agentId/health
      setMetrics(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load agent health metrics');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'degrading': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Agent Health Monitoring</h2>
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
          <p className="text-gray-600">Loading agent health metrics...</p>
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          <div className={`p-6 rounded-lg border-2 ${getHealthColor(metrics.healthScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium mb-1">Health Score</div>
                <div className="text-4xl font-bold">{metrics.healthScore.toFixed(1)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Agent: {metrics.agentRole}</div>
                <div className="text-xs text-gray-500">{metrics.agentId}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{(metrics.successRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-green-600">Success Rate</div>
              <div className="mt-1">{getTrendIcon(metrics.trends.successRate)}</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metrics.averageExecutionTime}ms</div>
              <div className="text-sm text-blue-600">Avg Execution Time</div>
              <div className="mt-1">{getTrendIcon(metrics.trends.executionTime)}</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{(metrics.errorRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-red-600">Error Rate</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{metrics.totalExecutions}</div>
              <div className="text-sm text-gray-600">Total Executions</div>
            </div>
          </div>

          {metrics.issues.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-yellow-800">Issues Detected</span>
              </div>
              <ul className="list-disc list-inside text-sm text-yellow-700">
                {metrics.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {metrics.recentErrors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Recent Errors</h3>
              <div className="space-y-2">
                {metrics.recentErrors.map((error, i) => (
                  <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm font-medium text-red-800">{error.error}</div>
                    <div className="text-xs text-red-600 mt-1">
                      {new Date(error.timestamp).toLocaleString()} • Task: {error.taskId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {!isBackendAvailable ? (
            <>
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="font-medium text-gray-600">Agent health monitoring is coming soon.</p>
              <p className="text-sm mt-2">The backend integration is currently under development.</p>
            </>
          ) : (
            <>
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p>No agent health data available.</p>
              <p className="text-sm mt-2">Select an agent to view health metrics.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentHealthMonitoring;



