/**
 * Test Maintenance Status Component
 * Tracks test maintenance and updates
 */

import React, { useState, useEffect } from 'react';
import { Wrench, CheckCircle, Clock, AlertTriangle, RefreshCw, Download, XCircle } from 'lucide-react';
import { apiRequest } from '@src/services/api';

interface TestMaintenanceStatusProps {
  projectId: string;
}

interface TestUpdate {
  testId: string;
  testName: string;
  testFile: string;
  status: 'updated' | 'needs_update' | 'new' | 'obsolete';
  reason: string;
  changes: Array<{
    type: 'added' | 'modified' | 'removed';
    description: string;
  }>;
  updatedAt?: Date;
}

interface TestMaintenanceReport {
  updates: TestUpdate[];
  summary: {
    total: number;
    updated: number;
    needsUpdate: number;
    new: number;
    obsolete: number;
  };
}

const TestMaintenanceStatus: React.FC<TestMaintenanceStatusProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TestMaintenanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, [projectId]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<TestMaintenanceReport>(
        '/api/projectResources/test-maintenance?projectId=' + projectId
      );
      setReport(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load test maintenance status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'updated': return 'bg-green-100 text-green-800';
      case 'needs_update': return 'bg-yellow-100 text-yellow-800';
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'obsolete': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'updated': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'needs_update': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'new': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'obsolete': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Test Maintenance Status</h2>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading test maintenance status...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{report.summary.total}</div>
              <div className="text-sm text-gray-600">Total Tests</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{report.summary.updated}</div>
              <div className="text-sm text-green-600">Updated</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{report.summary.needsUpdate}</div>
              <div className="text-sm text-yellow-600">Needs Update</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{report.summary.new}</div>
              <div className="text-sm text-blue-600">New Tests</div>
            </div>
          </div>

          <div className="space-y-3">
            {report.updates.map((update, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold">{update.testName}</div>
                    <div className="text-sm text-gray-600">{update.testFile}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(update.status)}
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(update.status)}`}>
                      {update.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-2">{update.reason}</div>
                {update.changes.length > 0 && (
                  <div className="space-y-1">
                    {update.changes.map((change, i) => (
                      <div key={i} className="text-xs text-gray-600">
                        <span className={`px-1 py-0.5 rounded ${
                          change.type === 'added' ? 'bg-green-100 text-green-800' :
                          change.type === 'removed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {change.type}
                        </span>
                        {' '}{change.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No test maintenance data available.</p>
        </div>
      )}
    </div>
  );
};

export default TestMaintenanceStatus;



