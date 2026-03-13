import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Rocket, CheckCircle2, XCircle, Loader2, Play, Settings, AlertCircle, RefreshCw, History, Filter, Search, Calendar, ChevronDown, Key, FileText } from 'lucide-react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { showAlert, showConfirm } from '../utils/browserUtils';
import { io, Socket } from 'socket.io-client';
import DeploymentWizard from './DeploymentWizard';

interface Deployment {
  id: string;
  projectId: string;
  projectName: string;
  platform: 'aws' | 'azure' | 'gcp' | 'vercel' | 'heroku';
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'stopped';
  environment: 'development' | 'staging' | 'production';
  url?: string;
  createdAt: Date;
  updatedAt: Date;
  logs?: string[];
}

interface CloudDeploymentProps {
  projectId?: string;
  projectName?: string;
  userRole?: string;
  token?: string;
}

const CloudDeployment: React.FC<CloudDeploymentProps> = ({
  projectId,
  projectName,
  userRole = 'user',
  token
}) => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showDeploymentWizard, setShowDeploymentWizard] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'aws' | 'azure' | 'gcp' | 'vercel' | 'railway' | 'render' | 'netlify' | 'heroku'>('vercel');
  const [selectedEnvironment, setSelectedEnvironment] = useState<'development' | 'staging' | 'production'>('staging');
  const [showHistory, setShowHistory] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeploymentLogs, setSelectedDeploymentLogs] = useState<string | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeDeploymentIdsRef = useRef<Set<string>>(new Set());

  const canDeploy = useFeatureAccess('cloud_deployment', userRole);

  useEffect(() => {
    if (canDeploy.enabled && projectId) {
      loadDeployments();
    }
  }, [canDeploy.enabled, projectId]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!canDeploy.enabled) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    socketRef.current = io(apiUrl, {
      transports: ['polling', 'websocket'], // Try polling first (less noisy)
      reconnection: false, // Disable automatic reconnection
      reconnectionDelay: 5000,
      reconnectionAttempts: 1, // Only try once
      timeout: 5000, // Fail fast
      upgrade: false // Disable automatic upgrade
    });

    socketRef.current.on('connect', () => {
      if (import.meta.env.DEV) {
        console.log('[Deployment] WebSocket connected');
      }
    });

    socketRef.current.on('room-message', (message: any) => {
      if (message.type === 'deployment.created' || 
          message.type === 'deployment.status' || 
          message.type === 'deployment.log' || 
          message.type === 'deployment.completed') {
        handleDeploymentUpdate(message);
      }
    });

    socketRef.current.on('disconnect', () => {
      // Silently handle disconnections - backend may not be running
    });
    
    socketRef.current.on('connect_error', () => {
      // Silently handle connection errors - backend may not be running
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [canDeploy.enabled]);

  const handleDeploymentUpdate = (message: any) => {
    setDeployments(prev => {
      const index = prev.findIndex(d => d.id === message.deploymentId || d.id === message.deployment?.id);
      if (index === -1 && message.deployment) {
        // New deployment
        return [...prev, {
          ...message.deployment,
          createdAt: new Date(),
          updatedAt: new Date(),
          logs: []
        }];
      } else if (index !== -1) {
        // Update existing deployment
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: message.status || updated[index].status,
          url: message.url || updated[index].url,
          logs: message.logs || updated[index].logs || [],
          updatedAt: new Date(),
        };
        return updated;
      }
      return prev;
    });
  };

  const loadDeployments = async () => {
    if (!canDeploy.enabled || !projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const authToken = token || localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/deployments?projectId=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setDeployments(data.deployments.map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        })));
      } else {
        throw new Error(data.message || 'Failed to load deployments');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load deployments');
      console.error('Failed to load deployments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (config: any) => {
    if (!projectId) {
      showAlert('Project ID is required', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setShowDeploymentWizard(false);

    try {
      const authToken = token || localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          projectId,
          platform: config.platform,
          environment: config.environment,
          envVars: config.envVars || {},
          region: config.region,
          buildCommand: config.buildCommand,
          startCommand: config.startCommand,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        showAlert(`Deployment started to ${config.platform}`, 'success');
        loadDeployments();
      } else {
        throw new Error(data.message || 'Failed to start deployment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to deploy');
      showAlert(`Failed to deploy: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStopDeployment = async (deploymentId: string) => {
    if (!(await showConfirm('Stop this deployment?'))) return;

    try {
      const authToken = token || localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/deployments/${deploymentId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        showAlert('Deployment stopped', 'success');
        loadDeployments();
      } else {
        throw new Error(data.message || 'Failed to stop deployment');
      }
    } catch (err: any) {
      showAlert(`Failed to stop deployment: ${err.message}`, 'error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={16} className="text-green-600" />;
      case 'failed':
        return <XCircle size={16} className="text-red-600" />;
      case 'deploying':
        return <Loader2 size={16} className="text-blue-600 animate-spin" />;
      case 'pending':
        return <Loader2 size={16} className="text-yellow-600" />;
      default:
        return <XCircle size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'deploying':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPlatformIcon = (platform: string) => {
    return <Cloud size={16} className="text-blue-600" />;
  };

  if (!canDeploy.enabled && !canDeploy.loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
        <h3 className="font-bold text-yellow-800 mb-1">Cloud Deployment Disabled</h3>
        <p className="text-sm text-yellow-700">
          Cloud deployment is not enabled for your role or package. Contact an administrator to enable this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-slate-800">Cloud Deployment</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDeployments}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowDeploymentWizard(true)}
            disabled={!projectId}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Rocket size={14} />
            Deploy
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && deployments.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {/* Filters and History Toggle */}
      {deployments.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search deployments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 outline-none text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="deploying">Deploying</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="stopped">Stopped</option>
          </select>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              showHistory 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <History size={16} />
            History
          </button>
        </div>
      )}

      {/* Deployments List */}
      {deployments.length === 0 && !loading && (
        <div className="text-center py-8 text-slate-500">
          <Cloud size={32} className="mx-auto mb-2 opacity-50" />
          <p>No deployments yet</p>
          <p className="text-sm mt-1">Click "Deploy" to start your first deployment</p>
        </div>
      )}

      {deployments.length > 0 && (
        <div className="space-y-3">
          {deployments
            .filter(d => {
              const matchesSearch = !searchQuery || 
                d.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.platform.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
              const isHistorical = showHistory ? 
                (d.status === 'success' || d.status === 'failed' || d.status === 'stopped') :
                (d.status === 'pending' || d.status === 'deploying');
              return matchesSearch && matchesStatus && isHistorical === showHistory;
            })
            .map((deployment) => (
            <div
              key={deployment.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getPlatformIcon(deployment.platform)}
                    <h3 className="font-semibold text-slate-800">{deployment.projectName}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(deployment.status)}`}>
                      {getStatusIcon(deployment.status)}
                      <span className="ml-1 capitalize">{deployment.status}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 capitalize">
                      {deployment.environment}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                    <span>Platform: {deployment.platform.toUpperCase()}</span>
                    <span>•</span>
                    <span>Updated: {deployment.updatedAt.toLocaleString()}</span>
                  </div>
                  {deployment.url && (
                    <a
                      href={deployment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <span>{deployment.url}</span>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {deployment.status === 'deploying' && (
                    <button
                      onClick={() => handleStopDeployment(deployment.id)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                      Stop
                    </button>
                  )}
                  {deployment.status === 'success' && deployment.url && (
                    <a
                      href={deployment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <Play size={14} />
                      Visit
                    </a>
                  )}
                  <button
                    onClick={() => setSelectedDeploymentLogs(
                      selectedDeploymentLogs === deployment.id ? null : deployment.id
                    )}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center gap-1"
                  >
                    <Settings size={14} />
                    {selectedDeploymentLogs === deployment.id ? 'Hide' : 'View'} Logs
                  </button>
                </div>
              </div>
              
              {/* Real-time Logs */}
              {selectedDeploymentLogs === deployment.id && (
                <div className="mt-4 bg-slate-900 text-green-400 rounded-lg p-4 font-mono text-xs max-h-64 overflow-y-auto">
                  {deployment.logs && deployment.logs.length > 0 ? (
                    deployment.logs.map((log, idx) => (
                      <div key={idx} className="mb-1">{log}</div>
                    ))
                  ) : (
                    <div className="text-slate-500">No logs available yet...</div>
                  )}
                  {deployment.status === 'deploying' && (
                    <div className="mt-2 flex items-center gap-2 text-yellow-400">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Deployment in progress...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Deploy to Cloud</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="vercel">Vercel</option>
                  <option value="aws">AWS</option>
                  <option value="azure">Azure</option>
                  <option value="gcp">Google Cloud Platform</option>
                  <option value="heroku">Heroku</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Environment</label>
                <select
                  value={selectedEnvironment}
                  onChange={(e) => setSelectedEnvironment(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Make sure you have configured your cloud platform credentials in the settings.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowDeployModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeploy}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket size={16} />
                    Deploy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Wizard */}
      {showDeploymentWizard && projectId && projectName && (
        <DeploymentWizard
          projectId={projectId}
          projectName={projectName}
          onDeploy={handleDeploy}
          onCancel={() => setShowDeploymentWizard(false)}
        />
      )}
    </div>
  );
};

export default CloudDeployment;

