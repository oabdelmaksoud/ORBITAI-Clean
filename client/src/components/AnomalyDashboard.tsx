/**
 * Anomaly Dashboard Component
 * Displays detected anomalies with explanations
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, RefreshCw, Loader2, Info, TrendingUp,
  TrendingDown, Zap, DollarSign, XCircle, CheckCircle
} from 'lucide-react';
import {
  getAnomalies,
  Anomaly
} from '../services/adminLLMRouterAIApi';

interface AnomalyDashboardProps {
  token?: string;
}

const AnomalyDashboard: React.FC<AnomalyDashboardProps> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString()
  });

  useEffect(() => {
    loadAnomalies();
  }, [token, timeRange]);

  const loadAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAnomalies(token, timeRange);
      setAnomalies(result.anomalies || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  };

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'cost_spike':
        return <DollarSign className="text-red-600" size={20} />;
      case 'performance_degradation':
        return <TrendingDown className="text-orange-600" size={20} />;
      case 'error_spike':
        return <XCircle className="text-red-600" size={20} />;
      case 'unusual_pattern':
        return <AlertTriangle className="text-yellow-600" size={20} />;
      default:
        return <Info className="text-blue-600" size={20} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'warning':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'info':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      default:
        return 'bg-slate-100 border-slate-300 text-slate-800';
    }
  };

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const warningCount = anomalies.filter(a => a.severity === 'warning').length;
  const infoCount = anomalies.filter(a => a.severity === 'info').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-orange-600" size={20} />
          <h3 className="text-lg font-semibold text-slate-800">Anomaly Detection</h3>
        </div>
        <button
          onClick={loadAnomalies}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="text-red-600" size={18} />
            <span className="text-sm font-medium text-red-800">Critical</span>
          </div>
          <div className="text-2xl font-bold text-red-900">{criticalCount}</div>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="text-yellow-600" size={18} />
            <span className="text-sm font-medium text-yellow-800">Warnings</span>
          </div>
          <div className="text-2xl font-bold text-yellow-900">{warningCount}</div>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Info className="text-blue-600" size={18} />
            <span className="text-sm font-medium text-blue-800">Info</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{infoCount}</div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="ml-2 text-slate-600">Loading anomalies...</span>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p>No anomalies detected in the selected time range.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalies.map((anomaly, index) => (
            <div
              key={index}
              className={`p-4 border rounded-lg ${getSeverityColor(anomaly.severity)}`}
            >
              <div className="flex items-start gap-3">
                {getAnomalyIcon(anomaly.type)}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold mb-1">{anomaly.description}</h4>
                      <p className="text-sm opacity-90">
                        Detected: {new Date(anomaly.detectedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  
                  {anomaly.metrics && Object.keys(anomaly.metrics).length > 0 && (
                    <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs">
                      <p className="font-medium mb-1">Metrics:</p>
                      <ul className="space-y-1">
                        {Object.entries(anomaly.metrics).map(([key, value]) => (
                          <li key={key}>
                            <span className="font-medium">{key}:</span>{' '}
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {anomaly.suggestedAction && (
                    <div className="mt-2 p-2 bg-white bg-opacity-50 rounded">
                      <p className="text-xs font-medium mb-1">Suggested Action:</p>
                      <p className="text-xs">{anomaly.suggestedAction}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnomalyDashboard;

