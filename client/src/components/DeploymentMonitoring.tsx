/**
 * Deployment Monitoring Component
 * Monitors post-deployment health, logs, and metrics
 */

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface DeploymentMonitoringProps {
  deploymentId: string;
}

interface MonitoringMetrics {
  deploymentId: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  healthScore: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
  alerts: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: Date;
  }>;
}

const DeploymentMonitoring: React.FC<DeploymentMonitoringProps> = ({ deploymentId }) => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [deploymentId]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setMetrics(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load monitoring metrics');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'unhealthy': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Deployment Monitoring</h2>
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
          <p className="text-gray-600">Loading monitoring metrics...</p>
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          <div className={`p-6 rounded-lg border-2 ${getHealthColor(metrics.healthStatus)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getHealthIcon(metrics.healthStatus)}
                <div>
                  <div className="text-sm font-medium mb-1">Health Status</div>
                  <div className="text-3xl font-bold">{metrics.healthScore.toFixed(1)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Status</div>
                <div className={`text-lg font-bold ${getHealthColor(metrics.healthStatus).split(' ')[1]}`}>
                  {metrics.healthStatus.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metrics.responseTime}ms</div>
              <div className="text-sm text-blue-600">Response Time</div>
            </div>
            <div className={`p-4 rounded-lg ${metrics.errorRate > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className={`text-2xl font-bold ${metrics.errorRate > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {(metrics.errorRate * 100).toFixed(2)}%
              </div>
              <div className={`text-sm ${metrics.errorRate > 0 ? 'text-red-600' : 'text-green-600'}`}>Error Rate</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{metrics.throughput}</div>
              <div className="text-sm text-green-600">Throughput</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{metrics.alerts.length}</div>
              <div className="text-sm text-gray-600">Active Alerts</div>
            </div>
          </div>

          {metrics.alerts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Alerts</h3>
              <div className="space-y-2">
                {metrics.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${
                      alert.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                      alert.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                      'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No monitoring data available.</p>
        </div>
      )}
    </div>
  );
};

export default DeploymentMonitoring;



