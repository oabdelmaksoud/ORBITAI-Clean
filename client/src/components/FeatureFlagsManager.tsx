import React, { useState, useEffect } from 'react';
import {
  ToggleLeft, ToggleRight, Plus, Edit2, Trash2, Save, X,
  Shield, Users, Bot, Code, FileText, Settings, AlertCircle,
  CheckCircle, Search, Filter, Loader2
} from 'lucide-react';
import {
  getFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  FeatureFlag
} from '../services/featureFlagsApi';
import { clearFeatureCache, clearFeatureCacheForKey } from '../services/featureAccess';
import { triggerFeatureRefresh } from '../hooks/useFeatureAccess';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface FeatureFlagsManagerProps {
  token: string;
}

const ROLE_OPTIONS = ['public', 'user', 'editor', 'admin', 'superadmin'];
const ENVIRONMENT_OPTIONS = ['development', 'staging', 'production', 'test'];
const CATEGORIES = ['projects', 'ai', 'agents', 'export', 'admin', 'workspace', 'advanced'];

const FeatureFlagsManager: React.FC<FeatureFlagsManagerProps> = ({ token }) => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI State
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newFlag, setNewFlag] = useState<Partial<FeatureFlag>>({
    featureKey: '',
    featureName: '',
    description: '',
    category: 'projects',
    enabledRoles: ['user'],
    enabledEnvironments: [],
    isActive: true
  });

  useEffect(() => {
    loadFeatureFlags();
  }, [token]);

  const loadFeatureFlags = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFeatureFlags(token);
      setFlags(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature flags');
      console.error('Failed to load feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isCreating) {
        if (!newFlag.featureKey || !newFlag.featureName) {
          throw new Error('Feature key and name are required');
        }
        await createFeatureFlag(token, newFlag);
        setSuccess('Feature flag created successfully!');
        setIsCreating(false);
        setNewFlag({
          featureKey: '',
          featureName: '',
          description: '',
          category: 'projects',
          enabledRoles: ['user'],
          enabledEnvironments: [],
          isActive: true
        });
      } else if (editingFlag) {
        await updateFeatureFlag(token, editingFlag.featureKey, editingFlag);
        // Clear cache for this feature flag and entire cache so changes take effect immediately for all users
        clearFeatureCacheForKey(editingFlag.featureKey);
        clearFeatureCache(); // Clear entire cache to ensure all users see changes immediately
        // Trigger all hooks to refresh
        triggerFeatureRefresh();
        setSuccess('Feature flag updated successfully! Changes are effective immediately for all users.');
        setEditingFlag(null);
      }
      await loadFeatureFlags();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save feature flag');
      console.error('Failed to save feature flag:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (featureKey: string) => {
    if (!token) return;
    if (!(await showConfirm(`Are you sure you want to delete feature flag "${featureKey}"?`))) return;

    setLoading(true);
    setError(null);
    try {
      await deleteFeatureFlag(token, featureKey);
      // Clear cache for this feature flag
      clearFeatureCacheForKey(featureKey);
      // Trigger all hooks to refresh
      triggerFeatureRefresh();
      setSuccess('Feature flag deleted successfully!');
      await loadFeatureFlags();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete feature flag');
      console.error('Failed to delete feature flag:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (flag: FeatureFlag, role: string) => {
    const updatedRoles = flag.enabledRoles.includes(role)
      ? flag.enabledRoles.filter(r => r !== role)
      : [...flag.enabledRoles, role];

    if (editingFlag && editingFlag.featureKey === flag.featureKey) {
      setEditingFlag({ ...editingFlag, enabledRoles: updatedRoles });
    } else {
      const updated = flags.map(f =>
        f.featureKey === flag.featureKey ? { ...f, enabledRoles: updatedRoles } : f
      );
      setFlags(updated);
    }
  };

  const toggleActive = async (flag: FeatureFlag) => {
    if (!token) return;
    try {
      await updateFeatureFlag(token, flag.featureKey, {
        ...flag,
        isActive: !flag.isActive
      });
      // Clear cache for this feature flag so changes take effect immediately
      clearFeatureCacheForKey(flag.featureKey);
      // Trigger all hooks to refresh
      triggerFeatureRefresh();
      await loadFeatureFlags();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle feature flag');
    }
  };

  // Group flags by category
  const groupedFlags = flags.reduce((acc, flag) => {
    if (!acc[flag.category]) {
      acc[flag.category] = [];
    }
    acc[flag.category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  // Filter flags
  const filteredFlags = Object.entries(groupedFlags).filter(([category, categoryFlags]) => {
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
    const matchesSearch = categoryFlags.some(flag =>
      flag.featureName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.featureKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      projects: <FileText size={16} />,
      ai: <Bot size={16} />,
      agents: <Users size={16} />,
      export: <FileText size={16} />,
      admin: <Shield size={16} />,
      workspace: <Code size={16} />,
      advanced: <Settings size={16} />
    };
    return icons[category] || <FileText size={16} />;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      public: 'bg-gray-100 text-gray-700',
      user: 'bg-blue-100 text-blue-700',
      editor: 'bg-green-100 text-green-700',
      admin: 'bg-purple-100 text-purple-700',
      superadmin: 'bg-red-100 text-red-700'
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  const currentFlag = editingFlag || (isCreating ? newFlag : null);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ToggleLeft size={28} className="text-orange-600" />
            Feature Flags Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Control feature access for different user roles. <strong>Public</strong> role refers to users who are not signed in (non-authenticated users).
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreating(true);
            setEditingFlag(null);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> Create Feature Flag
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search feature flags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Create/Edit Form */}
      {currentFlag && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              {isCreating ? 'Create New Feature Flag' : 'Edit Feature Flag'}
            </h3>
            <button
              onClick={() => {
                setEditingFlag(null);
                setIsCreating(false);
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Feature Key (unique identifier)
              </label>
              <input
                type="text"
                value={currentFlag.featureKey || ''}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                  if (isCreating) {
                    setNewFlag({ ...newFlag, featureKey: value });
                  } else if (editingFlag) {
                    setEditingFlag({ ...editingFlag, featureKey: value });
                  }
                }}
                disabled={!isCreating}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50"
                placeholder="e.g., project_creation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Feature Name
              </label>
              <input
                type="text"
                value={currentFlag.featureName || ''}
                onChange={(e) => {
                  if (isCreating) {
                    setNewFlag({ ...newFlag, featureName: e.target.value });
                  } else if (editingFlag) {
                    setEditingFlag({ ...editingFlag, featureName: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g., Create Projects"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={currentFlag.description || ''}
                onChange={(e) => {
                  if (isCreating) {
                    setNewFlag({ ...newFlag, description: e.target.value });
                  } else if (editingFlag) {
                    setEditingFlag({ ...editingFlag, description: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                rows={2}
                placeholder="Describe what this feature does..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                value={currentFlag.category || 'projects'}
                onChange={(e) => {
                  if (isCreating) {
                    setNewFlag({ ...newFlag, category: e.target.value });
                  } else if (editingFlag) {
                    setEditingFlag({ ...editingFlag, category: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Enabled Roles
              </label>
              <p className="text-xs text-slate-500 mb-2">
                <strong>Public</strong> = users not signed in (unauthenticated users)
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {ROLE_OPTIONS.map(role => (
                  <button
                    key={role}
                    onClick={() => {
                      const currentRoles = currentFlag.enabledRoles || [];
                      const updatedRoles = currentRoles.includes(role)
                        ? currentRoles.filter(r => r !== role)
                        : [...currentRoles, role];
                      
                      if (isCreating) {
                        setNewFlag({ ...newFlag, enabledRoles: updatedRoles });
                      } else if (editingFlag) {
                        setEditingFlag({ ...editingFlag, enabledRoles: updatedRoles });
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      (currentFlag.enabledRoles || []).includes(role)
                        ? getRoleBadgeColor(role)
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title={role === 'public' ? 'Users not signed in (unauthenticated users)' : undefined}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Enabled Environments
                <span className="text-xs text-slate-500 ml-2">(Leave empty for all environments)</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ENVIRONMENT_OPTIONS.map(env => {
                  const currentEnvs = currentFlag.enabledEnvironments || [];
                  const isSelected = currentEnvs.includes(env);
                  return (
                    <button
                      key={env}
                      onClick={() => {
                        const updatedEnvs = isSelected
                          ? currentEnvs.filter(e => e !== env)
                          : [...currentEnvs, env];
                        
                        if (isCreating) {
                          setNewFlag({ ...newFlag, enabledEnvironments: updatedEnvs });
                        } else if (editingFlag) {
                          setEditingFlag({ ...editingFlag, enabledEnvironments: updatedEnvs });
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-2 border-transparent'
                      }`}
                    >
                      {env.charAt(0).toUpperCase() + env.slice(1)}
                    </button>
                  );
                })}
              </div>
              {(!currentFlag.enabledEnvironments || currentFlag.enabledEnvironments.length === 0) && (
                <p className="text-xs text-slate-500 mt-2">
                  ✓ Active in all environments (development, staging, production, test)
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => {
                setEditingFlag(null);
                setIsCreating(false);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Feature Flags List */}
      {loading && flags.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : filteredFlags.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">No feature flags found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredFlags.map(([category, categoryFlags]) => (
            <div key={category} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                {getCategoryIcon(category)}
                <h3 className="font-bold text-slate-800 capitalize">{category}</h3>
                <span className="text-xs text-slate-500 ml-2">
                  ({categoryFlags.length} {categoryFlags.length === 1 ? 'feature' : 'features'})
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {categoryFlags.map(flag => (
                  <div key={flag.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-slate-800">{flag.featureName}</h4>
                          {!flag.isActive && (
                            <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs font-bold">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{flag.description}</p>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-slate-500">Key:</span>
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-700">
                            {flag.featureKey}
                          </code>
                        </div>

                        {/* Enabled Roles */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-500">Enabled for:</span>
                          {ROLE_OPTIONS.map(role => (
                            <button
                              key={role}
                              onClick={() => toggleRole(flag, role)}
                              className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                                flag.enabledRoles.includes(role)
                                  ? getRoleBadgeColor(role)
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                              title={role === 'public' ? 'Users not signed in (unauthenticated users)' : undefined}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => toggleActive(flag)}
                          className={`p-2 rounded-lg transition-colors ${
                            flag.isActive
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                          title={flag.isActive ? 'Disable' : 'Enable'}
                        >
                          {flag.isActive ? (
                            <ToggleRight size={24} className="text-emerald-600" />
                          ) : (
                            <ToggleLeft size={24} className="text-slate-400" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingFlag(flag);
                            setIsCreating(false);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(flag.featureKey)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeatureFlagsManager;
