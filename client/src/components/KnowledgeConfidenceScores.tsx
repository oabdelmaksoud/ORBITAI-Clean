/**
 * Knowledge Confidence Scores Component
 * Visualizes knowledge confidence scores
 */

import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, BarChart3, RefreshCw } from 'lucide-react';
import { apiRequest } from '@src/services/api';

interface KnowledgeConfidenceScoresProps {
  agentId?: string;
  knowledgeId?: string;
}

interface ConfidenceScore {
  domain: string;
  level: number;
  confidence: number;
  lastUpdated: Date;
  trend: 'improving' | 'stable' | 'degrading';
}

const KnowledgeConfidenceScores: React.FC<KnowledgeConfidenceScoresProps> = ({ agentId, knowledgeId }) => {
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<ConfidenceScore[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScores();
  }, [agentId, knowledgeId]);

  const loadScores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentId) params.set('agentId', agentId);
      if (knowledgeId) params.set('agentId', knowledgeId);
      const data = await apiRequest<ConfidenceScore[]>(
        '/api/agentKnowledgeEnhanced/confidence?' + params.toString()
      );
      setScores(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load confidence scores');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'degrading': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Knowledge Confidence Scores</h2>
        </div>
        <button
          onClick={loadScores}
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
          <p className="text-gray-600">Loading confidence scores...</p>
        </div>
      ) : scores.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No confidence scores available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scores.map((score, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{score.domain}</div>
                  <div className="text-sm text-gray-600">Level {score.level}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{score.confidence.toFixed(1)}%</div>
                  {getTrendIcon(score.trend)}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getConfidenceColor(score.confidence)}`}
                  style={{ width: `${score.confidence}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Last updated: {new Date(score.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeConfidenceScores;



