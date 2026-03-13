import React, { useState } from 'react';
import { Sparkles, TrendingUp, TestTube, Zap, Loader2, AlertCircle } from 'lucide-react';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface AIOptimizationDashboardProps {
  token: string;
  improvementId?: string;
}

const AIOptimizationDashboard: React.FC<AIOptimizationDashboardProps> = ({ token, improvementId: initialImprovementId }) => {
  const [improvementId, setImprovementId] = useState(initialImprovementId || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  const handleAction = async (action: string, data: any = {}) => {
    if (!improvementId.trim()) {
      showAlert('Please enter a Process Improvement ID');
      return;
    }

    setLoading(true);
    setActiveAction(action);
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/ai-optimization/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ improvementId, ...data }),
      });

      if (!response.ok) throw new Error(`Failed to ${action}`);

      const result = await response.json();
      setResults({ action, data: result.data });
    } catch (error: any) {
      console.error(`AI Optimization ${action} error:`, error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">AI Optimization</h2>
          <p className="text-sm text-slate-500 mt-1">AI-powered process optimization and analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Process Improvement ID</h3>
          <input
            type="text"
            value={improvementId}
            onChange={(e) => setImprovementId(e.target.value)}
            placeholder="Enter Process Improvement ID"
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
          />

          <div className="space-y-2">
            <button
              onClick={() => handleAction('analyze')}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'analyze' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Analyze Process
            </button>

            <button
              onClick={() => handleAction('suggest')}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'suggest' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <TrendingUp size={16} />
              )}
              Get Suggestions
            </button>

            <button
              onClick={() => handleAction('auto-optimize', 'error')}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'auto-optimize' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              Auto-Optimize
            </button>

            <button
              onClick={() => handleAction('predict', { context: {} })}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'predict' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <TestTube size={16} />
              )}
              Predict Outcome
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Results</h3>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {!loading && !results && (
            <div className="text-center py-12 text-slate-500">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Select an action to see optimization results</p>
            </div>
          )}

          {!loading && results && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2 capitalize">{results.action} Results</h4>
                <pre className="text-xs text-slate-700 overflow-auto max-h-96 bg-white p-3 rounded border">
                  {JSON.stringify(results.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIOptimizationDashboard;













