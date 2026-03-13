'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  DollarSign,
  Zap,
  Filter,
  Star,
  Shield,
  Brain,
  RefreshCw,
  Download,
  Search,
  Server,
  ArrowRight,
} from 'lucide-react';
import { getRoutingDecisions, getRoutingDecision, exportRoutingDecisions, RoutingDecision } from '../services/routerEnhancedApi';

interface RoutingExplainerProps {
  token?: string;
}

interface DecisionStep {
  step: number;
  type: 'filter' | 'score' | 'rule' | 'fallback' | 'ai_prediction' | 'quota_check';
  description: string;
  result: string;
  candidatesRemaining?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export default function RoutingExplainer({ token }: RoutingExplainerProps) {
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<RoutingDecision | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  const fetchDecisions = useCallback(async () => {
    try {
      setError(null);
      const data = await getRoutingDecisions(50, token);
      setDecisions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch decisions');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      const blob = await exportRoutingDecisions(format, undefined, undefined, token);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `routing-decisions.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'filter':
        return <Filter className="w-4 h-4" />;
      case 'score':
        return <Star className="w-4 h-4" />;
      case 'rule':
        return <Shield className="w-4 h-4" />;
      case 'fallback':
        return <GitBranch className="w-4 h-4" />;
      case 'ai_prediction':
        return <Brain className="w-4 h-4" />;
      case 'quota_check':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <ChevronRight className="w-4 h-4" />;
    }
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case 'filter':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'score':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'rule':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'fallback':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ai_prediction':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'quota_check':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const filteredDecisions = decisions.filter(d => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!d.selectedModel.toLowerCase().includes(query) &&
          !d.task.type.toLowerCase().includes(query) &&
          !(d.task.agentRole?.toLowerCase().includes(query))) {
        return false;
      }
    }
    if (filterModel && d.selectedModel !== filterModel) {
      return false;
    }
    return true;
  });

  const uniqueModels = [...new Set(decisions.map(d => d.selectedModel))];

  const renderDecisionPath = (decision: RoutingDecision) => {
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-blue-600" />
          Decision Path
        </h4>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

          <div className="space-y-4">
            {decision.decisionPath.map((step, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                {/* Step number */}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${getStepColor(step.type)}`}>
                  {getStepIcon(step.type)}
                </div>

                {/* Step content */}
                <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStepColor(step.type)}`}>
                      {step.type.replace('_', ' ').toUpperCase()}
                    </span>
                    {step.duration && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(step.duration)}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 mb-2">{step.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{step.result}</span>
                    {step.candidatesRemaining !== undefined && (
                      <span className="text-xs text-slate-500">
                        {step.candidatesRemaining} candidates remaining
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAlternatives = (decision: RoutingDecision) => {
    if (!decision.alternatives || decision.alternatives.length === 0) return null;

    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <Server className="w-5 h-5 text-purple-600" />
          Alternatives Considered
        </h4>

        <div className="space-y-2">
          {decision.alternatives.map((alt, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                  #{idx + 2}
                </div>
                <div>
                  <p className="font-medium text-slate-800">{alt.modelId}</p>
                  <p className="text-xs text-slate-500">{alt.provider}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-slate-800">Score: {alt.score.toFixed(2)}</p>
                <p className="text-xs text-slate-500">{alt.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-600" />
            Routing Explainer
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Understand how routing decisions are made
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
          <button
            onClick={fetchDecisions}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by model, task type, or agent role..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Models</option>
          {uniqueModels.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-2 gap-6">
        {/* Decisions list */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Recent Decisions</h3>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {filteredDecisions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No decisions found
              </div>
            ) : (
              filteredDecisions.map(decision => (
                <div
                  key={decision.id}
                  onClick={() => setSelectedDecision(decision)}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                    selectedDecision?.id === decision.id
                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-800">{decision.selectedModel}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(decision.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                      {decision.task.type}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                      {decision.task.complexity}
                    </span>
                    {decision.task.agentRole && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        {decision.task.agentRole}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {(decision.confidence * 100).toFixed(0)}% confidence
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(decision.decisionPath.reduce((sum, s) => sum + (s.duration || 0), 0))}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Decision details */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {selectedDecision ? (
            <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {selectedDecision.selectedModel}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {selectedDecision.selectedProvider}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDecision.success !== undefined && (
                    selectedDecision.success ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )
                  )}
                </div>
              </div>

              {/* Task info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-700 mb-3">Task Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Type:</span>
                    <span className="ml-2 text-slate-800">{selectedDecision.task.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Complexity:</span>
                    <span className="ml-2 text-slate-800">{selectedDecision.task.complexity}</span>
                  </div>
                  {selectedDecision.task.agentRole && (
                    <div>
                      <span className="text-slate-500">Agent Role:</span>
                      <span className="ml-2 text-slate-800">{selectedDecision.task.agentRole}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Est. Tokens:</span>
                    <span className="ml-2 text-slate-800">{selectedDecision.task.estimatedTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <Zap className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                  <p className="text-xs text-blue-600">Confidence</p>
                  <p className="text-lg font-bold text-blue-800">
                    {(selectedDecision.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <p className="text-xs text-green-600">Est. Cost</p>
                  <p className="text-lg font-bold text-green-800">
                    ${selectedDecision.estimatedCost.toFixed(4)}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                  <p className="text-xs text-purple-600">Est. Latency</p>
                  <p className="text-lg font-bold text-purple-800">
                    {formatDuration(selectedDecision.estimatedLatency)}
                  </p>
                </div>
              </div>

              {/* Decision path */}
              {renderDecisionPath(selectedDecision)}

              {/* Alternatives */}
              {renderAlternatives(selectedDecision)}
            </div>
          ) : (
            <div className="p-12 text-center">
              <GitBranch className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500">Select a decision to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

