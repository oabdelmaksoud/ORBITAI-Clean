/**
 * Predictive Analytics Component
 * Visualizes predictive analytics for model selection
 */

import React, { useState } from 'react';
import {
  BarChart3, TrendingUp, Zap, DollarSign, Clock,
  Loader2, Play, RefreshCw
} from 'lucide-react';
import {
  predictOptimalModel,
  getAIInsights,
  ModelPrediction,
  AIInsights
} from '../services/adminLLMRouterAIApi';

interface PredictiveAnalyticsProps {
  token?: string;
}

const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<ModelPrediction | null>(null);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [taskInput, setTaskInput] = useState({
    agentRole: '',
    taskType: '',
    complexity: 'moderate' as 'simple' | 'moderate' | 'complex',
    estimatedTokens: '1000',
    costPreference: 'balanced' as 'low' | 'balanced' | 'quality',
    maxLatency: ''
  });

  const handlePredict = async () => {
    try {
      setPredicting(true);
      setError(null);
      setPrediction(null);

      const result = await predictOptimalModel(
        {
          agentRole: taskInput.agentRole || undefined,
          taskType: taskInput.taskType || undefined,
          complexity: taskInput.complexity,
          estimatedTokens: taskInput.estimatedTokens ? parseInt(taskInput.estimatedTokens) : undefined,
          requiredCapabilities: []
        },
        token,
        {
          costPreference: taskInput.costPreference,
          maxLatency: taskInput.maxLatency ? parseInt(taskInput.maxLatency) : undefined
        }
      );

      setPrediction(result.prediction);
    } catch (err: any) {
      setError(err.message || 'Failed to predict optimal model');
    } finally {
      setPredicting(false);
    }
  };

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAIInsights(token);
      setInsights(result.insights);
    } catch (err: any) {
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadInsights();
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-blue-600" size={20} />
        <h3 className="text-lg font-semibold text-slate-800">Predictive Analytics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prediction Input */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-slate-800 mb-4">Predict Optimal Model</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Agent Role (optional)
              </label>
              <input
                type="text"
                value={taskInput.agentRole}
                onChange={(e) => setTaskInput({ ...taskInput, agentRole: e.target.value })}
                placeholder="e.g., code-generator"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Task Type (optional)
              </label>
              <input
                type="text"
                value={taskInput.taskType}
                onChange={(e) => setTaskInput({ ...taskInput, taskType: e.target.value })}
                placeholder="e.g., code-generation"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Complexity
              </label>
              <select
                value={taskInput.complexity}
                onChange={(e) => setTaskInput({ ...taskInput, complexity: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="simple">Simple</option>
                <option value="moderate">Moderate</option>
                <option value="complex">Complex</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Estimated Tokens
              </label>
              <input
                type="number"
                value={taskInput.estimatedTokens}
                onChange={(e) => setTaskInput({ ...taskInput, estimatedTokens: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cost Preference
              </label>
              <select
                value={taskInput.costPreference}
                onChange={(e) => setTaskInput({ ...taskInput, costPreference: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low Cost</option>
                <option value="balanced">Balanced</option>
                <option value="quality">Quality</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max Latency (ms, optional)
              </label>
              <input
                type="number"
                value={taskInput.maxLatency}
                onChange={(e) => setTaskInput({ ...taskInput, maxLatency: e.target.value })}
                placeholder="e.g., 2000"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handlePredict}
              disabled={predicting}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {predicting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Predicting...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Predict Optimal Model
                </>
              )}
            </button>
          </div>
        </div>

        {/* Prediction Result */}
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-slate-800 mb-4">Prediction Result</h4>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {prediction ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-blue-900">Recommended Model</h5>
                  <span className="text-xs text-blue-700">
                    {(prediction.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <div className="text-lg font-bold text-blue-900">{prediction.modelId}</div>
                <div className="text-sm text-blue-700">{prediction.provider}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-slate-600" />
                    <span className="text-xs text-slate-600">Estimated Cost</span>
                  </div>
                  <div className="text-lg font-semibold text-slate-800">
                    ${prediction.estimatedCost.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} className="text-slate-600" />
                    <span className="text-xs text-slate-600">Estimated Latency</span>
                  </div>
                  <div className="text-lg font-semibold text-slate-800">
                    {prediction.estimatedLatency.toFixed(0)}ms
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-700">{prediction.reasoning}</p>
              </div>

              {prediction.alternatives && prediction.alternatives.length > 0 && (
                <div>
                  <h6 className="text-sm font-medium text-slate-700 mb-2">Alternative Models:</h6>
                  <div className="space-y-2">
                    {prediction.alternatives.map((alt, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 rounded text-xs">
                        <span className="font-medium">{alt.modelId}</span> - 
                        ${alt.estimatedCost.toFixed(4)} / {alt.estimatedLatency.toFixed(0)}ms
                        ({alt.confidence.toFixed(0)}% confidence)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              Enter task details and click "Predict Optimal Model" to see predictions
            </div>
          )}
        </div>
      </div>

      {/* Insights Summary */}
      {insights && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-800">Usage Insights</h4>
            <button
              onClick={loadInsights}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Total Requests</div>
              <div className="text-lg font-semibold text-slate-800">{insights.totalRequests.toLocaleString()}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Total Cost</div>
              <div className="text-lg font-semibold text-slate-800">${insights.totalCost.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Avg Latency</div>
              <div className="text-lg font-semibold text-slate-800">{insights.avgLatency.toFixed(0)}ms</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Success Rate</div>
              <div className="text-lg font-semibold text-slate-800">{(insights.successRate * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictiveAnalytics;




