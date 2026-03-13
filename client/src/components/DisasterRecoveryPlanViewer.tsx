/**
 * Disaster Recovery Plan Viewer Component
 * Displays disaster recovery plans and procedures
 */

import React, { useState, useEffect } from 'react';
import { Shield, Clock, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface DisasterRecoveryPlanViewerProps {
  projectId: string;
}

interface DisasterRecoveryPlan {
  _id: string;
  projectId: string;
  planName: string;
  rto: number; // Recovery Time Objective in minutes
  rpo: number; // Recovery Point Objective in minutes
  backupStrategy: {
    frequency: string;
    retention: string;
    locations: string[];
  };
  recoveryProcedures: Array<{
    step: number;
    description: string;
    estimatedTime: number;
  }>;
  failoverProcedures: Array<{
    step: number;
    description: string;
    estimatedTime: number;
  }>;
  createdAt: Date;
}

const DisasterRecoveryPlanViewer: React.FC<DisasterRecoveryPlanViewerProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<DisasterRecoveryPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlan();
  }, [projectId]);

  const loadPlan = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setPlan(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load disaster recovery plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Disaster Recovery Plan</h2>
        </div>
        <div className="flex gap-2">
          {plan && (
            <button
              onClick={() => {
                const dataStr = JSON.stringify(plan, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dr-plan-${projectId}-${Date.now()}.json`;
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          <button
            onClick={loadPlan}
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

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading disaster recovery plan...</p>
        </div>
      ) : plan ? (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="font-semibold text-lg mb-3">{plan.planName}</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Recovery Time Objective (RTO)</div>
                <div className="text-2xl font-bold text-blue-600">{plan.rto} minutes</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Recovery Point Objective (RPO)</div>
                <div className="text-2xl font-bold text-blue-600">{plan.rpo} minutes</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Backup Strategy</h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm mb-2">
                <span className="font-medium">Frequency:</span> {plan.backupStrategy.frequency}
              </div>
              <div className="text-sm mb-2">
                <span className="font-medium">Retention:</span> {plan.backupStrategy.retention}
              </div>
              <div className="text-sm">
                <span className="font-medium">Locations:</span> {plan.backupStrategy.locations.join(', ')}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Recovery Procedures</h3>
            <div className="space-y-2">
              {plan.recoveryProcedures.map((procedure, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
                    {procedure.step}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{procedure.description}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Est. {procedure.estimatedTime} minutes
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Failover Procedures</h3>
            <div className="space-y-2">
              {plan.failoverProcedures.map((procedure, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center font-medium">
                    {procedure.step}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{procedure.description}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Est. {procedure.estimatedTime} minutes
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No disaster recovery plan available.</p>
          <p className="text-sm mt-2">Generate a plan from the deployment settings.</p>
        </div>
      )}
    </div>
  );
};

export default DisasterRecoveryPlanViewer;



