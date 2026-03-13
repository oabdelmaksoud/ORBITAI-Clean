/**
 * Non-Functional Requirements Tracing Dashboard
 * Tracks and visualizes NFRs (performance, security, scalability, etc.)
 */

import React, { useState, useEffect } from 'react';
import { Target, Zap, Shield, TrendingUp, Activity, CheckCircle, AlertTriangle, XCircle, Download, RefreshCw } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface NFRTracingDashboardProps {
  projectId: string;
}

interface NFRTrace {
  requirementId: string;
  requirementTitle: string;
  nfrCategory: 'performance' | 'security' | 'scalability' | 'reliability' | 'usability' | 'maintainability' | 'compatibility';
  nfrMetrics: {
    target?: string;
    actual?: string;
    unit?: string;
  };
  tracedArtifacts: Array<{
    artifactId: string;
    artifactType: 'code' | 'test' | 'monitoring' | 'documentation';
    artifactName: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
  coverage: {
    total: number;
    covered: number;
    percentage: number;
  };
  status: 'met' | 'partial' | 'not_met' | 'not_tested';
}

interface NFRTraceReport {
  nfrs: NFRTrace[];
  summary: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    coverage: {
      total: number;
      covered: number;
      percentage: number;
    };
  };
  gaps: Array<{
    nfrId: string;
    missingArtifactTypes: string[];
  }>;
}

const NFRTracingDashboard: React.FC<NFRTracingDashboardProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<NFRTraceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadNFRs();
  }, [projectId]);

  const loadNFRs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.get(`/requirements/${projectId}/nfr`);
      if (response.data?.success) {
        setReport(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to load NFR tracing data');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load NFR tracing data');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'security': return <Shield className="w-5 h-5 text-red-500" />;
      case 'scalability': return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'reliability': return <Activity className="w-5 h-5 text-green-500" />;
      case 'usability': return <Target className="w-5 h-5 text-purple-500" />;
      case 'maintainability': return <CheckCircle className="w-5 h-5 text-indigo-500" />;
      case 'compatibility': return <Activity className="w-5 h-5 text-pink-500" />;
      default: return <Target className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'performance': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'security': return 'bg-red-50 border-red-200 text-red-800';
      case 'scalability': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'reliability': return 'bg-green-50 border-green-200 text-green-800';
      case 'usability': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'maintainability': return 'bg-indigo-50 border-indigo-200 text-indigo-800';
      case 'compatibility': return 'bg-pink-50 border-pink-200 text-pink-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'met': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'partial': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'not_met': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'met': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'not_met': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredNFRs = report?.nfrs.filter(nfr => {
    if (filterCategory !== 'all' && nfr.nfrCategory !== filterCategory) return false;
    if (filterStatus !== 'all' && nfr.status !== filterStatus) return false;
    return true;
  }) || [];

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Non-Functional Requirements Tracing</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadNFRs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {report && (
            <button
              onClick={() => {
                const dataStr = JSON.stringify(report, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nfr-tracing-${projectId}-${Date.now()}.json`;
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading NFR tracing data...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{report.summary.coverage.percentage.toFixed(1)}%</div>
              <div className="text-sm text-blue-600">Coverage</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{report.summary.total}</div>
              <div className="text-sm text-gray-600">Total NFRs</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{report.summary.byStatus.met || 0}</div>
              <div className="text-sm text-green-600">Met</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{report.summary.byStatus.not_met || 0}</div>
              <div className="text-sm text-red-600">Not Met</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Categories</option>
              <option value="performance">Performance</option>
              <option value="security">Security</option>
              <option value="scalability">Scalability</option>
              <option value="reliability">Reliability</option>
              <option value="usability">Usability</option>
              <option value="maintainability">Maintainability</option>
              <option value="compatibility">Compatibility</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="met">Met</option>
              <option value="partial">Partial</option>
              <option value="not_met">Not Met</option>
              <option value="not_tested">Not Tested</option>
            </select>
          </div>

          {/* Gaps Warning */}
          {report.gaps.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="font-semibold text-yellow-800 mb-2">Tracing Gaps Detected</div>
              <div className="text-sm text-yellow-700">
                {report.gaps.length} NFRs are missing links to artifacts
              </div>
            </div>
          )}

          {/* NFR List */}
          <div className="space-y-4">
            {filteredNFRs.map((nfr, index) => (
              <div
                key={index}
                className={`p-4 border-2 rounded-lg ${getCategoryColor(nfr.nfrCategory)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getCategoryIcon(nfr.nfrCategory)}
                    <div>
                      <div className="font-semibold">{nfr.requirementTitle}</div>
                      <div className="text-xs opacity-75">{nfr.requirementId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(nfr.status)}
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(nfr.status)}`}>
                      {nfr.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                {nfr.nfrMetrics.target && (
                  <div className="mb-3 p-2 bg-white/50 rounded text-sm">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="font-medium">Target:</span> {nfr.nfrMetrics.target} {nfr.nfrMetrics.unit || ''}
                      </div>
                      {nfr.nfrMetrics.actual && (
                        <div>
                          <span className="font-medium">Actual:</span> {nfr.nfrMetrics.actual} {nfr.nfrMetrics.unit || ''}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Traced Artifacts */}
                {nfr.tracedArtifacts.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-2">Traced Artifacts ({nfr.tracedArtifacts.length}):</div>
                    <div className="flex flex-wrap gap-2">
                      {nfr.tracedArtifacts.map((artifact, i) => (
                        <div
                          key={i}
                          className="px-2 py-1 bg-white/50 rounded text-xs"
                        >
                          {artifact.artifactName} ({artifact.artifactType})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coverage */}
                <div className="mt-3 text-xs opacity-75">
                  Coverage: {nfr.coverage.covered}/{nfr.coverage.total} ({nfr.coverage.percentage.toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No NFR tracing data available. NFRs will be traced automatically from requirements.
        </div>
      )}
    </div>
  );
};

export default NFRTracingDashboard;



