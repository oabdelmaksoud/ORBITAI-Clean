/**
 * Hosting Dashboard Component
 * Allows users to view and manage their hosted projects
 */

import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Globe, 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw, 
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  Activity
} from 'lucide-react';
import { showAlert, showConfirm } from '../utils/browserUtils';

interface HostedProject {
  id: string;
  projectId: string;
  projectName: string;
  platform: string;
  environment: string;
  url?: string;
  status: 'active' | 'suspended' | 'terminated';
  resourceUsage: {
    compute?: number;
    storage?: number;
    bandwidth?: number;
    buildMinutes?: number;
  };
  billing: {
    currentPeriodStart: string;
    currentPeriodEnd: string;
    amount: number;
    currency: string;
  };
}

interface HostingPlan {
  platform: string;
  projectType: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  setupFee: number;
  features: string[];
}

const HostingDashboard: React.FC = () => {
  const [hostedProjects, setHostedProjects] = useState<HostedProject[]>([]);
  const [hostingPlans, setHostingPlans] = useState<HostingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHostedProjects();
    loadHostingPlans();
  }, []);

  const loadHostedProjects = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/hosting/projects`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setHostedProjects(data.hostedProjects || []);
      } else {
        throw new Error(data.message || 'Failed to load hosted projects');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load hosted projects');
    } finally {
      setLoading(false);
    }
  };

  const loadHostingPlans = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/hosting/plans`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setHostingPlans(data.plans || []);
      }
    } catch (err: any) {
      // Silently fail - plans are optional
    }
  };

  const handleSuspend = async (id: string) => {
    if (!(await showConfirm('Suspend this hosting? The project will be temporarily unavailable.'))) {
      return;
    }

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/hosting/${id}/suspend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        showAlert('Hosting suspended', 'success');
        loadHostedProjects();
      } else {
        throw new Error(data.message || 'Failed to suspend hosting');
      }
    } catch (err: any) {
      showAlert(`Failed to suspend: ${err.message}`, 'error');
    }
  };

  const handleTerminate = async (id: string) => {
    if (!(await showConfirm('Terminate this hosting? This action cannot be undone.'))) {
      return;
    }

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/hosting/${id}/terminate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        showAlert('Hosting terminated', 'success');
        loadHostedProjects();
      } else {
        throw new Error(data.message || 'Failed to terminate hosting');
      }
    } catch (err: any) {
      showAlert(`Failed to terminate: ${err.message}`, 'error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 size={16} className="text-green-600" />;
      case 'suspended':
        return <Pause size={16} className="text-yellow-600" />;
      case 'terminated':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return <AlertCircle size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'terminated':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-slate-800">Hosting Dashboard</h2>
        </div>
        <button
          onClick={loadHostedProjects}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Hosted Projects */}
      {loading && hostedProjects.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : hostedProjects.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <Cloud size={48} className="mx-auto mb-4 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Hosted Projects</h3>
          <p className="text-sm text-slate-600 mb-4">
            Deploy your completed projects to get started with hosting.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {hostedProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-slate-800">{project.projectName}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border flex items-center gap-1 ${getStatusColor(project.status)}`}>
                      {getStatusIcon(project.status)}
                      {project.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Globe size={14} />
                      {project.platform}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity size={14} />
                      {project.environment}
                    </span>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Globe size={14} />
                        View Site
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {project.status === 'active' && (
                    <button
                      onClick={() => handleSuspend(project.id)}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      title="Suspend"
                    >
                      <Pause size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleTerminate(project.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Terminate"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Resource Usage */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Compute</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {project.resourceUsage.compute?.toFixed(2) || '0'} hrs
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Storage</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {project.resourceUsage.storage?.toFixed(2) || '0'} GB
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Bandwidth</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {project.resourceUsage.bandwidth?.toFixed(2) || '0'} GB
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Monthly Cost</div>
                  <div className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    <DollarSign size={14} />
                    {project.billing.amount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Billing Period */}
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                <Calendar size={12} />
                <span>
                  Billing period: {new Date(project.billing.currentPeriodStart).toLocaleDateString()} - {new Date(project.billing.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hosting Plans */}
      {hostingPlans.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Available Hosting Plans</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {hostingPlans.map((plan, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-800">{plan.platform}</span>
                  <span className="text-lg font-bold text-blue-600">
                    ${plan.monthlyPrice}/mo
                  </span>
                </div>
                <div className="text-xs text-slate-600 mb-3">
                  {plan.projectType} projects
                </div>
                {plan.features.length > 0 && (
                  <ul className="text-xs text-slate-600 space-y-1">
                    {plan.features.slice(0, 3).map((feature, fIdx) => (
                      <li key={fIdx}>• {feature}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HostingDashboard;




