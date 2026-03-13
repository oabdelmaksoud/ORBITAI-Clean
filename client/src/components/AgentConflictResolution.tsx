/**
 * Agent Conflict Resolution Component
 * Displays and resolves conflicts between agent suggestions
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Vote, Target } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface AgentConflictResolutionProps {
  projectId: string;
}

interface AgentConflict {
  _id: string;
  conflictType: 'overlapping_changes' | 'contradictory_outputs';
  agents: Array<{
    agentId: string;
    agentRole: string;
    suggestion: string;
    priority: number;
  }>;
  affectedArtifacts: string[];
  resolution?: {
    strategy: 'priority_based' | 'voting' | 'llm_based' | 'human_escalation';
    selectedSuggestion: string;
    resolvedBy: string;
    resolvedAt: Date;
  };
  detectedAt: Date;
}

const AgentConflictResolution: React.FC<AgentConflictResolutionProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<AgentConflict[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConflicts();
  }, [projectId]);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setConflicts([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load conflicts');
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (conflictId: string, strategy: string) => {
    try {
      // In real implementation, call backend to resolve
      await loadConflicts();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to resolve conflict');
    }
  };

  const getConflictTypeColor = (type: string) => {
    switch (type) {
      case 'overlapping_changes': return 'bg-yellow-100 text-yellow-800';
      case 'contradictory_outputs': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900">Agent Conflict Resolution</h2>
        </div>
        <button
          onClick={loadConflicts}
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
          <p className="text-gray-600">Loading conflicts...</p>
        </div>
      ) : conflicts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p>No conflicts detected.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict, index) => (
            <div key={index} className="p-4 border-2 border-orange-200 bg-orange-50 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-lg">Conflict Detected</div>
                  <div className="text-sm text-gray-600">
                    {new Date(conflict.detectedAt).toLocaleString()}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getConflictTypeColor(conflict.conflictType)}`}>
                  {conflict.conflictType.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div className="mb-3">
                <div className="text-sm font-medium mb-2">Conflicting Agents:</div>
                <div className="space-y-2">
                  {conflict.agents.map((agent, i) => (
                    <div key={i} className="p-2 bg-white rounded border">
                      <div className="font-medium">{agent.agentRole}</div>
                      <div className="text-sm text-gray-700">{agent.suggestion}</div>
                      <div className="text-xs text-gray-500">Priority: {agent.priority}</div>
                    </div>
                  ))}
                </div>
              </div>

              {conflict.resolution ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Resolved</span>
                  </div>
                  <div className="text-sm text-green-700">
                    Strategy: {conflict.resolution.strategy.replace('_', ' ')}
                  </div>
                  <div className="text-sm text-green-700">
                    Selected: {conflict.resolution.selectedSuggestion}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveConflict(conflict._id, 'priority_based')}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Target className="w-4 h-4" />
                    Priority-Based
                  </button>
                  <button
                    onClick={() => resolveConflict(conflict._id, 'voting')}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Vote className="w-4 h-4" />
                    Voting
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentConflictResolution;



