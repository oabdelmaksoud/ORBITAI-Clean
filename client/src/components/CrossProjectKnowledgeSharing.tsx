/**
 * Cross-Project Knowledge Sharing Component
 * Manages knowledge sharing between projects
 */

import React, { useState, useEffect } from 'react';
import { Share2, CheckCircle, XCircle, RefreshCw, Filter } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface CrossProjectKnowledgeSharingProps {
  projectId: string;
}

interface SharedKnowledge {
  _id: string;
  knowledgeId: string;
  sourceProjectId: string;
  sourceProjectName: string;
  scope: 'project' | 'user' | 'global';
  qualityScore: number;
  sharedAt: Date;
  sharedBy: string;
}

const CrossProjectKnowledgeSharing: React.FC<CrossProjectKnowledgeSharingProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [sharedKnowledge, setSharedKnowledge] = useState<SharedKnowledge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<string>('all');

  useEffect(() => {
    loadSharedKnowledge();
  }, [projectId]);

  const loadSharedKnowledge = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setSharedKnowledge([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load shared knowledge');
    } finally {
      setLoading(false);
    }
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'global': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-green-100 text-green-800';
      case 'project': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filtered = sharedKnowledge.filter(k => filterScope === 'all' || k.scope === filterScope);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Share2 className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Cross-Project Knowledge Sharing</h2>
        </div>
        <button
          onClick={loadSharedKnowledge}
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

      <div className="flex gap-2 mb-4">
        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Scopes</option>
          <option value="global">Global</option>
          <option value="user">User</option>
          <option value="project">Project</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading shared knowledge...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No shared knowledge available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((knowledge, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold">{knowledge.sourceProjectName}</div>
                  <div className="text-sm text-gray-600">From: {knowledge.sourceProjectId}</div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getScopeColor(knowledge.scope)}`}>
                    {knowledge.scope.toUpperCase()}
                  </span>
                  <div className={`text-lg font-bold mt-1 ${getQualityColor(knowledge.qualityScore)}`}>
                    {knowledge.qualityScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">Quality</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Shared by {knowledge.sharedBy} on {new Date(knowledge.sharedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CrossProjectKnowledgeSharing;



