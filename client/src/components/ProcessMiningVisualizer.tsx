import React, { useState, useEffect } from 'react';
import {
  Workflow, AlertTriangle, TrendingUp, Clock, CheckCircle, XCircle,
  Search, Filter, Play, Loader2, BarChart3, Target, Zap
} from 'lucide-react';
import { discoverWorkflows, ProcessDiscoveryResult, WorkflowPattern, Bottleneck } from '../services/processMiningApi';

interface ProcessMiningVisualizerProps {
  token: string;
}

const ProcessMiningVisualizer: React.FC<ProcessMiningVisualizerProps> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessDiscoveryResult | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');

  const agentRoles = [
    'Orchestrator',
    'Requirements Agent',
    'UX Designer',
    'QA/Audit Agent',
    'Design/Architecture Agent',
    'Implementation Agent',
    'Integration Agent',
    'Test Agent',
    'Remediation/Bug Agent'
  ];

  const handleDiscover = async () => {
    if (!selectedAgent) {
      setError('Please select an agent role');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await discoverWorkflows(token, selectedAgent, selectedProject || undefined);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to discover workflows');
      console.error('Failed to discover workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Process Mining & Workflow Discovery</h2>
        <p className="text-sm text-slate-500 mt-1">
          Discover actual workflows from agent task execution data
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Agent Role
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Agent Role</option>
              {agentRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Project ID (Optional)
            </label>
            <input
              type="text"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              placeholder="Leave empty for all projects"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={handleDiscover}
          disabled={loading || !selectedAgent}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
          Discover Workflows
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500 mb-1">Total Workflows</p>
              <h3 className="text-2xl font-bold text-slate-800">{results.statistics.totalWorkflows}</h3>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500 mb-1">Unique Patterns</p>
              <h3 className="text-2xl font-bold text-slate-800">{results.statistics.uniquePatterns}</h3>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500 mb-1">Avg Steps</p>
              <h3 className="text-2xl font-bold text-slate-800">{results.statistics.averageSteps.toFixed(1)}</h3>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500 mb-1">Avg Success Rate</p>
              <h3 className="text-2xl font-bold text-slate-800">{results.statistics.averageSuccessRate.toFixed(1)}%</h3>
            </div>
          </div>

          {/* Workflow Patterns */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Workflow size={20} /> Discovered Workflow Patterns
            </h3>
            <div className="space-y-4">
              {results.patterns.map((pattern, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-800">{pattern.name}</h4>
                      <p className="text-sm text-slate-500">Used {pattern.frequency} times</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{pattern.successRate.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">Success Rate</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pattern.steps.map((step, stepIdx) => (
                      <div key={stepIdx} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                          {step.stepNumber}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">{step.taskTitle}</p>
                          <p className="text-xs text-slate-500">{step.taskType}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-600">{step.successRate.toFixed(0)}%</p>
                          <p className="text-xs text-slate-400">{(step.averageDuration / 1000).toFixed(1)}s</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottlenecks */}
          {results.bottlenecks.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-orange-600" /> Detected Bottlenecks
              </h3>
              <div className="space-y-3">
                {results.bottlenecks.map((bottleneck, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border ${
                    bottleneck.impact === 'high' ? 'bg-red-50 border-red-200' :
                    bottleneck.impact === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800">Step {bottleneck.stepNumber}: {bottleneck.taskType}</p>
                        <p className="text-sm text-slate-600">Impact: {bottleneck.impact.toUpperCase()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">
                          {(bottleneck.averageWaitTime / 60000).toFixed(1)} min wait
                        </p>
                        <p className="text-xs text-slate-500">
                          {(bottleneck.averageDuration / 1000).toFixed(1)}s duration
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {results.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                <Target size={20} /> Recommendations
              </h3>
              <ul className="space-y-2">
                {results.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-blue-700">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!results && !loading && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Workflow size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600 font-medium">No workflow data yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Select an agent role and click "Discover Workflows" to analyze task execution patterns
          </p>
        </div>
      )}
    </div>
  );
};

export default ProcessMiningVisualizer;
















