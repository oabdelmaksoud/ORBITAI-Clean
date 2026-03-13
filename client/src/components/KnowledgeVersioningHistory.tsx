/**
 * Knowledge Versioning History Component
 * Displays knowledge version history and changes
 */

import React, { useState, useEffect } from 'react';
import { GitBranch, Clock, User, RefreshCw, Download, Eye } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface KnowledgeVersioningHistoryProps {
  knowledgeId: string;
}

interface KnowledgeVersion {
  version: number;
  content: string;
  changedBy: string;
  changeReason: string;
  timestamp: Date;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
}

const KnowledgeVersioningHistory: React.FC<KnowledgeVersioningHistoryProps> = ({ knowledgeId }) => {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  useEffect(() => {
    loadVersions();
  }, [knowledgeId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setVersions([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'deprecated': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Knowledge Version History</h2>
        </div>
        <button
          onClick={loadVersions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading version history...</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No version history available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div
              key={index}
              className={`p-4 border-2 rounded-lg ${
                selectedVersion === version.version
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
              onClick={() => setSelectedVersion(version.version === selectedVersion ? null : version.version)}
              style={{ cursor: 'pointer' }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold">Version {version.version}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <User className="w-3 h-3" />
                    {version.changedBy}
                    <Clock className="w-3 h-3 ml-2" />
                    {new Date(version.timestamp).toLocaleString()}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(version.status)}`}>
                  {version.status.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-700 mb-2">
                <span className="font-medium">Reason:</span> {version.changeReason}
              </div>
              {selectedVersion === version.version && (
                <div className="mt-3 p-3 bg-gray-50 rounded border">
                  <div className="text-sm font-medium mb-2">Content:</div>
                  <pre className="text-xs font-mono overflow-x-auto">{version.content}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeVersioningHistory;



