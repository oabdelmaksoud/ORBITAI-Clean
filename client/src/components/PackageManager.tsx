import React, { useState } from 'react';
import { Package, getPackages, createPackage, updatePackage, deletePackage } from '../services/adminApiExtended';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, Loader2 } from 'lucide-react';

import { showAlert, showConfirm } from '../utils/browserUtils';
import { toast } from '../services/toastService';

// Function to create 3 default packages
async function createDefaultPackages(token: string) {
  const defaultPackages = [
    {
      displayName: 'Starter',
      description: 'Perfect for getting started with ORBIT AI',
      price: 0,
      billingCycle: 'lifetime' as const,
      features: [
        { key: 'maxAgents', label: 'Max Agents', value: 3, type: 'number' as const },
        { key: 'basicArtifacts', label: 'Basic Artifacts', value: true, type: 'boolean' as const },
        { key: 'communitySupport', label: 'Community Support', value: true, type: 'boolean' as const },
        { key: 'maxProjects', label: 'Max Projects', value: 1, type: 'number' as const },
        { key: 'basicLLM', label: 'Basic LLM Access (Gemini Flash)', value: true, type: 'boolean' as const },
        { key: 'limitedTokens', label: '100K Tokens/Month', value: 100000, type: 'number' as const }
      ],
      limits: {
        maxProjects: 1,
        maxAgents: 3,
        maxTasks: 10,
        maxStorageGB: 1,
        maxAPICalls: 1000,
        maxTeamMembers: 1,
        maxMonthlyBudget: 50,
        maxFileSizeMB: 10,
        maxMCPServers: 3,
        maxArtifactsPerProject: 50,
        maxBackupVersions: 3,
        maxConcurrentExecutions: 1,
        internetAccessEnabled: false,
        codeExecutionEnabled: false,
        cloudDeploymentEnabled: false,
        maxLLMCallsPerMonth: 1000,
        maxTokensPerMonth: 100000,
        allowedLLMModels: ['gemini-2.5-flash'],
        multiLLMEnabled: false,
        premiumModelsEnabled: false
      },
      isActive: true,
      isDefault: true,
      sortOrder: 1,
      metadata: {
        color: 'bg-slate-100',
        icon: 'Layout',
        highlight: false
      }
    },
    {
      displayName: 'Pro',
      description: 'For professional developers and teams',
      price: 49,
      billingCycle: 'monthly' as const,
      features: [
        { key: 'unlimitedAgents', label: 'Unlimited Agents', value: true, type: 'boolean' as const },
        { key: 'autoPilot', label: 'Auto-Pilot Mode', value: true, type: 'boolean' as const },
        { key: 'codeExport', label: 'Code Export (ZIP)', value: true, type: 'boolean' as const },
        { key: 'prioritySupport', label: 'Priority Support', value: true, type: 'boolean' as const },
        { key: 'cloudDeployment', label: 'Cloud Deployment', value: true, type: 'boolean' as const },
        { key: 'multiLLM', label: 'Multi-LLM Intelligent Routing', value: true, type: 'boolean' as const },
        { key: 'premiumModels', label: 'Premium Models (GPT-4o, Claude, DeepSeek, Grok)', value: true, type: 'boolean' as const },
        { key: 'advancedLLM', label: '5M Tokens/Month', value: 5000000, type: 'number' as const }
      ],
      limits: {
        maxProjects: 10,
        maxAgents: -1, // Unlimited
        maxTasks: 100,
        maxStorageGB: 10,
        maxAPICalls: 10000,
        maxTeamMembers: 5,
        maxMonthlyBudget: 500,
        maxFileSizeMB: 50,
        maxMCPServers: 10,
        maxArtifactsPerProject: 500,
        maxBackupVersions: 10,
        maxConcurrentExecutions: 5,
        internetAccessEnabled: true,
        codeExecutionEnabled: true,
        cloudDeploymentEnabled: true,
        maxLLMCallsPerMonth: 50000,
        maxTokensPerMonth: 5000000,
        allowedLLMModels: [
          'gemini-2.5-flash',
          'gemini-3-pro',
          'gpt-4o',
          'gpt-4o-mini',
          'claude-3-5-sonnet',
          'deepseek-chat',
          'deepseek-coder',
          'grok-beta'
        ],
        multiLLMEnabled: true,
        premiumModelsEnabled: true
      },
      isActive: true,
      isDefault: false,
      sortOrder: 2,
      metadata: {
        color: 'bg-blue-500',
        icon: 'Zap',
        highlight: true
      }
    },
    {
      displayName: 'Enterprise',
      description: 'For teams and organizations with advanced needs',
      price: 199,
      billingCycle: 'monthly' as const,
      features: [
        { key: 'everythingInPro', label: 'Everything in Pro', value: true, type: 'boolean' as const },
        { key: 'adminPortal', label: 'Admin Portal', value: true, type: 'boolean' as const },
        { key: 'sso', label: 'SSO & Audit Logs', value: true, type: 'boolean' as const },
        { key: 'customModels', label: 'Custom Models', value: true, type: 'boolean' as const },
        { key: 'dedicatedSupport', label: 'Dedicated Support', value: true, type: 'boolean' as const },
        { key: 'unlimitedLLM', label: 'Unlimited LLM Access', value: true, type: 'boolean' as const },
        { key: 'allModels', label: 'All Premium Models + Custom', value: true, type: 'boolean' as const },
        { key: 'unlimitedTokens', label: 'Unlimited Tokens/Month', value: true, type: 'boolean' as const },
        { key: 'priorityLLMRouting', label: 'Priority LLM Routing', value: true, type: 'boolean' as const }
      ],
      limits: {
        maxProjects: -1, // Unlimited
        maxAgents: -1, // Unlimited
        maxTasks: -1, // Unlimited
        maxStorageGB: 100,
        maxAPICalls: 100000,
        maxTeamMembers: -1, // Unlimited
        maxMonthlyBudget: -1, // Unlimited
        maxFileSizeMB: 500,
        maxMCPServers: -1, // Unlimited
        maxArtifactsPerProject: -1, // Unlimited
        maxBackupVersions: 100,
        maxConcurrentExecutions: -1, // Unlimited
        internetAccessEnabled: true,
        codeExecutionEnabled: true,
        cloudDeploymentEnabled: true,
        maxLLMCallsPerMonth: -1, // Unlimited
        maxTokensPerMonth: -1, // Unlimited
        allowedLLMModels: [
          'gemini-2.5-flash',
          'gemini-3-pro',
          'gpt-4o',
          'gpt-4o-mini',
          'claude-3-5-sonnet',
          'deepseek-chat',
          'deepseek-coder',
          'grok-beta'
        ],
        multiLLMEnabled: true,
        premiumModelsEnabled: true
      },
      isActive: true,
      isDefault: false,
      sortOrder: 3,
      metadata: {
        color: 'bg-slate-900',
        icon: 'Shield',
        highlight: false
      }
    }
  ];

  // Check existing packages
  const existingPackages = await getPackages(token);
  const existingNames = new Set(existingPackages.map(p => p.displayName));

  let createdCount = 0;
  for (const pkg of defaultPackages) {
    // Skip if package with same name already exists
    if (existingNames.has(pkg.displayName)) {
      continue;
    }
    
    try {
      await createPackage(token, pkg);
      createdCount++;
    } catch (error: any) {
      // If package already exists or other error, continue with next package
      console.warn(`Failed to create package "${pkg.displayName}":`, error.message);
    }
  }

  if (createdCount === 0) {
    throw new Error('All default packages already exist');
  }
}
interface PackageManagerProps {
  token: string;
  packages: Package[];
  onRefresh: () => void;
}

const PackageManager: React.FC<PackageManagerProps> = ({ token, packages, onRefresh }) => {
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setEditingPackage({
      id: '', // Will be set by backend after creation
      displayName: '',
      description: '',
      price: 0,
      billingCycle: 'monthly',
      features: [],
      limits: {
        maxProjects: 1,
        maxAgents: 3,
        maxTasks: 10,
        maxStorageGB: 1,
        maxAPICalls: 1000,
        maxTeamMembers: 1,
        maxMonthlyBudget: 50,
        maxFileSizeMB: 10,
        maxMCPServers: 3,
        maxArtifactsPerProject: 100,
        maxBackupVersions: 5,
        maxConcurrentExecutions: 1,
        internetAccessEnabled: false,
        codeExecutionEnabled: false,
        cloudDeploymentEnabled: false,
        maxLLMCallsPerMonth: 1000,
        maxTokensPerMonth: 100000,
        allowedLLMModels: ['gemini-2.5-flash'],
        multiLLMEnabled: false,
        premiumModelsEnabled: false
      },
      isActive: true,
      isDefault: false,
      sortOrder: packages.length + 1,
      metadata: {}
    });
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editingPackage) return;
    setLoading(true);
    setError(null);

    try {
      if (isCreating) {
        await createPackage(token, editingPackage);
      } else {
        await updatePackage(token, editingPackage.id, editingPackage);
      }
      setEditingPackage(null);
      setIsCreating(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save package');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to delete this package?'))) return;
    setLoading(true);
    setError(null);

    try {
      await deletePackage(token, id);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete package');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (editingPackage) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">
            {isCreating ? 'Create Package' : 'Edit Package'}
          </h3>
          <button
            onClick={() => {
              setEditingPackage(null);
              setIsCreating(false);
            }}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Package Name</label>
            <input
              type="text"
              value={editingPackage.displayName}
              onChange={(e) => setEditingPackage({ ...editingPackage, displayName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Starter Plan"
              required
            />
            <p className="text-xs text-slate-500 mt-1">This is the name shown to users</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
            <input
              type="number"
              value={editingPackage.price}
              onChange={(e) => setEditingPackage({ ...editingPackage, price: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle</label>
            <select
              value={editingPackage.billingCycle}
              onChange={(e) => setEditingPackage({ ...editingPackage, billingCycle: e.target.value as 'monthly' | 'yearly' | 'lifetime' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={editingPackage.description}
              onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              rows={3}
              placeholder="Package description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Active Status</label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingPackage.isActive}
                onChange={(e) => setEditingPackage({ ...editingPackage, isActive: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-600">Package is active</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Limits Configuration</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max Projects</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxProjects === -1 ? '' : editingPackage.limits.maxProjects}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxProjects: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max Agents</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxAgents === -1 ? '' : editingPackage.limits.maxAgents}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxAgents: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max Tasks</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxTasks === -1 ? '' : editingPackage.limits.maxTasks}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxTasks: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max Storage (GB)</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxStorageGB === -1 ? '' : editingPackage.limits.maxStorageGB}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseFloat(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxStorageGB: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                    step="0.1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max API Calls</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxAPICalls === -1 ? '' : editingPackage.limits.maxAPICalls}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxAPICalls: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>
              </div>

              {/* Team & Collaboration Limits */}
              <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2">Team & Collaboration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Team Members</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxTeamMembers === -1 ? '' : editingPackage.limits.maxTeamMembers}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxTeamMembers: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Concurrent Executions</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxConcurrentExecutions === -1 ? '' : editingPackage.limits.maxConcurrentExecutions}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxConcurrentExecutions: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>
              </div>

              {/* Budget & Cost Limits */}
              <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2">Budget & Cost</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Monthly Budget (USD)</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxMonthlyBudget === -1 ? '' : editingPackage.limits.maxMonthlyBudget}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseFloat(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxMonthlyBudget: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                    step="0.01"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>
              </div>

              {/* File & Storage Limits */}
              <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2">File & Storage</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max File Size (MB)</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxFileSizeMB === -1 ? '' : editingPackage.limits.maxFileSizeMB}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxFileSizeMB: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Artifacts Per Project</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxArtifactsPerProject === -1 ? '' : editingPackage.limits.maxArtifactsPerProject}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxArtifactsPerProject: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Backup Versions</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxBackupVersions === -1 ? '' : editingPackage.limits.maxBackupVersions}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxBackupVersions: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>
              </div>

              {/* Feature & Integration Limits */}
              <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2">Features & Integrations</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max MCP Servers</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxMCPServers === -1 ? '' : editingPackage.limits.maxMCPServers}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxMCPServers: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>
              </div>

              {/* Feature Toggles */}
              <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2">Feature Toggles</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-4 border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    id="internetAccess"
                    checked={editingPackage.limits.internetAccessEnabled}
                    onChange={(e) => {
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, internetAccessEnabled: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="internetAccess" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Internet Access
                  </label>
                </div>

                <div className="flex items-center gap-2 p-4 border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    id="codeExecution"
                    checked={editingPackage.limits.codeExecutionEnabled}
                    onChange={(e) => {
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, codeExecutionEnabled: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="codeExecution" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Code Execution (E2B)
                  </label>
                </div>

                <div className="flex items-center gap-2 p-4 border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    id="cloudDeployment"
                    checked={editingPackage.limits.cloudDeploymentEnabled}
                    onChange={(e) => {
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, cloudDeploymentEnabled: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="cloudDeployment" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Cloud Deployment
                  </label>
                </div>
              </div>

              {/* LLM Limits Configuration */}
              <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2">LLM Limits</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max LLM Calls Per Month</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxLLMCallsPerMonth === -1 ? '' : editingPackage.limits.maxLLMCallsPerMonth || 1000}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxLLMCallsPerMonth: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Tokens Per Month</label>
                  <input
                    type="number"
                    value={editingPackage.limits.maxTokensPerMonth === -1 ? '' : editingPackage.limits.maxTokensPerMonth || 100000}
                    onChange={(e) => {
                      const value = e.target.value === '' ? -1 : parseInt(e.target.value) || 0;
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, maxTokensPerMonth: value }
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Unlimited (-1)"
                    min="-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use -1 for unlimited</p>
                </div>
              </div>

              {/* LLM Feature Toggles */}
              <h4 className="text-lg font-bold text-slate-800 mt-6 mb-2">LLM Features</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-4 border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    id="multiLLM"
                    checked={editingPackage.limits.multiLLMEnabled || false}
                    onChange={(e) => {
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, multiLLMEnabled: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="multiLLM" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Multi-LLM Intelligent Routing
                  </label>
                </div>

                <div className="flex items-center gap-2 p-4 border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    id="premiumModels"
                    checked={editingPackage.limits.premiumModelsEnabled || false}
                    onChange={(e) => {
                      setEditingPackage({
                        ...editingPackage,
                        limits: { ...editingPackage.limits, premiumModelsEnabled: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="premiumModels" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Premium Models (GPT-4o, Claude, DeepSeek, Grok)
                  </label>
                </div>
              </div>

              {/* Allowed LLM Models */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Allowed LLM Models</label>
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-2">Select models available to this package:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
                      { id: 'gemini-3-pro', name: 'Gemini 3 Pro' },
                      { id: 'gpt-4o', name: 'GPT-4o' },
                      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
                      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
                      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
                      { id: 'grok-beta', name: 'Grok Beta' }
                    ].map(model => (
                      <label key={model.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editingPackage.limits.allowedLLMModels || []).includes(model.id)}
                          onChange={(e) => {
                            const current = editingPackage.limits.allowedLLMModels || [];
                            const updated = e.target.checked
                              ? [...current, model.id]
                              : current.filter(id => id !== model.id);
                            setEditingPackage({
                              ...editingPackage,
                              limits: { ...editingPackage.limits, allowedLLMModels: updated }
                            });
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-slate-700">{model.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
            <button
              onClick={() => {
                setEditingPackage(null);
                setIsCreating(false);
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAddDefaultPackages = async () => {
    if (!(await showConfirm('This will create 3 default packages (Starter, Pro, Enterprise) if they don\'t already exist. Continue?'))) return;
    
    setLoading(true);
    setError(null);

    try {
      await createDefaultPackages(token);
      showAlert('Default packages have been created successfully!', 'success');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create default packages');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Package Management</h2>
        <div className="flex gap-3">
          <button
            onClick={handleAddDefaultPackages}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add 3 Default Packages
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> New Package
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map(pkg => (
          <div key={pkg.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{pkg.displayName}</h3>
                <p className="text-sm text-slate-500">{pkg.description}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${pkg.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {pkg.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-4">
              ${pkg.price}{pkg.billingCycle === 'monthly' ? '/mo' : pkg.billingCycle === 'yearly' ? '/yr' : ''}
            </div>
            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-2 font-bold">Key Limits:</div>
              <div className="text-xs space-y-1">
                <div>• {pkg.limits.maxProjects === -1 ? 'Unlimited' : pkg.limits.maxProjects} Projects</div>
                <div>• {pkg.limits.maxAgents === -1 ? 'Unlimited' : pkg.limits.maxAgents} Agents</div>
                <div>• {pkg.limits.maxTasks === -1 ? 'Unlimited' : pkg.limits.maxTasks} Tasks</div>
                <div>• {pkg.limits.maxStorageGB === -1 ? 'Unlimited' : pkg.limits.maxStorageGB} GB Storage</div>
                <div>• {pkg.limits.maxAPICalls === -1 ? 'Unlimited' : pkg.limits.maxAPICalls.toLocaleString()} API Calls</div>
                {pkg.limits.maxTeamMembers !== undefined && (
                  <div>• {pkg.limits.maxTeamMembers === -1 ? 'Unlimited' : pkg.limits.maxTeamMembers} Team Members</div>
                )}
                {pkg.limits.maxFileSizeMB !== undefined && (
                  <div>• {pkg.limits.maxFileSizeMB === -1 ? 'Unlimited' : pkg.limits.maxFileSizeMB} MB Max File Size</div>
                )}
                {pkg.limits.maxMCPServers !== undefined && (
                  <div>• {pkg.limits.maxMCPServers === -1 ? 'Unlimited' : pkg.limits.maxMCPServers} MCP Servers</div>
                )}
                {pkg.limits.maxLLMCallsPerMonth !== undefined && (
                  <div>• {pkg.limits.maxLLMCallsPerMonth === -1 ? 'Unlimited' : pkg.limits.maxLLMCallsPerMonth.toLocaleString()} LLM Calls/Mo</div>
                )}
                {pkg.limits.maxTokensPerMonth !== undefined && (
                  <div>• {pkg.limits.maxTokensPerMonth === -1 ? 'Unlimited' : `${(pkg.limits.maxTokensPerMonth / 1000).toFixed(0)}K`} Tokens/Mo</div>
                )}
              </div>
              {(pkg.limits.internetAccessEnabled || pkg.limits.codeExecutionEnabled || pkg.limits.cloudDeploymentEnabled || pkg.limits.multiLLMEnabled || pkg.limits.premiumModelsEnabled) && (
                <div className="text-xs text-slate-500 mb-2 font-bold mt-3">Features:</div>
              )}
              <div className="text-xs space-y-1">
                {pkg.limits.internetAccessEnabled && <div className="text-emerald-600">✓ Internet Access</div>}
                {pkg.limits.codeExecutionEnabled && <div className="text-emerald-600">✓ Code Execution</div>}
                {pkg.limits.cloudDeploymentEnabled && <div className="text-emerald-600">✓ Cloud Deployment</div>}
                {pkg.limits.multiLLMEnabled && <div className="text-blue-600">✓ Multi-LLM Routing</div>}
                {pkg.limits.premiumModelsEnabled && <div className="text-purple-600">✓ Premium Models</div>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(pkg)}
                className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button
                onClick={() => handleDelete(pkg.id)}
                className="px-3 py-2 bg-red-100 text-red-600 rounded text-sm font-bold hover:bg-red-200 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default PackageManager;

