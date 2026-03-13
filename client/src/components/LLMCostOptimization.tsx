/**
 * LLM Cost Optimization Component
 * Analyzes and optimizes LLM usage costs
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp, RefreshCw, Download, Lightbulb } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface LLMCostOptimizationProps {
  userId?: string;
  days?: number;
}

interface CostAnalysis {
  totalCost: number;
  byProvider: Array<{
    provider: string;
    cost: number;
    percentage: number;
  }>;
  byModel: Array<{
    model: string;
    cost: number;
    usage: number;
  }>;
  trends: {
    daily: Array<{ date: string; cost: number }>;
    weekly: Array<{ week: string; cost: number }>;
  };
  forecast: {
    nextMonth: number;
    nextQuarter: number;
  };
  suggestions: Array<{
    type: string;
    description: string;
    potentialSavings: number;
  }>;
}

const LLMCostOptimization: React.FC<LLMCostOptimizationProps> = ({ userId, days = 30 }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysis();
  }, [userId, days]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setAnalysis(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load cost analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-green-500" />
          <h2 className="text-2xl font-bold text-gray-900">LLM Cost Optimization</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {analysis && (
            <button
              onClick={() => {
                const dataStr = JSON.stringify(analysis, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `llm-cost-analysis-${Date.now()}.json`;
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

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Analyzing costs...</p>
        </div>
      ) : analysis ? (
        <div className="space-y-6">
          <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-800 mb-1">Total Cost (Last {days} days)</div>
            <div className="text-4xl font-bold text-green-600">${analysis.totalCost.toFixed(2)}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">Cost by Provider</h3>
              <div className="space-y-2">
                {analysis.byProvider.map((item, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{item.provider}</span>
                      <span className="text-lg font-bold">${item.cost.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{item.percentage.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Forecast</h3>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Next Month</div>
                  <div className="text-2xl font-bold text-blue-600">${analysis.forecast.nextMonth.toFixed(2)}</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">Next Quarter</div>
                  <div className="text-2xl font-bold text-purple-600">${analysis.forecast.nextQuarter.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {analysis.suggestions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Optimization Suggestions
              </h3>
              <div className="space-y-2">
                {analysis.suggestions.map((suggestion, i) => (
                  <div key={i} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="font-medium mb-1">{suggestion.type}</div>
                    <div className="text-sm text-gray-700 mb-2">{suggestion.description}</div>
                    <div className="text-sm font-semibold text-green-700">
                      Potential Savings: ${suggestion.potentialSavings.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No cost analysis data available.</p>
        </div>
      )}
    </div>
  );
};

export default LLMCostOptimization;



