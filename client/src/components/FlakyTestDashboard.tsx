/**
 * Flaky Test Dashboard Component
 * Detects and remediates flaky tests
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Download, Wrench } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface FlakyTestDashboardProps {
  projectId: string;
}

interface FlakyTest {
  _id: string;
  projectId: string;
  testName: string;
  testFile: string;
  flakinessRate: number;
  failurePattern: 'intermittent' | 'time_dependent' | 'race_condition' | 'external_dependency' | 'shared_state' | 'unknown';
  causes: string[];
  fixes: Array<{
    type: string;
    description: string;
    code?: string;
  }>;
  lastDetected: Date;
}

const FlakyTestDashboard: React.FC<FlakyTestDashboardProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<FlakyTest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFlakyTests();
  }, [projectId]);

  const loadFlakyTests = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setTests([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load flaky tests');
    } finally {
      setLoading(false);
    }
  };

  const getPatternColor = (pattern: string) => {
    switch (pattern) {
      case 'race_condition': return 'bg-red-100 text-red-800';
      case 'time_dependent': return 'bg-orange-100 text-orange-800';
      case 'external_dependency': return 'bg-yellow-100 text-yellow-800';
      case 'shared_state': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900">Flaky Test Dashboard</h2>
        </div>
        <button
          onClick={loadFlakyTests}
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
          <p className="text-gray-600">Loading flaky tests...</p>
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p>No flaky tests detected.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test, index) => (
            <div key={index} className="p-4 border-2 border-yellow-200 bg-yellow-50 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-lg">{test.testName}</div>
                  <div className="text-sm text-gray-600">{test.testFile}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">{test.flakinessRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-600">Flakiness Rate</div>
                </div>
              </div>

              <div className="mb-3">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getPatternColor(test.failurePattern)}`}>
                  {test.failurePattern.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {test.causes.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm font-medium mb-1">Causes:</div>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {test.causes.map((cause, i) => (
                      <li key={i}>{cause}</li>
                    ))}
                  </ul>
                </div>
              )}

              {test.fixes.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Suggested Fixes:</div>
                  <div className="space-y-2">
                    {test.fixes.map((fix, i) => (
                      <div key={i} className="p-2 bg-white rounded border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-sm">{fix.type}</span>
                        </div>
                        <div className="text-sm text-gray-700">{fix.description}</div>
                        {fix.code && (
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono overflow-x-auto">
                            {fix.code}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlakyTestDashboard;



