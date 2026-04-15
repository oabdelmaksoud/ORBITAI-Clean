/**
 * Mutation Test Results Component
 * Displays mutation testing results (Stryker, Mutmut, PIT)
 */

import React, { useState, useEffect } from 'react';
import { Dna, Activity, CheckCircle, XCircle, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface MutationTestResultsProps {
  projectId: string;
  artifactId?: string;
}

interface MutationTestResult {
  id: string;
  tool: 'stryker' | 'mutmut' | 'pit' | 'llm';
  status: 'completed' | 'running' | 'failed';
  mutationScore: number;
  totalMutations: number;
  killedMutations: number;
  survivedMutations: number;
  timeoutMutations: number;
  noCoverageMutations: number;
  mutants: Array<{
    id: string;
    file: string;
    line: number;
    operator: string;
    status: 'killed' | 'survived' | 'timeout' | 'no_coverage';
    test: string;
  }>;
  executedAt: Date;
}

const MutationTestResults: React.FC<MutationTestResultsProps> = ({ projectId, artifactId }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MutationTestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadResults();
  }, [projectId, artifactId]);

  const loadResults = async () => {
    setLoading(true);
    try {
      // TODO(#44): Implement GET /api/projects/:projectId/mutation-tests when backend is ready
      setResults([]);
      setError('Mutation test results are not yet available. The backend endpoint is pending implementation.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load mutation test results');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredResults = results.filter(result => filterStatus === 'all' || result.status === filterStatus);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Dna className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-gray-900">Mutation Test Results</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadResults}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading mutation test results...</p>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Dna className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No mutation test results available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((result, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-semibold text-lg">Mutation Test ({result.tool.toUpperCase()})</div>
                  <div className="text-sm text-gray-600">
                    {new Date(result.executedAt).toLocaleString()}
                  </div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(result.mutationScore)}`}>
                  {result.mutationScore.toFixed(1)}%
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-600">Total Mutations</div>
                  <div className="text-lg font-semibold">{result.totalMutations}</div>
                </div>
                <div className="text-green-600">
                  <div className="text-xs">Killed</div>
                  <div className="text-lg font-semibold">{result.killedMutations}</div>
                </div>
                <div className="text-red-600">
                  <div className="text-xs">Survived</div>
                  <div className="text-lg font-semibold">{result.survivedMutations}</div>
                </div>
                <div className="text-yellow-600">
                  <div className="text-xs">Timeout</div>
                  <div className="text-lg font-semibold">{result.timeoutMutations}</div>
                </div>
                <div className="text-gray-600">
                  <div className="text-xs">No Coverage</div>
                  <div className="text-lg font-semibold">{result.noCoverageMutations}</div>
                </div>
              </div>

              {result.mutants.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Mutants:</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {result.mutants.map((mutant, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                        {mutant.status === 'killed' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-mono text-xs">{mutant.file}:{mutant.line}</span>
                        <span className="text-gray-600">{mutant.operator}</span>
                        {mutant.test && (
                          <span className="text-xs text-gray-500">({mutant.test})</span>
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

export default MutationTestResults;



