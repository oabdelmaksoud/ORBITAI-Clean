/**
 * ASPICE Compliance Matrix Component
 * Visualizes ASPICE Level 3 compliance mapping and scoring
 */

import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Download, RefreshCw, TrendingUp, Target } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface ASPICEComplianceMatrixProps {
  projectId: string;
}

interface ProcessArea {
  processArea: string;
  processAreaName: string;
  level: number;
  complianceScore: number;
  mappedRequirements: number;
  workProducts: Array<{
    name: string;
    status: 'present' | 'partial' | 'missing';
  }>;
  practices: Array<{
    practice: string;
    status: 'compliant' | 'partial' | 'non_compliant';
  }>;
}

interface ASPICEComplianceReport {
  projectId: string;
  targetLevel: number;
  overallScore: number;
  processAreas: ProcessArea[];
  summary: {
    compliant: number;
    partial: number;
    nonCompliant: number;
    total: number;
  };
  generatedAt: string;
}

const ASPICEComplianceMatrix: React.FC<ASPICEComplianceMatrixProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ASPICEComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLevel, setTargetLevel] = useState(3);

  useEffect(() => {
    loadCompliance();
  }, [projectId, targetLevel]);

  const loadCompliance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.get(`/requirements/${projectId}/aspice?targetLevel=${targetLevel}`);
      if (response.data?.success) {
        setReport(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to load ASPICE compliance');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load ASPICE compliance');
    } finally {
      setLoading(false);
    }
  };

  const mapRequirements = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.post(`/requirements/${projectId}/aspice/map`, {
        targetLevel
      });
      if (response.data?.success) {
        await loadCompliance();
      } else {
        setError(response.data?.error || 'Failed to map requirements');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to map requirements');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    if (score >= 50) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
      case 'compliant':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'missing':
      case 'non_compliant':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">ASPICE Compliance Matrix</h2>
        </div>
        <div className="flex gap-2">
          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
            <option value={4}>Level 4</option>
            <option value={5}>Level 5</option>
          </select>
          <button
            onClick={mapRequirements}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Mapping...
              </>
            ) : (
              <>
                <Target className="w-4 h-4" />
                Map Requirements
              </>
            )}
          </button>
          {report && (
            <button
              onClick={() => {
                const dataStr = JSON.stringify(report, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `aspice-compliance-${projectId}-${Date.now()}.json`;
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

      {loading && !report ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading ASPICE compliance data...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className={`p-6 rounded-lg border-2 ${getScoreColor(report.overallScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium mb-1">Overall ASPICE Level {targetLevel} Compliance</div>
                <div className="text-4xl font-bold">{report.overallScore.toFixed(1)}%</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Process Areas</div>
                <div className="text-2xl font-bold">{report.summary.total}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {report.summary.compliant} compliant, {report.summary.partial} partial
                </div>
              </div>
            </div>
          </div>

          {/* Process Areas */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Process Areas</h3>
            <div className="space-y-4">
              {report.processAreas.map((area, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-lg">{area.processAreaName}</div>
                      <div className="text-sm text-gray-600">{area.processArea}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getScoreColor(area.complianceScore).split(' ')[0]}`}>
                        {area.complianceScore.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">Level {area.level}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {/* Work Products */}
                    <div>
                      <div className="text-sm font-medium mb-2">Work Products</div>
                      <div className="space-y-1">
                        {area.workProducts.map((wp, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {getStatusIcon(wp.status)}
                            <span>{wp.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Practices */}
                    <div>
                      <div className="text-sm font-medium mb-2">Practices</div>
                      <div className="space-y-1">
                        {area.practices.map((practice, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {getStatusIcon(practice.status)}
                            <span>{practice.practice}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    {area.mappedRequirements} requirements mapped
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No ASPICE compliance data available.</p>
          <p className="text-sm mt-2">Click "Map Requirements" to generate compliance report.</p>
        </div>
      )}
    </div>
  );
};

export default ASPICEComplianceMatrix;



