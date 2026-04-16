/**
 * Security Scan Results Component
 * Displays SAST/DAST security scan results
 */

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, Download, Filter, Zap } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface SecurityScanResultsProps {
  projectId: string;
  artifactId?: string;
}

interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  title: string;
  description: string;
  location?: {
    file: string;
    line: number;
    column?: number;
  };
  recommendation: string;
  tool: 'sonarqube' | 'snyk' | 'trivy' | 'llm';
  cwe?: string;
  cve?: string;
}

interface SecurityScanResult {
  scanId: string;
  artifactId?: string;
  language: string;
  tools: string[];
  issues: SecurityIssue[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  scannedAt: Date;
}

const SecurityScanResults: React.FC<SecurityScanResultsProps> = ({ projectId, artifactId }) => {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<SecurityScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterTool, setFilterTool] = useState<string>('all');
  // Feature flag: backend endpoint not yet implemented (TODO #44)
  const isBackendAvailable = false;

  useEffect(() => {
    if (isBackendAvailable) {
      loadScans();
    }
  }, [projectId, artifactId]);

  const loadScans = async () => {
    if (!isBackendAvailable) return;
    setLoading(true);
    try {
      // TODO(#44): Implement GET /api/projects/:projectId/security-scans
      setResults([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load scan results');
    } finally {
      setLoading(false);
    }
  };

  const runScan = async (_tools: string[] = ['llm']) => {
    if (!isBackendAvailable) return;
    setScanning(true);
    try {
      // TODO(#44): Implement POST /api/projects/:projectId/security-scans
    } finally {
      setScanning(false);
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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'low': return <CheckCircle className="w-5 h-5 text-blue-600" />;
      default: return <CheckCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const allIssues = results.flatMap(r => r.issues);
  const filteredIssues = allIssues.filter(issue => {
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    if (filterTool !== 'all' && issue.tool !== filterTool) return false;
    return true;
  });

  const totalSummary = results.reduce((acc, result) => ({
    total: acc.total + result.summary.total,
    critical: acc.critical + result.summary.critical,
    high: acc.high + result.summary.high,
    medium: acc.medium + result.summary.medium,
    low: acc.low + result.summary.low,
    info: acc.info + result.summary.info
  }), { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 });

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Security Scan Results</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runScan(['snyk', 'trivy', 'llm'])}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run Scan
              </>
            )}
          </button>
          <button
            onClick={loadScans}
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

      {/* Summary */}
      {totalSummary.total > 0 && (
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{totalSummary.total}</div>
            <div className="text-sm text-gray-600">Total Issues</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{totalSummary.critical}</div>
            <div className="text-sm text-red-600">Critical</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{totalSummary.high}</div>
            <div className="text-sm text-orange-600">High</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{totalSummary.medium}</div>
            <div className="text-sm text-yellow-600">Medium</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{totalSummary.low}</div>
            <div className="text-sm text-blue-600">Low</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{results.length}</div>
            <div className="text-sm text-green-600">Scans</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <select
          value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Tools</option>
          <option value="sonarqube">SonarQube</option>
          <option value="snyk">Snyk</option>
          <option value="trivy">Trivy</option>
          <option value="llm">LLM</option>
        </select>
      </div>

      {/* Issues List */}
      {!isBackendAvailable && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <p className="text-sm text-blue-800">
            Security scanning is coming soon. The backend integration is currently under development.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading scan results...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {totalSummary.total === 0 ? (
            <>
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No scan results available.</p>
              {isBackendAvailable && (
                <p className="text-sm mt-2">Click "Run Scan" to perform a security scan.</p>
              )}
            </>
          ) : (
            <p>No issues match the selected filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue, index) => (
            <div
              key={index}
              className={`p-4 border-2 rounded-lg ${getSeverityColor(issue.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getSeverityIcon(issue.severity)}
                  <div>
                    <div className="font-semibold">{issue.title}</div>
                    <div className="text-xs text-gray-600">
                      {issue.type} • {issue.tool}
                      {issue.cwe && ` • CWE-${issue.cwe}`}
                      {issue.cve && ` • ${issue.cve}`}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(issue.severity)}`}>
                  {issue.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-sm mb-3">{issue.description}</p>
              {issue.location && (
                <div className="text-xs text-gray-600 mb-2">
                  Location: {issue.location.file}:{issue.location.line}
                  {issue.location.column && `:${issue.location.column}`}
                </div>
              )}
              <div className="p-2 bg-white/50 rounded text-sm">
                <span className="font-medium">Recommendation:</span> {issue.recommendation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecurityScanResults;



