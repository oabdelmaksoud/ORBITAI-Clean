/**
 * Code Evolution Tracker Component
 * Tracks code changes, quality trends, and regression patterns
 */

import React, { useState, useEffect } from 'react';
import { GitBranch, TrendingUp, TrendingDown, Minus, AlertTriangle, Download, RefreshCw, BarChart3 } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface CodeEvolutionTrackerProps {
  projectId: string;
  artifactId?: string;
}

interface CodeEvolution {
  _id: string;
  projectId: string;
  artifactId: string;
  version: string;
  snapshot: {
    content: string;
    qualityScore: number;
    complexity: number;
    testCoverage: number;
    linesOfCode: number;
  };
  changes: Array<{
    type: 'added' | 'modified' | 'removed';
    description: string;
    lines: number;
  }>;
  qualityTrend: 'improving' | 'stable' | 'degrading';
  regressionPatterns: string[];
  timestamp: Date;
}

interface CodeEvolutionReport {
  evolutions: CodeEvolution[];
  trends: {
    quality: Array<{ date: string; score: number }>;
    complexity: Array<{ date: string; value: number }>;
    testCoverage: Array<{ date: string; percentage: number }>;
  };
  summary: {
    totalVersions: number;
    averageQualityScore: number;
    qualityTrend: 'improving' | 'stable' | 'degrading';
    regressionCount: number;
  };
}

const CodeEvolutionTracker: React.FC<CodeEvolutionTrackerProps> = ({ projectId, artifactId }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CodeEvolutionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  useEffect(() => {
    loadEvolution();
  }, [projectId, artifactId]);

  const loadEvolution = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = artifactId
        ? `/code-evolution/${projectId}/${artifactId}/report`
        : `/code-evolution/${projectId}/report`;
      const response = await projectsApi.get(endpoint);
      if (response.data?.success) {
        setReport(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to load code evolution data');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load code evolution data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'degrading': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600 bg-green-50';
      case 'degrading': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Code Evolution Tracker</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadEvolution}
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
                a.download = `code-evolution-${projectId}-${Date.now()}.json`;
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
          <p className="text-gray-600">Loading code evolution data...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{report.summary.totalVersions}</div>
              <div className="text-sm text-gray-600">Total Versions</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{report.summary.averageQualityScore.toFixed(1)}</div>
              <div className="text-sm text-blue-600">Avg Quality Score</div>
            </div>
            <div className={`p-4 rounded-lg ${getTrendColor(report.summary.qualityTrend)}`}>
              <div className="flex items-center gap-2">
                {getTrendIcon(report.summary.qualityTrend)}
                <div className="text-sm font-medium">{report.summary.qualityTrend.toUpperCase()}</div>
              </div>
              <div className="text-xs mt-1">Quality Trend</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{report.summary.regressionCount}</div>
              <div className="text-sm text-red-600">Regressions</div>
            </div>
          </div>

          {/* Evolution Timeline */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Version History</h3>
            <div className="space-y-3">
              {report.evolutions.map((evolution, index) => (
                <div
                  key={index}
                  className={`p-4 border-2 rounded-lg ${
                    selectedVersion === evolution.version
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setSelectedVersion(evolution.version === selectedVersion ? null : evolution.version)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">Version {evolution.version}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(evolution.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(evolution.qualityTrend)}
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getTrendColor(evolution.qualityTrend)}`}>
                        {evolution.qualityTrend}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-600">Quality Score</div>
                      <div className="font-semibold">{evolution.snapshot.qualityScore.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Complexity</div>
                      <div className="font-semibold">{evolution.snapshot.complexity}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Test Coverage</div>
                      <div className="font-semibold">{evolution.snapshot.testCoverage.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Lines of Code</div>
                      <div className="font-semibold">{evolution.snapshot.linesOfCode}</div>
                    </div>
                  </div>

                  {evolution.changes.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium mb-1">Changes:</div>
                      <div className="space-y-1">
                        {evolution.changes.map((change, i) => (
                          <div key={i} className="text-xs text-gray-600">
                            <span className={`px-1 py-0.5 rounded ${
                              change.type === 'added' ? 'bg-green-100 text-green-800' :
                              change.type === 'removed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {change.type}
                            </span>
                            {' '}{change.description} ({change.lines} lines)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evolution.regressionPatterns.length > 0 && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-medium text-red-800">Regression Patterns:</span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-red-700">
                        {evolution.regressionPatterns.map((pattern, i) => (
                          <li key={i}>{pattern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No code evolution data available. Evolution tracking starts when code is modified.
        </div>
      )}
    </div>
  );
};

export default CodeEvolutionTracker;



