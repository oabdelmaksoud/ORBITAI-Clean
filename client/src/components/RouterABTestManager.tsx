'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  Plus,
  Play,
  Square,
  Trophy,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Percent,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Settings,
  Zap,
} from 'lucide-react';
import {
  getABTests,
  createABTest,
  completeABTest,
  cancelABTest,
  ABTest,
} from '../services/routerEnhancedApi';

interface RouterABTestManagerProps {
  token?: string;
  onApplyWinner?: (config: any) => void;
}

interface NewTestForm {
  name: string;
  description: string;
  durationHours: number;
  variants: Array<{
    id: string;
    name: string;
    trafficPercent: number;
    config: {
      latencyWeight?: number;
      costWeight?: number;
      qualityWeight?: number;
      preferredProvider?: string;
    };
  }>;
}

const defaultForm: NewTestForm = {
  name: '',
  description: '',
  durationHours: 24,
  variants: [
    { id: 'control', name: 'Control (Current)', trafficPercent: 50, config: {} },
    { id: 'variant-b', name: 'Variant B', trafficPercent: 50, config: {} },
  ],
};

export default function RouterABTestManager({
  token,
  onApplyWinner,
}: RouterABTestManagerProps) {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTest, setNewTest] = useState<NewTestForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'completed' | 'cancelled'>('all');

  const fetchTests = useCallback(async () => {
    try {
      setError(null);
      const data = await getABTests(token);
      setTests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch A/B tests');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTests();
    const interval = setInterval(fetchTests, 30000);
    return () => clearInterval(interval);
  }, [fetchTests]);

  const handleCreateTest = async () => {
    if (!newTest.name.trim()) {
      setError('Test name is required');
      return;
    }

    const totalTraffic = newTest.variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      setError('Traffic percentages must sum to 100%');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await createABTest(
        {
          name: newTest.name,
          description: newTest.description,
          variants: newTest.variants,
        },
        token
      );
      setShowCreateModal(false);
      setNewTest(defaultForm);
      await fetchTests();
    } catch (err: any) {
      setError(err.message || 'Failed to create test');
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteTest = async (testId: string) => {
    try {
      setError(null);
      await completeABTest(testId, token);
      await fetchTests();
    } catch (err: any) {
      setError(err.message || 'Failed to complete test');
    }
  };

  const handleCancelTest = async (testId: string) => {
    if (!confirm('Are you sure you want to cancel this test?')) return;
    try {
      setError(null);
      await cancelABTest(testId, token);
      await fetchTests();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel test');
    }
  };

  const handleApplyWinner = async (test: ABTest) => {
    if (!test.winner) return;
    const winnerVariant = test.variants.find(v => v.id === test.winner);
    if (winnerVariant && onApplyWinner) {
      onApplyWinner(winnerVariant.config);
    }
  };

  const addVariant = () => {
    const newVariantId = `variant-${String.fromCharCode(97 + newTest.variants.length)}`;
    setNewTest({
      ...newTest,
      variants: [
        ...newTest.variants,
        {
          id: newVariantId,
          name: `Variant ${String.fromCharCode(65 + newTest.variants.length)}`,
          trafficPercent: 0,
          config: {},
        },
      ],
    });
  };

  const removeVariant = (index: number) => {
    if (newTest.variants.length <= 2) return;
    setNewTest({
      ...newTest,
      variants: newTest.variants.filter((_, i) => i !== index),
    });
  };

  const updateVariant = (index: number, updates: Partial<NewTestForm['variants'][0]>) => {
    setNewTest({
      ...newTest,
      variants: newTest.variants.map((v, i) => (i === index ? { ...v, ...updates } : v)),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <Play className="w-3 h-3" /> Running
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getMetricTrend = (variantMetric: number, controlMetric: number) => {
    if (controlMetric === 0) return null;
    const diff = ((variantMetric - controlMetric) / controlMetric) * 100;
    if (Math.abs(diff) < 1) {
      return <Minus className="w-4 h-4 text-slate-400" />;
    }
    return diff > 0 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const hours = Math.floor((end - start) / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  const filteredTests = tests.filter(
    t => filterStatus === 'all' || t.status === filterStatus
  );

  const runningTests = tests.filter(t => t.status === 'running').length;
  const completedTests = tests.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-600" />
            A/B Test Manager
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Test routing configurations to find the optimal setup
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTests}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            New Test
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Running</p>
              <p className="text-xl font-bold text-slate-800">{runningTests}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-xl font-bold text-slate-800">{completedTests}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <FlaskConical className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Tests</p>
              <p className="text-xl font-bold text-slate-800">{tests.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Trophy className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Winners Found</p>
              <p className="text-xl font-bold text-slate-800">
                {tests.filter(t => t.winner).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
        {(['all', 'running', 'completed', 'cancelled'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              filterStatus === status
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tests list */}
      <div className="space-y-4">
        {filteredTests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FlaskConical className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">No A/B tests found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create your first test
            </button>
          </div>
        ) : (
          filteredTests.map(test => (
            <div
              key={test.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Test header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <FlaskConical className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{test.name}</h3>
                    {test.description && (
                      <p className="text-sm text-slate-500">{test.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {getStatusBadge(test.status)}
                  
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    {formatDuration(test.startedAt, test.completedAt)}
                  </div>

                  {test.winner && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                      <Trophy className="w-3 h-3" />
                      {test.variants.find(v => v.id === test.winner)?.name || 'Winner'}
                    </div>
                  )}

                  {expandedTest === test.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {expandedTest === test.id && (
                <div className="border-t border-slate-200 p-4 space-y-4">
                  {/* Variants comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {test.variants.map((variant, idx) => {
                      const metrics = test.metrics[variant.id];
                      const isWinner = test.winner === variant.id;
                      const isControl = idx === 0;
                      const controlMetrics = test.metrics[test.variants[0].id];

                      return (
                        <div
                          key={variant.id}
                          className={`rounded-lg border p-4 ${
                            isWinner
                              ? 'border-yellow-400 bg-yellow-50'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">
                                {variant.name}
                              </span>
                              {isWinner && (
                                <Trophy className="w-4 h-4 text-yellow-600" />
                              )}
                            </div>
                            <span className="text-xs text-slate-500">
                              {variant.trafficPercent}% traffic
                            </span>
                          </div>

                          {metrics && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Requests</span>
                                <span className="text-sm font-medium text-slate-800">
                                  {metrics.requests.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Success Rate</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium text-slate-800">
                                    {metrics.successRate.toFixed(1)}%
                                  </span>
                                  {!isControl && getMetricTrend(metrics.successRate, controlMetrics?.successRate || 0)}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Avg Latency</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium text-slate-800">
                                    {metrics.avgLatency.toFixed(0)}ms
                                  </span>
                                  {!isControl && getMetricTrend(
                                    controlMetrics?.avgLatency || 0,
                                    metrics.avgLatency
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Avg Cost</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium text-slate-800">
                                    ${metrics.avgCost.toFixed(4)}
                                  </span>
                                  {!isControl && getMetricTrend(
                                    controlMetrics?.avgCost || 0,
                                    metrics.avgCost
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                    {test.status === 'running' && (
                      <>
                        <button
                          onClick={() => handleCompleteTest(test.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Square className="w-4 h-4" />
                          Complete Test
                        </button>
                        <button
                          onClick={() => handleCancelTest(test.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    )}
                    {test.status === 'completed' && test.winner && (
                      <button
                        onClick={() => handleApplyWinner(test)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        Apply Winner
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Create A/B Test</h3>
              <p className="text-sm text-slate-500 mt-1">
                Compare different routing configurations to optimize performance
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Test name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Name
                </label>
                <input
                  type="text"
                  value={newTest.name}
                  onChange={e => setNewTest({ ...newTest, name: e.target.value })}
                  placeholder="e.g., Cost Optimization Test"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newTest.description}
                  onChange={e => setNewTest({ ...newTest, description: e.target.value })}
                  placeholder="Describe what you're testing..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Duration (hours)
                </label>
                <input
                  type="number"
                  value={newTest.durationHours}
                  onChange={e => setNewTest({ ...newTest, durationHours: parseInt(e.target.value) || 24 })}
                  min={1}
                  max={168}
                  className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">
                    Test Variants
                  </label>
                  <button
                    onClick={addVariant}
                    className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Variant
                  </button>
                </div>

                <div className="space-y-4">
                  {newTest.variants.map((variant, idx) => (
                    <div
                      key={variant.id}
                      className="border border-slate-200 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={variant.name}
                          onChange={e => updateVariant(idx, { name: e.target.value })}
                          className="font-medium text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0"
                        />
                        {idx > 1 && (
                          <button
                            onClick={() => removeVariant(idx)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            Traffic %
                          </label>
                          <input
                            type="number"
                            value={variant.trafficPercent}
                            onChange={e => updateVariant(idx, { trafficPercent: parseInt(e.target.value) || 0 })}
                            min={0}
                            max={100}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            Latency Weight
                          </label>
                          <input
                            type="number"
                            value={variant.config.latencyWeight || 0.33}
                            onChange={e => updateVariant(idx, {
                              config: { ...variant.config, latencyWeight: parseFloat(e.target.value) || 0.33 }
                            })}
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            Cost Weight
                          </label>
                          <input
                            type="number"
                            value={variant.config.costWeight || 0.33}
                            onChange={e => updateVariant(idx, {
                              config: { ...variant.config, costWeight: parseFloat(e.target.value) || 0.33 }
                            })}
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            Quality Weight
                          </label>
                          <input
                            type="number"
                            value={variant.config.qualityWeight || 0.34}
                            onChange={e => updateVariant(idx, {
                              config: { ...variant.config, qualityWeight: parseFloat(e.target.value) || 0.34 }
                            })}
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Traffic sum indicator */}
                <div className="mt-2 text-sm">
                  <span className="text-slate-500">Total traffic: </span>
                  <span
                    className={`font-medium ${
                      Math.abs(newTest.variants.reduce((s, v) => s + v.trafficPercent, 0) - 100) < 0.01
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {newTest.variants.reduce((s, v) => s + v.trafficPercent, 0)}%
                  </span>
                  <span className="text-slate-500"> (must equal 100%)</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTest(defaultForm);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTest}
                disabled={creating}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

