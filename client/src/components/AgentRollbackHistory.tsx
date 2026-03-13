/**
 * Agent Rollback History Component
 * Displays agent execution rollback history
 */

import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface AgentRollbackHistoryProps {
  projectId: string;
}

interface RollbackRecord {
  _id: string;
  executionId: string;
  agentId: string;
  agentRole: string;
  reason: string;
  artifactsReverted: Array<{
    artifactId: string;
    artifactName: string;
    previousVersion: string;
  }>;
  rollbackTime: Date;
  status: 'success' | 'partial' | 'failed';
}

const AgentRollbackHistory: React.FC<AgentRollbackHistoryProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [rollbacks, setRollbacks] = useState<RollbackRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRollbacks();
  }, [projectId]);

  const loadRollbacks = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setRollbacks([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load rollback history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <RotateCcw className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900">Agent Rollback History</h2>
        </div>
        <button
          onClick={loadRollbacks}
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
          <p className="text-gray-600">Loading rollback history...</p>
        </div>
      ) : rollbacks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p>No rollbacks recorded.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rollbacks.map((rollback, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold">{rollback.agentRole}</div>
                  <div className="text-sm text-gray-600">Execution: {rollback.executionId}</div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(rollback.status)}`}>
                    {rollback.status.toUpperCase()}
                  </span>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(rollback.rollbackTime).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-sm font-medium mb-1">Reason:</div>
                <div className="text-sm text-gray-700">{rollback.reason}</div>
              </div>
              {rollback.artifactsReverted.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Artifacts Reverted ({rollback.artifactsReverted.length}):</div>
                  <div className="space-y-1">
                    {rollback.artifactsReverted.map((artifact, i) => (
                      <div key={i} className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                        {artifact.artifactName} (reverted to v{artifact.previousVersion})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentRollbackHistory;



