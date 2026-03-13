'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Play,
  Trophy,
  Clock,
  DollarSign,
  Star,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Server,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { runBenchmark, getBenchmarkResults, BenchmarkResult } from '../services/routerEnhancedApi';

interface ModelBenchmarkProps {
  token?: string;
  availableModels: Array<{
    id: string;
    name: string;
    provider: string;
  }>;
}

interface BenchmarkSummary {
  modelId: string;
  provider: string;
  taskType: string;
  avgLatency: number;
  avgCost: number;
  avgQualityScore: number;
  totalRuns: number;
}

const TASK_TYPES = [
  { id: 'code-generation', name: 'Code Generation', icon: '💻' },
  { id: 'analysis', name: 'Analysis', icon: '🔍' },
  { id: 'documentation', name: 'Documentation', icon: '📝' },
  { id: 'chat', name: 'Chat', icon: '💬' },
  { id: 'structured-output', name: 'Structured Output', icon: '📊' },
];

export default function ModelBenchmark({
  token,
  availableModels,
}: ModelBenchmarkProps) {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskType, setSelectedTaskType] = useState('code-generation');
  const [runningBenchmarks, setRunningBenchmarks] = useState<Set<string>>(new Set());
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      setError(null);
      const data = await getBenchmarkResults(undefined, selectedTaskType, token);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch benchmark results');
    } finally {
      setLoading(false);
    }
  }, [selectedTaskType, token]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleRunBenchmark = async (modelId: string) => {
    const key = `${modelId}-${selectedTaskType}`;
    if (runningBenchmarks.has(key)) return;

    setRunningBenchmarks(prev => new Set(prev).add(key));
    setError(null);

    try {
      await runBenchmark(modelId, selectedTaskType, token);
      await fetchResults();
    } catch (err: any) {
      setError(err.message || 'Failed to run benchmark');
    } finally {
      setRunningBenchmarks(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRunAllBenchmarks = async () => {
    for (const model of availableModels) {
      await handleRunBenchmark(model.id);
    }
  };

  // Aggregate results by model
  const modelSummaries: Map<string, BenchmarkSummary> = new Map();
  for (const result of results) {
    const existing = modelSummaries.get(result.modelId);
    if (existing) {
      existing.avgLatency = (existing.avgLatency * existing.totalRuns + result.latency) / (existing.totalRuns + 1);
      existing.avgCost = (existing.avgCost * existing.totalRuns + result.cost) / (existing.totalRuns + 1);
      existing.avgQualityScore = (existing.avgQualityScore * existing.totalRuns + result.qualityScore) / (existing.totalRuns + 1);
      existing.totalRuns++;
    } else {
      const model = availableModels.find(m => m.id === result.modelId);
      modelSummaries.set(result.modelId, {
        modelId: result.modelId,
        provider: model?.provider || 'unknown',
        taskType: result.taskType,
        avgLatency: result.latency,
        avgCost: result.cost,
        avgQualityScore: result.qualityScore,
        totalRuns: 1,
      });
    }
  }

  // Sort by quality score
  const sortedSummaries = Array.from(modelSummaries.values())
    .sort((a, b) => b.avgQualityScore - a.avgQualityScore);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      openai: 'bg-green-100 text-green-700',
      anthropic: 'bg-orange-100 text-orange-700',
      google: 'bg-blue-100 text-blue-700',
      gemini: 'bg-blue-100 text-blue-700',
      deepseek: 'bg-purple-100 text-purple-700',
      grok: 'bg-slate-100 text-slate-700',
    };
    return colors[provider.toLowerCase()] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Model Benchmarks
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Compare model performance across different task types
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchResults}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleRunAllBenchmarks}
            disabled={runningBenchmarks.size > 0}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Run All
          </button>
        </div>
      </div>

      {/* Task type selector */}
      <div className="flex gap-2 flex-wrap">
        {TASK_TYPES.map(task => (
          <button
            key={task.id}
            onClick={() => setSelectedTaskType(task.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              selectedTaskType === task.id
                ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400'
                : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
            }`}
          >
            <span>{task.icon}</span>
            {task.name}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Comparison table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Performance Comparison
          </h3>
        </div>

        {sortedSummaries.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 mb-4">No benchmark results yet</p>
            <button
              onClick={handleRunAllBenchmarks}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Run First Benchmark
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Model</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Provider</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Quality</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Latency</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Cost</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Runs</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedSummaries.map((summary, idx) => {
                  const isRunning = runningBenchmarks.has(`${summary.modelId}-${selectedTaskType}`);
                  const model = availableModels.find(m => m.id === summary.modelId);
                  
                  return (
                    <React.Fragment key={summary.modelId}>
                      <tr
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                          expandedModel === summary.modelId ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => setExpandedModel(
                          expandedModel === summary.modelId ? null : summary.modelId
                        )}
                      >
                        <td className="py-3 px-4">
                          {idx === 0 ? (
                            <div className="flex items-center gap-1">
                              <Trophy className="w-5 h-5 text-yellow-500" />
                              <span className="font-bold text-yellow-600">1</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 font-medium">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-800">
                              {model?.name || summary.modelId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(summary.provider)}`}>
                            {summary.provider}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Star className={`w-4 h-4 ${getScoreColor(summary.avgQualityScore)}`} />
                            <span className={`font-bold ${getScoreColor(summary.avgQualityScore)}`}>
                              {summary.avgQualityScore.toFixed(1)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-800">{formatLatency(summary.avgLatency)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-800">{formatCurrency(summary.avgCost)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {summary.totalRuns}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRunBenchmark(summary.modelId);
                              }}
                              disabled={isRunning}
                              className="p-2 rounded-lg bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors disabled:opacity-50"
                            >
                              {isRunning ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                            {expandedModel === summary.modelId ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded details */}
                      {expandedModel === summary.modelId && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 p-4">
                            <div className="space-y-4">
                              <h4 className="font-semibold text-slate-800">Recent Benchmark Results</h4>
                              <div className="grid grid-cols-3 gap-4">
                                {results
                                  .filter(r => r.modelId === summary.modelId)
                                  .slice(0, 3)
                                  .map((result, ridx) => (
                                    <div
                                      key={ridx}
                                      className="bg-white rounded-lg border border-slate-200 p-4"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-slate-500">
                                          {new Date(result.timestamp).toLocaleString()}
                                        </span>
                                        {result.status === 'success' ? (
                                          <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                          <AlertCircle className="w-4 h-4 text-red-500" />
                                        )}
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-slate-500">Quality</span>
                                          <span className={`font-medium ${getScoreColor(result.qualityScore)}`}>
                                            {result.qualityScore.toFixed(1)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-slate-500">Latency</span>
                                          <span className="text-slate-800">{formatLatency(result.latency)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-slate-500">Cost</span>
                                          <span className="text-slate-800">{formatCurrency(result.cost)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Models not yet benchmarked */}
      {availableModels.length > sortedSummaries.length && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Models Not Yet Benchmarked</h3>
          <div className="flex flex-wrap gap-2">
            {availableModels
              .filter(m => !modelSummaries.has(m.id))
              .map(model => {
                const isRunning = runningBenchmarks.has(`${model.id}-${selectedTaskType}`);
                return (
                  <button
                    key={model.id}
                    onClick={() => handleRunBenchmark(model.id)}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {isRunning ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 text-yellow-600" />
                    )}
                    <span className="text-sm font-medium text-slate-700">{model.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getProviderColor(model.provider)}`}>
                      {model.provider}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

