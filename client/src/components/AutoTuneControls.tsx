/**
 * Auto-Tune Controls Component
 * UI for enabling/disabling auto-tuning and viewing auto-tuning history
 */

import React, { useState, useEffect } from 'react';
import {
  Settings, Play, Pause, History, TrendingUp, TrendingDown,
  RefreshCw, Loader2, CheckCircle, AlertTriangle, Clock
} from 'lucide-react';
import {
  triggerAutoTune,
  getAutoTuneHistory,
  AutoTuneResult
} from '../services/adminLLMRouterAIApi';

interface AutoTuneControlsProps {
  token?: string;
}

const AutoTuneControls: React.FC<AutoTuneControlsProps> = ({ token }) => {
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AutoTuneResult | null>(null);
  const [conservative, setConservative] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [token]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const result = await getAutoTuneHistory(token);
      setHistory(result.history || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    try {
      setRunning(true);
      setError(null);
      setLastResult(null);

      const result = await triggerAutoTune(token, {
        conservative
      });

      setLastResult(result);
      if (result.success) {
        await loadHistory();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to trigger auto-tuning');
    } finally {
      setRunning(false);
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'improved':
        return <TrendingUp className="text-green-600" size={16} />;
      case 'degraded':
        return <TrendingDown className="text-red-600" size={16} />;
      default:
        return <Clock className="text-slate-400" size={16} />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="text-blue-600" size={20} />
        <h3 className="text-lg font-semibold text-slate-800">Auto-Tuning Controls</h3>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">
                Enable automatic tuning
              </span>
            </label>
            <p className="text-xs text-slate-500 mt-1 ml-6">
              Automatically adjust router settings based on performance metrics
            </p>
          </div>
          <button
            onClick={handleTrigger}
            disabled={running || !enabled}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Tuning...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Now
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={conservative}
              onChange={(e) => setConservative(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">Conservative mode</span>
          </label>
          <span className="text-xs text-slate-500">
            (Make smaller, safer adjustments)
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertTriangle className="text-red-600 mt-0.5" size={16} />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {lastResult && (
        <div className={`p-4 border rounded-lg ${
          lastResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start gap-2">
            {lastResult.success ? (
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
            ) : (
              <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-slate-800 mb-1">
                {lastResult.success ? 'Auto-tuning completed' : 'No changes needed'}
              </h4>
              <p className="text-sm text-slate-600">{lastResult.expectedImprovement}</p>
              {lastResult.success && Object.keys(lastResult.changesApplied).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                    View changes
                  </summary>
                  <pre className="text-xs bg-slate-100 p-2 rounded mt-2 overflow-auto">
                    {JSON.stringify(lastResult.changesApplied, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="text-slate-600" size={16} />
            <h4 className="text-sm font-semibold text-slate-700">Tuning History</h4>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((entry, idx) => (
              <div key={idx} className="p-2 bg-white border border-slate-200 rounded text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  {getResultIcon(entry.result)}
                </div>
                {entry.metrics && (
                  <div className="mt-1 text-slate-500">
                    {Object.keys(entry.changes || {}).length} changes applied
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="animate-spin text-blue-600" size={20} />
        </div>
      )}
    </div>
  );
};

export default AutoTuneControls;
