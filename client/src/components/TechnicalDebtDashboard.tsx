/**
 * Technical Debt Dashboard Component
 * Tracks and visualizes technical debt across the project
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Code, Shield, Zap, Database, FileText, TrendingUp, Filter, Download, RefreshCw, CheckCircle, Clock, XCircle } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface TechnicalDebtDashboardProps {
  projectId: string;
}

interface TechnicalDebt {
  _id: string;
  category: 'code_quality' | 'missing_tests' | 'security' | 'performance' | 'architecture' | 'documentation' | 'dependencies';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
  estimatedEffort: number;
  debtScore: number;
  status: 'open' | 'in_progress' | 'resolved' | 'deferred';
  createdAt: Date;
  resolvedAt?: Date;
}

interface TechnicalDebtReport {
  totalDebt: number;
  totalItems: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  trends: Array<{
    date: string;
    totalDebt: number;
    items: number;
  }>;
  remediationPriorities: Array<{
    debtId: string;
    priority: number;
    reason: string;
  }>;
  estimatedTotalEffort: number;
}

const TechnicalDebtDashboard: React.FC<TechnicalDebtDashboardProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [debts, setDebts] = useState<TechnicalDebt[]>([]);
  const [report, setReport] = useState<TechnicalDebtReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    category?: string;
    severity?: string;
    status?: string;
  }>({});

  useEffect(() => {
    loadDebts();
    loadReport();
  }, [projectId]);

  const loadDebts = async () => {
    setLoading(true);
    try {
      const response = await projectsApi.get(`/technical-debt/${projectId}`);
      if (response.data?.success) {
        setDebts(response.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load technical debt');
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    try {
      const response = await projectsApi.get(`/technical-debt/${projectId}/report`);
      if (response.data?.success) {
        setReport(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load report:', err);
    }
  };

  const identifyDebt = async (artifactId?: string) => {
    setIdentifying(true);
    setError(null);
    try {
      const response = await projectsApi.post(`/technical-debt/${projectId}/identify`, {
        artifactId
      });
      if (response.data?.success) {
        await loadDebts();
        await loadReport();
      } else {
        setError(response.data?.error || 'Failed to identify technical debt');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to identify technical debt');
    } finally {
      setIdentifying(false);
    }
  };

  const resolveDebt = async (debtId: string) => {
    try {
      const response = await projectsApi.post(`/technical-debt/${debtId}/resolve`, {
        resolution: 'Resolved via UI'
      });
      if (response.data?.success) {
        await loadDebts();
        await loadReport();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to resolve debt');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'code_quality': return <Code className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'architecture': return <Database className="w-4 h-4" />;
      case 'documentation': return <FileText className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'deferred': return <XCircle className="w-4 h-4 text-gray-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    }
  };

  const filteredDebts = debts.filter(debt => {
    if (filter.category && debt.category !== filter.category) return false;
    if (filter.severity && debt.severity !== filter.severity) return false;
    if (filter.status && debt.status !== filter.status) return false;
    return true;
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900">Technical Debt Dashboard</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => identifyDebt()}
            disabled={identifying}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {identifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Identifying...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Identify Debt
              </>
            )}
          </button>
          <button
            onClick={() => {
              const dataStr = JSON.stringify({ debts, report }, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `technical-debt-${projectId}-${Date.now()}.json`;
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      {report && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{report.totalDebt.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Total Debt Score</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{report.totalItems}</div>
            <div className="text-sm text-blue-600">Total Items</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{report.bySeverity.critical || 0}</div>
            <div className="text-sm text-orange-600">Critical Items</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{report.estimatedTotalEffort}h</div>
            <div className="text-sm text-green-600">Est. Effort</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={filter.category || ''}
          onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Categories</option>
          <option value="code_quality">Code Quality</option>
          <option value="missing_tests">Missing Tests</option>
          <option value="security">Security</option>
          <option value="performance">Performance</option>
          <option value="architecture">Architecture</option>
          <option value="documentation">Documentation</option>
          <option value="dependencies">Dependencies</option>
        </select>
        <select
          value={filter.severity || ''}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value || undefined })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filter.status || ''}
          onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="deferred">Deferred</option>
        </select>
      </div>

      {/* Debt List */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading technical debt...</p>
        </div>
      ) : filteredDebts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No technical debt items found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map((debt) => (
            <div
              key={debt._id}
              className={`p-4 border-2 rounded-lg ${getSeverityColor(debt.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(debt.category)}
                  <div>
                    <div className="font-medium">{debt.description}</div>
                    {debt.location && (
                      <div className="text-xs text-gray-600">{debt.location}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(debt.severity)}`}>
                    {debt.severity.toUpperCase()}
                  </span>
                  {getStatusIcon(debt.status)}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm">
                  <span className="font-medium">Debt Score:</span> {debt.debtScore.toFixed(1)} |{' '}
                  <span className="font-medium">Effort:</span> {debt.estimatedEffort}h
                </div>
                {debt.status === 'open' && (
                  <button
                    onClick={() => resolveDebt(debt._id)}
                    className="px-3 py-1 text-sm text-green-600 bg-green-50 rounded hover:bg-green-100"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Remediation Priorities */}
      {report && report.remediationPriorities.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Remediation Priorities</h3>
          <div className="space-y-2">
            {report.remediationPriorities.slice(0, 5).map((priority, index) => {
              const debt = debts.find(d => d._id === priority.debtId);
              if (!debt) return null;
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{debt.description}</div>
                    <div className="text-xs text-gray-600">{priority.reason}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalDebtDashboard;



