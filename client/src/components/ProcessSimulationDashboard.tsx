import React, { useState } from 'react';
import { Play, TestTube, TrendingUp, Loader2, AlertCircle } from 'lucide-react';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface ProcessSimulationDashboardProps {
  token: string;
  improvementId?: string;
}

const ProcessSimulationDashboard: React.FC<ProcessSimulationDashboardProps> = ({ token, improvementId: initialImprovementId }) => {
  const [improvementId, setImprovementId] = useState(initialImprovementId || '');
  const [scenarios, setScenarios] = useState<string>('[\n  {"name": "Scenario 1", "variables": {}}\n]');
  const [changes, setChanges] = useState<string>('{\n  "variable": "value"\n}');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  const handleSimulate = async () => {
    if (!improvementId.trim()) {
      showAlert('Please enter a Process Improvement ID');
      return;
    }

    let parsedScenarios;
    try {
      parsedScenarios = JSON.parse(scenarios);
    } catch (error) {
      alert('Invalid JSON in scenarios field');
      return;
    }

    setLoading(true);
    setActiveAction('simulate');
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/process-simulation/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ improvementId, scenarios: parsedScenarios }),
      });

      if (!response.ok) throw new Error('Failed to simulate');

      const result = await response.json();
      setResults({ action: 'simulate', data: result.data });
    } catch (error: any) {
      console.error('Simulation error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const handleWhatIf = async () => {
    if (!improvementId.trim()) {
      alert('Please enter a Process Improvement ID');
      return;
    }

    let parsedChanges;
    try {
      parsedChanges = JSON.parse(changes);
    } catch (error) {
      alert('Invalid JSON in changes field');
      return;
    }

    setLoading(true);
    setActiveAction('what-if');
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/process-simulation/what-if`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ improvementId, changes: parsedChanges }),
      });

      if (!response.ok) throw new Error('Failed to perform what-if analysis');

      const result = await response.json();
      setResults({ action: 'what-if', data: result.data });
    } catch (error: any) {
      console.error('What-if analysis error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const handlePredict = async () => {
    if (!improvementId.trim()) {
      alert('Please enter a Process Improvement ID');
      return;
    }

    setLoading(true);
    setActiveAction('predict');
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/process-simulation/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ improvementId, context: {} }),
      });

      if (!response.ok) throw new Error('Failed to predict', 'error');

      const result = await response.json();
      setResults({ action: 'predict', data: result.data });
    } catch (error: any) {
      console.error('Prediction error:', error);
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
          <h2 className="text-2xl font-bold text-slate-800">Process Simulation</h2>
          <p className="text-sm text-slate-500 mt-1">Simulate and test process improvements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Process Improvement ID
            </label>
            <input
              type="text"
              value={improvementId}
              onChange={(e) => setImprovementId(e.target.value)}
              placeholder="Enter Process Improvement ID"
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Scenarios (JSON)
            </label>
            <textarea
              value={scenarios}
              onChange={(e) => setScenarios(e.target.value)}
              placeholder='[{"name": "Scenario 1", "variables": {}}]'
              className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Changes (JSON) - for What-If Analysis
            </label>
            <textarea
              value={changes}
              onChange={(e) => setChanges(e.target.value)}
              placeholder='{"variable": "value"}'
              className="w-full h-24 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <button
              onClick={handleSimulate}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'simulate' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              Simulate
            </button>

            <button
              onClick={handleWhatIf}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'what-if' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <TestTube size={16} />
              )}
              What-If Analysis
            </button>

            <button
              onClick={handlePredict}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'predict' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <TrendingUp size={16} />
              )}
              Predict Performance
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
              <Play className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Run a simulation to see results</p>
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

export default ProcessSimulationDashboard;













