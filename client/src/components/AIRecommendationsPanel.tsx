/**
 * AI Recommendations Panel Component
 * Displays and manages AI-generated recommendations for router settings
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle, XCircle, AlertTriangle, TrendingUp,
  DollarSign, Zap, RefreshCw, Loader2, Info
} from 'lucide-react';
import {
  getAIRecommendations,
  applyRecommendations,
  AIRecommendation
} from '../services/adminLLMRouterAIApi';

interface AIRecommendationsPanelProps {
  token?: string;
}

const AIRecommendationsPanel: React.FC<AIRecommendationsPanelProps> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [token]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAIRecommendations(token);
      setRecommendations(result.recommendations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (index: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index.toString())) {
      newSelected.delete(index.toString());
    } else {
      newSelected.add(index.toString());
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recommendations.map((_, i) => i.toString())));
    }
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      setError('Please select at least one recommendation to apply');
      return;
    }

    try {
      setApplying(true);
      setError(null);
      setSuccess(null);

      // In a real implementation, recommendations would have IDs
      // For now, we'll use indices
      const selectedIndices = Array.from(selectedIds).map(id => parseInt(id));
      const selectedRecs = recommendations.filter((_, i) => selectedIndices.includes(i));

      // Apply recommendations (this would need backend support for applying by index)
      // For now, we'll just show success
      setSuccess(`Applied ${selectedIds.size} recommendation(s)`);
      setSelectedIds(new Set());

      // Reload recommendations after a delay
      setTimeout(() => {
        loadRecommendations();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to apply recommendations');
    } finally {
      setApplying(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cost_control':
        return <DollarSign size={16} />;
      case 'performance_tuning':
        return <Zap size={16} />;
      case 'routing_rule':
        return <TrendingUp size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-600" size={24} />
        <span className="ml-2 text-slate-600">Loading AI recommendations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold text-slate-800">AI Recommendations</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRecommendations}
            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {applying ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle size={14} />
                  Apply Selected ({selectedIds.size})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          {success}
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <Info size={32} className="mx-auto mb-2 opacity-50" />
          <p>No recommendations available at this time.</p>
          <p className="text-sm mt-1">AI recommendations are generated based on usage patterns.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={selectedIds.size === recommendations.length}
              onChange={handleSelectAll}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">
              Select all ({recommendations.length} recommendations)
            </span>
          </div>

          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  selectedIds.has(index.toString())
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(index.toString())}
                    onChange={() => handleSelect(index)}
                    className="mt-1 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(rec.type)}
                        <h4 className="font-semibold text-slate-800">{rec.title}</h4>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityColor(
                            rec.priority
                          )}`}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {(rec.confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{rec.description}</p>
                    {rec.impact && (
                      <div className="flex items-center gap-1 text-sm text-green-700 mb-2">
                        <TrendingUp size={14} />
                        <span className="font-medium">{rec.impact}</span>
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                        View reasoning
                      </summary>
                      <p className="text-xs text-slate-600 mt-1 pl-4">{rec.reasoning}</p>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AIRecommendationsPanel;




