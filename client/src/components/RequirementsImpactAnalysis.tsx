/**
 * Requirements Impact Analysis Component
 * Visualizes impact of requirement changes on linked artifacts
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Code, FileText, TestTube, Layers, TrendingUp, ArrowRight, Download, RefreshCw, Activity } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface RequirementsImpactAnalysisProps {
  projectId: string;
  requirementId?: string;
}

interface ImpactAnalysisReport {
  requirementId: string;
  requirementTitle: string;
  changes: Array<{
    type: 'added' | 'modified' | 'removed';
    description: string;
  }>;
  affectedArtifacts: Array<{
    artifactId: string;
    artifactType: 'code' | 'test' | 'design' | 'documentation';
    artifactName: string;
    impactLevel: 'critical' | 'high' | 'medium' | 'low';
    impactDescription: string;
    suggestedActions: string[];
  }>;
  dependencyGraph: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
    }>;
    edges: Array<{
      from: string;
      to: string;
      type: string;
    }>;
  };
  impactScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  suggestedChangeOrder: string[];
  summary: {
    totalAffected: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

const RequirementsImpactAnalysis: React.FC<RequirementsImpactAnalysisProps> = ({ projectId, requirementId }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImpactAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<Array<{ type: 'added' | 'modified' | 'removed'; description: string }>>([
    { type: 'modified', description: '' }
  ]);

  const analyzeImpact = async () => {
    if (!requirementId) {
      setError('Please select a requirement first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await projectsApi.post(`/requirements/${projectId}/${requirementId}/impact`, {
        changes
      });

      if (response.data?.success) {
        setReport(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to analyze impact');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to analyze impact');
    } finally {
      setLoading(false);
    }
  };

  const addChange = () => {
    setChanges([...changes, { type: 'modified', description: '' }]);
  };

  const removeChange = (index: number) => {
    setChanges(changes.filter((_, i) => i !== index));
  };

  const updateChange = (index: number, field: 'type' | 'description', value: string) => {
    const updated = [...changes];
    updated[index] = { ...updated[index], [field]: value };
    setChanges(updated);
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'code': return <Code className="w-4 h-4" />;
      case 'test': return <TestTube className="w-4 h-4" />;
      case 'design': return <Layers className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900">Impact Analysis</h2>
        </div>
        {report && (
          <button
            onClick={() => {
              const dataStr = JSON.stringify(report, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `impact-analysis-${requirementId}-${Date.now()}.json`;
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        )}
      </div>

      {!report ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Analyze the impact of requirement changes on linked artifacts (code, tests, designs).
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Requirement Changes
            </label>
            {changes.map((change, index) => (
              <div key={index} className="flex gap-2 items-start">
                <select
                  value={change.type}
                  onChange={(e) => updateChange(index, 'type', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="added">Added</option>
                  <option value="modified">Modified</option>
                  <option value="removed">Removed</option>
                </select>
                <input
                  type="text"
                  value={change.description}
                  onChange={(e) => updateChange(index, 'description', e.target.value)}
                  placeholder="Describe the change..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {changes.length > 1 && (
                  <button
                    onClick={() => removeChange(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addChange}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Another Change
            </button>
          </div>

          <button
            onClick={analyzeImpact}
            disabled={loading || !requirementId || changes.some(c => !c.description)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Analyze Impact
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className={`p-4 rounded-lg border-2 ${getRiskColor(report.riskLevel)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Risk Level</span>
              <span className="text-lg font-bold">{report.riskLevel.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Impact Score</span>
              <span className="text-lg font-bold">{report.impactScore}/100</span>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">{report.summary.totalAffected}</div>
              <div className="text-sm text-gray-600">Total Affected</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{report.summary.criticalCount}</div>
              <div className="text-sm text-red-600">Critical</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{report.summary.highCount}</div>
              <div className="text-sm text-orange-600">High</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{report.summary.mediumCount}</div>
              <div className="text-sm text-yellow-600">Medium</div>
            </div>
          </div>

          {/* Affected Artifacts */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Affected Artifacts</h3>
            <div className="space-y-3">
              {report.affectedArtifacts.map((artifact, index) => (
                <div
                  key={index}
                  className={`p-4 border-2 rounded-lg ${getImpactColor(artifact.impactLevel)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getArtifactIcon(artifact.artifactType)}
                      <div>
                        <div className="font-medium">{artifact.artifactName}</div>
                        <div className="text-xs text-gray-600">{artifact.artifactType}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getImpactColor(artifact.impactLevel)}`}>
                      {artifact.impactLevel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm mb-3">{artifact.impactDescription}</p>
                  {artifact.suggestedActions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1">Suggested Actions:</div>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {artifact.suggestedActions.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Change Order */}
          {report.suggestedChangeOrder.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Suggested Change Order</h3>
              <div className="space-y-2">
                {report.suggestedChangeOrder.map((step, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">{step}</div>
                    {index < report.suggestedChangeOrder.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setReport(null)}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            New Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default RequirementsImpactAnalysis;



