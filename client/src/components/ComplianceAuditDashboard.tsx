import React, { useState } from 'react';
import { Shield, CheckCircle, Calendar, FileText, Loader2, AlertTriangle } from 'lucide-react';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface ComplianceAuditDashboardProps {
  token: string;
  improvementId?: string;
}

const ComplianceAuditDashboard: React.FC<ComplianceAuditDashboardProps> = ({ token, improvementId: initialImprovementId }) => {
  const [improvementId, setImprovementId] = useState(initialImprovementId || '');
  const [standardIds, setStandardIds] = useState<string>('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  const handleCheckCompliance = async () => {
    if (!improvementId.trim()) {
      showAlert('Please enter a Process Improvement ID');
      return;
    }

    setLoading(true);
    setActiveAction('check');
    setResults(null);

    try {
      const parsedStandardIds = standardIds.trim() ? standardIds.split(',').map(s => s.trim()) : undefined;

      const response = await fetch(`${API_BASE_URL}/api/admin/compliance/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ improvementId, standardIds: parsedStandardIds }),
      });

      if (!response.ok) throw new Error('Failed to check compliance');

      const result = await response.json();
      setResults({ action: 'check', data: result.data });
    } catch (error: any) {
      console.error('Compliance check error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const handleScheduleAudit = async () => {
    if (!improvementId.trim()) {
      alert('Please enter a Process Improvement ID');
      return;
    }

    setLoading(true);
    setActiveAction('schedule');
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/compliance/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ improvementId, frequency }),
      });

      if (!response.ok) throw new Error('Failed to schedule audit');

      const result = await response.json();
      setResults({ action: 'schedule', data: result.data });
    } catch (error: any) {
      console.error('Schedule audit error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const handleMapRegulations = async () => {
    if (!improvementId.trim()) {
      alert('Please enter a Process Improvement ID');
      return;
    }

    setLoading(true);
    setActiveAction('regulations');
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/compliance/regulations/${improvementId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to map regulations');

      const result = await response.json();
      setResults({ action: 'regulations', data: result.data });
    } catch (error: any) {
      console.error('Map regulations error:', error);
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
          <h2 className="text-2xl font-bold text-slate-800">Compliance & Audit</h2>
          <p className="text-sm text-slate-500 mt-1">Compliance checking and audit management</p>
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
              Standard IDs (comma-separated, optional)
            </label>
            <input
              type="text"
              value={standardIds}
              onChange={(e) => setStandardIds(e.target.value)}
              placeholder="standard1, standard2, ..."
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Audit Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly', 'error')}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleCheckCompliance}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'check' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              Check Compliance
            </button>

            <button
              onClick={handleScheduleAudit}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'schedule' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Calendar size={16} />
              )}
              Schedule Audit
            </button>

            <button
              onClick={handleMapRegulations}
              disabled={loading || !improvementId.trim()}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && activeAction === 'regulations' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              Map to Regulations
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
              <Shield className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Select an action to see compliance results</p>
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

export default ComplianceAuditDashboard;













