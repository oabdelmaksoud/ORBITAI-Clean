/**
 * Environment Management Component
 * Manages dev/staging/production environments
 */

import React, { useState, useEffect } from 'react';
import { Server, CheckCircle, XCircle, RefreshCw, Plus, Settings } from 'lucide-react';
import { apiRequest } from '@src/services/api';

interface EnvironmentManagementProps {
  projectId: string;
}

interface Environment {
  _id: string;
  projectId: string;
  name: 'development' | 'staging' | 'production';
  platform: string;
  configuration: any;
  status: 'active' | 'inactive' | 'deploying' | 'failed';
  createdAt: Date;
}

const EnvironmentManagement: React.FC<EnvironmentManagementProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnvironments();
  }, [projectId]);

  const loadEnvironments = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Environment[]>(
        '/api/projectResources/environments?projectId=' + projectId
      );
      setEnvironments(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  const deployEnvironment = async (envId: string) => {
    try {
      await apiRequest('/api/projectResources/environments/' + envId + '/deploy', {
        method: 'POST',
      });
      await loadEnvironments();
    } catch (err: any) {
      setError(err.message || 'Failed to deploy environment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'deploying': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />;
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Environment Management</h2>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Create Environment
          </button>
          <button
            onClick={loadEnvironments}
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
          <p className="text-gray-600">Loading environments...</p>
        </div>
      ) : environments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Server className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No environments configured.</p>
          <p className="text-sm mt-2">Click "Create Environment" to set up dev/staging/production.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {environments.map((env, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-lg">{env.name.toUpperCase()}</div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(env.status)}
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(env.status)}`}>
                    {env.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-2">Platform: {env.platform}</div>
              <div className="text-xs text-gray-500">
                Created: {new Date(env.createdAt).toLocaleDateString()}
              </div>
              <button className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => deployEnvironment(env._id)}>
                Deploy
              </button>
              <button className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">
                <Settings className="w-4 h-4" />
                Configure
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnvironmentManagement;



