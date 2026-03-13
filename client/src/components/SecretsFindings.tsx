/**
 * Secrets Findings Component
 * Displays hardcoded secrets and credentials detected in code
 */

import React, { useState, useEffect } from 'react';
import { Key, AlertTriangle, Shield, RefreshCw, Download, Eye, EyeOff } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface SecretsFindingsProps {
  projectId: string;
  artifactId?: string;
}

interface SecretFinding {
  id: string;
  type: 'api_key' | 'password' | 'token' | 'credential' | 'private_key' | 'other';
  secret: string;
  maskedSecret: string;
  location: {
    file: string;
    line: number;
    column?: number;
  };
  severity: 'critical' | 'high' | 'medium' | 'low';
  context: string;
  secureAlternative: string;
  status: 'active' | 'resolved' | 'false_positive';
}

interface SecretsScanResult {
  scanId: string;
  artifactId?: string;
  findings: SecretFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
  };
  scannedAt: Date;
}

const SecretsFindings: React.FC<SecretsFindingsProps> = ({ projectId, artifactId }) => {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<SecretsScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadScans();
  }, [projectId, artifactId]);

  const loadScans = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch secrets scan results
      setResults([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load secrets findings');
    } finally {
      setLoading(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      // This would trigger a secrets scan via the backend
      setTimeout(() => {
        setScanning(false);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to run secrets scan');
      setScanning(false);
    }
  };

  const toggleReveal = (id: string) => {
    const newRevealed = new Set(revealedSecrets);
    if (newRevealed.has(id)) {
      newRevealed.delete(id);
    } else {
      newRevealed.add(id);
    }
    setRevealedSecrets(newRevealed);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'api_key': return 'bg-blue-100 text-blue-800';
      case 'password': return 'bg-red-100 text-red-800';
      case 'token': return 'bg-orange-100 text-orange-800';
      case 'credential': return 'bg-purple-100 text-purple-800';
      case 'private_key': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const allFindings = results.flatMap(r => r.findings);
  const filteredFindings = allFindings.filter(finding => {
    if (filterSeverity !== 'all' && finding.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && finding.status !== filterStatus) return false;
    return true;
  });

  const totalSummary = results.reduce((acc, result) => ({
    total: acc.total + result.summary.total,
    critical: acc.critical + result.summary.critical,
    high: acc.high + result.summary.high,
    medium: acc.medium + result.summary.medium,
    low: acc.low + result.summary.low,
    resolved: acc.resolved + result.summary.resolved
  }), { total: 0, critical: 0, high: 0, medium: 0, low: 0, resolved: 0 });

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Key className="w-6 h-6 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900">Secrets Findings</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Scan for Secrets
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
            <div className="text-sm text-gray-600">Total Findings</div>
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
            <div className="text-2xl font-bold text-green-600">{totalSummary.resolved}</div>
            <div className="text-sm text-green-600">Resolved</div>
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
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="false_positive">False Positive</option>
        </select>
      </div>

      {/* Findings List */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading secrets findings...</p>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {totalSummary.total === 0 ? (
            <>
              <Shield className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p>No secrets found in code.</p>
              <p className="text-sm mt-2">Click "Scan for Secrets" to perform a scan.</p>
            </>
          ) : (
            <p>No findings match the selected filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding, index) => (
            <div
              key={index}
              className={`p-4 border-2 rounded-lg ${getSeverityColor(finding.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <div className="font-semibold">Secret Detected: {finding.type.replace('_', ' ').toUpperCase()}</div>
                    <div className="text-xs text-gray-600">
                      {finding.location.file}:{finding.location.line}
                      {finding.location.column && `:${finding.location.column}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(finding.type)}`}>
                    {finding.type}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(finding.severity)}`}>
                    {finding.severity.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Secret:</span>
                  <button
                    onClick={() => toggleReveal(finding.id)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {revealedSecrets.has(finding.id) ? (
                      <><EyeOff className="w-3 h-3 inline" /> Hide</>
                    ) : (
                      <><Eye className="w-3 h-3 inline" /> Reveal</>
                    )}
                  </button>
                </div>
                <div className="p-2 bg-gray-100 rounded font-mono text-sm">
                  {revealedSecrets.has(finding.id) ? finding.secret : finding.maskedSecret}
                </div>
              </div>

              <div className="text-sm mb-2">
                <span className="font-medium">Context:</span> {finding.context}
              </div>

              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                <span className="font-medium text-green-800">Secure Alternative:</span>
                <div className="text-green-700 mt-1">{finding.secureAlternative}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecretsFindings;



