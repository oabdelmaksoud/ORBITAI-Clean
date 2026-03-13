import React, { useState, useEffect } from 'react';
import { Download, FileJson, FileText, AlertCircle, CheckCircle, AlertTriangle, TrendingUp, Target, Activity } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface ComplianceScore {
  projectId: string;
  overallScore: number;
  coverageScore: number;
  traceabilityScore: number;
  testCoverageScore: number;
  alignmentScore: number;
  breakdown: {
    implemented: number;
    partial: number;
    missing: number;
    total: number;
  };
  generatedAt: string;
}

interface RequirementCompliance {
  requirementId: string;
  description: string;
  priority: string;
  complianceScore: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  hasCode: boolean;
  hasTests: boolean;
  hasDesign: boolean;
  traceRefsCount: number;
  alignmentScore: number;
  issues: string[];
}

interface ComplianceReport {
  projectId: string;
  score: ComplianceScore;
  requirements: RequirementCompliance[];
  summary: {
    totalRequirements: number;
    fullyCompliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
    compliancePercentage: number;
  };
  recommendations: string[];
  generatedAt: string;
}

interface RequirementsCoverageReportProps {
  projectId: string;
  onClose?: () => void;
}

const COLORS = {
  compliant: '#10b981',
  partial: '#f59e0b',
  nonCompliant: '#ef4444',
  implemented: '#3b82f6',
  missing: '#ef4444'
};

export const RequirementsCoverageReport: React.FC<RequirementsCoverageReportProps> = ({ projectId, onClose }) => {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'recommendations'>('overview');

  useEffect(() => {
    loadReport();
  }, [projectId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectsApi.get(`/requirements/${projectId}/report`);
      if (response.data?.success) {
        setReport(response.data.data);
      } else {
        setError('Failed to load compliance report');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'json' | 'text') => {
    if (!report) return;

    if (format === 'json') {
      const dataStr = JSON.stringify(report, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `requirements-compliance-${projectId}-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Text format
      const text = generateTextReport(report);
      const dataBlob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `requirements-compliance-${projectId}-${new Date().toISOString()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const generateTextReport = (report: ComplianceReport): string => {
    let text = 'REQUIREMENTS COMPLIANCE REPORT\n';
    text += '='.repeat(50) + '\n\n';
    text += `Project ID: ${report.projectId}\n`;
    text += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n\n`;
    
    text += 'OVERALL SCORES\n';
    text += '-'.repeat(50) + '\n';
    text += `Overall Compliance: ${report.score.overallScore.toFixed(1)}%\n`;
    text += `Coverage Score: ${report.score.coverageScore.toFixed(1)}%\n`;
    text += `Traceability Score: ${report.score.traceabilityScore.toFixed(1)}%\n`;
    text += `Test Coverage: ${report.score.testCoverageScore.toFixed(1)}%\n`;
    text += `Alignment Score: ${report.score.alignmentScore.toFixed(1)}%\n\n`;

    text += 'SUMMARY\n';
    text += '-'.repeat(50) + '\n';
    text += `Total Requirements: ${report.summary.totalRequirements}\n`;
    text += `Fully Compliant: ${report.summary.fullyCompliant}\n`;
    text += `Partially Compliant: ${report.summary.partiallyCompliant}\n`;
    text += `Non-Compliant: ${report.summary.nonCompliant}\n`;
    text += `Compliance Percentage: ${report.summary.compliancePercentage.toFixed(1)}%\n\n`;

    text += 'REQUIREMENTS\n';
    text += '-'.repeat(50) + '\n';
    report.requirements.forEach((req, idx) => {
      text += `\n${idx + 1}. ${req.requirementId} (${req.priority} priority)\n`;
      text += `   Status: ${req.status.toUpperCase()}\n`;
      text += `   Compliance Score: ${req.complianceScore.toFixed(1)}%\n`;
      text += `   Has Code: ${req.hasCode ? 'Yes' : 'No'}\n`;
      text += `   Has Tests: ${req.hasTests ? 'Yes' : 'No'}\n`;
      text += `   Has Design: ${req.hasDesign ? 'Yes' : 'No'}\n`;
      if (req.issues.length > 0) {
        text += `   Issues: ${req.issues.join(', ')}\n`;
      }
    });

    text += '\n\nRECOMMENDATIONS\n';
    text += '-'.repeat(50) + '\n';
    report.recommendations.forEach((rec, idx) => {
      text += `${idx + 1}. ${rec}\n`;
    });

    return text;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Error</span>
          </div>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={loadReport}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-gray-600">No report data available</p>
      </div>
    );
  }

  const pieData = [
    { name: 'Compliant', value: report.summary.fullyCompliant, color: COLORS.compliant },
    { name: 'Partial', value: report.summary.partiallyCompliant, color: COLORS.partial },
    { name: 'Non-Compliant', value: report.summary.nonCompliant, color: COLORS.nonCompliant }
  ];

  const scoreData = [
    { name: 'Overall', value: report.score.overallScore },
    { name: 'Coverage', value: report.score.coverageScore },
    { name: 'Traceability', value: report.score.traceabilityScore },
    { name: 'Test Coverage', value: report.score.testCoverageScore },
    { name: 'Alignment', value: report.score.alignmentScore }
  ];

  const priorityData = [
    { priority: 'Critical', compliant: report.requirements.filter(r => r.priority === 'critical' && r.status === 'compliant').length, nonCompliant: report.requirements.filter(r => r.priority === 'critical' && r.status === 'non-compliant').length },
    { priority: 'High', compliant: report.requirements.filter(r => r.priority === 'high' && r.status === 'compliant').length, nonCompliant: report.requirements.filter(r => r.priority === 'high' && r.status === 'non-compliant').length },
    { priority: 'Medium', compliant: report.requirements.filter(r => r.priority === 'medium' && r.status === 'compliant').length, nonCompliant: report.requirements.filter(r => r.priority === 'medium' && r.status === 'non-compliant').length },
    { priority: 'Low', compliant: report.requirements.filter(r => r.priority === 'low' && r.status === 'compliant').length, nonCompliant: report.requirements.filter(r => r.priority === 'low' && r.status === 'non-compliant').length }
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Requirements Compliance Report</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportReport('json')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <FileJson className="w-4 h-4" />
            Export JSON
          </button>
          <button
            onClick={() => exportReport('text')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export Text
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-4 border-b-2 ${activeTab === 'overview' ? 'border-primary text-primary font-semibold' : 'border-transparent text-gray-600'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`pb-2 px-4 border-b-2 ${activeTab === 'requirements' ? 'border-primary text-primary font-semibold' : 'border-transparent text-gray-600'}`}
          >
            Requirements ({report.requirements.length})
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`pb-2 px-4 border-b-2 ${activeTab === 'recommendations' ? 'border-primary text-primary font-semibold' : 'border-transparent text-gray-600'}`}
          >
            Recommendations ({report.recommendations.length})
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Overall</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">{report.score.overallScore.toFixed(1)}%</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Coverage</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{report.score.coverageScore.toFixed(1)}%</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Traceability</span>
              </div>
              <div className="text-3xl font-bold text-purple-600">{report.score.traceabilityScore.toFixed(1)}%</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-gray-700">Test Coverage</span>
              </div>
              <div className="text-3xl font-bold text-orange-600">{report.score.testCoverageScore.toFixed(1)}%</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-medium text-gray-700">Alignment</span>
              </div>
              <div className="text-3xl font-bold text-indigo-600">{report.score.alignmentScore.toFixed(1)}%</div>
            </div>
          </div>

          {/* Charts - Simple HTML/CSS versions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Compliance Status</h3>
              <div className="space-y-4">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: entry.color }}></div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-gray-600">{entry.value} ({report.summary.totalRequirements > 0 ? Math.round((entry.value / report.summary.totalRequirements) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${report.summary.totalRequirements > 0 ? (entry.value / report.summary.totalRequirements) * 100 : 0}%`,
                            backgroundColor: entry.color
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
              <div className="space-y-4">
                {scoreData.map((entry, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{entry.name}</span>
                      <span className="font-semibold">{entry.value.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all bg-blue-600"
                        style={{ width: `${entry.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Total Requirements</div>
              <div className="text-2xl font-bold text-gray-800">{report.summary.totalRequirements}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-gray-600 mb-1">Fully Compliant</div>
              <div className="text-2xl font-bold text-green-600">{report.summary.fullyCompliant}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="text-sm text-gray-600 mb-1">Partially Compliant</div>
              <div className="text-2xl font-bold text-yellow-600">{report.summary.partiallyCompliant}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-sm text-gray-600 mb-1">Non-Compliant</div>
              <div className="text-2xl font-bold text-red-600">{report.summary.nonCompliant}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requirements' && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Has Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Has Tests</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.requirements.map((req) => (
                  <tr key={req.requirementId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{req.requirementId}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{req.description.substring(0, 100)}...</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        req.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        req.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        req.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        req.status === 'compliant' ? 'bg-green-100 text-green-800' :
                        req.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{req.complianceScore.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm">
                      {req.hasCode ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {req.hasTests ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {report.recommendations.map((rec, idx) => (
            <div key={idx} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <p className="text-gray-700">{rec}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RequirementsCoverageReport;



