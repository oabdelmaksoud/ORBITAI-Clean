/**
 * Traceability Matrix Viewer Component
 * Displays requirements vs artifacts traceability matrix with export functionality
 */

import React, { useState, useEffect } from 'react';
import { Table, Download, RefreshCw, Search, Filter, FileText, Code, TestTube, Layers } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface TraceabilityMatrixViewerProps {
  projectId: string;
}

interface TraceabilityLink {
  requirementId: string;
  artifactId: string;
  artifactType: 'code' | 'test' | 'design' | 'documentation';
  linkType: 'implements' | 'tests' | 'validates' | 'references';
  strength: 'strong' | 'medium' | 'weak';
  keywords: string[];
}

interface TraceabilityMatrix {
  requirements: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  artifacts: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  links: TraceabilityLink[];
  coverage: {
    requirementsWithLinks: number;
    totalRequirements: number;
    coveragePercentage: number;
  };
  gaps: Array<{
    requirementId: string;
    missingArtifactTypes: string[];
  }>;
}

const TraceabilityMatrixViewer: React.FC<TraceabilityMatrixViewerProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<TraceabilityMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'excel'>('csv');

  useEffect(() => {
    loadMatrix();
  }, [projectId]);

  const loadMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.get(`/requirements/${projectId}/traceability-matrix`);
      if (response.data?.success) {
        setMatrix(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to load traceability matrix');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load traceability matrix');
    } finally {
      setLoading(false);
    }
  };

  const exportMatrix = async (format: 'csv' | 'json' | 'excel') => {
    if (!matrix) return;

    try {
      const response = await projectsApi.get(
        `/requirements/${projectId}/traceability-matrix/export?format=${format}`,
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], {
        type: format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `traceability-matrix-${projectId}-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
      a.click();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to export matrix');
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

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'weak': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequirements = matrix?.requirements.filter(req =>
    req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredLinks = matrix?.links.filter(link => {
    if (filterType !== 'all' && link.artifactType !== filterType) return false;
    return true;
  }) || [];

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Table className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Traceability Matrix</h2>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="excel">Excel</option>
          </select>
          <button
            onClick={() => exportMatrix(selectedFormat)}
            disabled={!matrix}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export {selectedFormat.toUpperCase()}
          </button>
          <button
            onClick={loadMatrix}
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

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading traceability matrix...</p>
        </div>
      ) : matrix ? (
        <div className="space-y-4">
          {/* Coverage Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{matrix.coverage.coveragePercentage.toFixed(1)}%</div>
              <div className="text-sm text-blue-600">Coverage</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{matrix.coverage.requirementsWithLinks}</div>
              <div className="text-sm text-green-600">Requirements with Links</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{matrix.coverage.totalRequirements}</div>
              <div className="text-sm text-gray-600">Total Requirements</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search requirements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Artifact Types</option>
              <option value="code">Code</option>
              <option value="test">Tests</option>
              <option value="design">Designs</option>
              <option value="documentation">Documentation</option>
            </select>
          </div>

          {/* Gaps Warning */}
          {matrix.gaps.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="font-semibold text-yellow-800 mb-2">Traceability Gaps Detected</div>
              <div className="text-sm text-yellow-700">
                {matrix.gaps.length} requirements are missing links to {filterType === 'all' ? 'artifacts' : filterType}
              </div>
            </div>
          )}

          {/* Matrix Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">Requirement</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">Artifact</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">Link Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLinks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No traceability links found
                      </td>
                    </tr>
                  ) : (
                    filteredLinks.map((link, index) => {
                      const requirement = matrix.requirements.find(r => r.id === link.requirementId);
                      const artifact = matrix.artifacts.find(a => a.id === link.artifactId);
                      if (!requirement || !artifact) return null;

                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{requirement.title}</div>
                            <div className="text-xs text-gray-500">{requirement.id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getArtifactIcon(link.artifactType)}
                              <span>{artifact.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">{link.artifactType}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-100 rounded text-xs">{link.linkType}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${getStrengthColor(link.strength)}`}>
                              {link.strength}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No traceability matrix available. Generate one from the requirements dashboard.
        </div>
      )}
    </div>
  );
};

export default TraceabilityMatrixViewer;



