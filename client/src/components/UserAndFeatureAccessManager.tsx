import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Search, Edit, Save, X, Loader2, AlertCircle, CheckCircle,
  Shield, ToggleLeft, ToggleRight, Plus, Trash2, Ban, CheckSquare,
  RefreshCw, Filter, Download, Upload, Square
} from 'lucide-react';
import {
  getUsers,
  getUserDetails,
  updateUser,
  createUser,
  deleteUser,
  AdminUser
} from '../services/adminApi';
import {
  getFeatureFlags,
  updateFeatureFlag,
  FeatureFlag
} from '../services/featureFlagsApi';
import { clearFeatureCacheForKey, clearFeatureCache } from '../services/featureAccess';
import { useFeatureAccess, triggerFeatureRefresh } from '../hooks/useFeatureAccess';

import { showAlert, showConfirm } from '../utils/browserUtils';
import { ALL_FEATURES } from './FeaturePermissionsManager';
import { createFeatureFlag } from '../services/featureFlagsApi';

interface UserAndFeatureAccessManagerProps {
  token: string;
}

const ROLE_OPTIONS = ['public', 'user', 'editor', 'admin', 'superadmin'];
const ROLE_LABELS: Record<string, string> = {
  'public': 'Public',
  'user': 'User',
  'editor': 'Editor',
  'admin': 'Admin',
  'superadmin': 'Super Admin'
};

const ENVIRONMENT_OPTIONS = ['development', 'staging', 'production', 'test'];
const ENVIRONMENT_LABELS: Record<string, string> = {
  'development': 'Development',
  'staging': 'Pre-production',
  'production': 'Production',
  'test': 'Test'
};

const UserAndFeatureAccessManager: React.FC<UserAndFeatureAccessManagerProps> = ({ token }) => {
  // User management state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    name: '',
    plan: 'Free' as 'Free' | 'Pro' | 'Enterprise',
    role: 'user' as 'user' | 'admin' | 'superadmin' | 'editor'
  });
  
  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlag>>({});
  const [featureFlagsByCategory, setFeatureFlagsByCategory] = useState<Record<string, FeatureFlag[]>>({});
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<'users' | 'features'>('users');
  const [featureSearchTerm, setFeatureSearchTerm] = useState('');
  const [featureCategoryFilter, setFeatureCategoryFilter] = useState<string>('all');
  
  // Get current admin role for feature checks
  const [currentAdminRole, setCurrentAdminRole] = useState<'admin' | 'superadmin' | null>(null);
  // Only check feature access when role is loaded (not null)
  // When role is null, default to disabled and show loading state
  const { enabled: canManageUsers, loading: featureLoading } = useFeatureAccess(
    'user_management', 
    currentAdminRole || undefined
  );
  // Override enabled to false when role is not yet loaded
  const canManageUsersFinal = currentAdminRole ? canManageUsers : false;
  const featureLoadingFinal = currentAdminRole === null || featureLoading;
  
  // Refs to prevent duplicate API calls from React StrictMode double invocation
  const loadingAdminInfoRef = useRef(false);
  const loadingUsersRef = useRef(false);
  const loadingFeatureFlagsRef = useRef(false);
  
  // Debug: Reduced console noise
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development') {
  //     console.log('[UserAndFeatureAccessManager] Role:', currentAdminRole, 'Can manage users:', canManageUsersFinal, 'Loading:', featureLoadingFinal);
  //   }
  // }, [currentAdminRole, canManageUsersFinal, featureLoadingFinal]);

  useEffect(() => {
    loadAdminInfo();
    loadUsers();
    loadFeatureFlags();
  }, [token]);

  useEffect(() => {
    if (selectedUser) {
      loadUserDetails(selectedUser.id);
    }
  }, [selectedUser]);

  const loadAdminInfo = async () => {
    if (!token || loadingAdminInfoRef.current) return;
    loadingAdminInfoRef.current = true;
    try {
      const { getAdminUser } = await import('../services/adminApi');
      const adminUser = await getAdminUser(token);
      const role = adminUser.role as 'admin' | 'superadmin';
      // Debug: Reduced console noise
      // console.log('[UserAndFeatureAccessManager] Loaded admin role:', role);
      setCurrentAdminRole(role);
    } catch (err) {
      console.error('Failed to load admin info:', err);
      // Don't default to 'admin' - let it stay null so we can show proper error
      setCurrentAdminRole(null);
    } finally {
      loadingAdminInfoRef.current = false;
    }
  };

  const loadUsers = async (page = 1) => {
    if (!token || loadingUsersRef.current) return;
    loadingUsersRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await getUsers(token, {
        page,
        limit: 20,
        search: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined
      });
      setUsers(response.users);
      setCurrentPage(response.pagination.page);
      setTotalPages(response.pagination.pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
      loadingUsersRef.current = false;
    }
  };

  const loadUserDetails = async (userId: string) => {
    if (!token) return;
    try {
      const details = await getUserDetails(token, userId);
      setSelectedUser(details.user);
    } catch (err: any) {
      console.error('Failed to load user details:', err);
    }
  };

  const loadFeatureFlags = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const flags = await getFeatureFlags(token);
      const flagsMap: Record<string, FeatureFlag> = {};
      const byCategory: Record<string, FeatureFlag[]> = {};
      
      flags.forEach((flag: FeatureFlag) => {
        flagsMap[flag.featureKey] = flag;
        if (!byCategory[flag.category]) {
          byCategory[flag.category] = [];
        }
        byCategory[flag.category].push(flag);
      });
      
      setFeatureFlags(flagsMap);
      setFeatureFlagsByCategory(byCategory);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature flags');
      console.error('Failed to load feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!token || !canManageUsersFinal) {
      setError('User management is not enabled for your role');
      return;
    }
    
    if (!newUserData.email || !newUserData.password || !newUserData.name) {
      setError('Email, password, and name are required');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      await createUser(token, newUserData);
      setSuccess('User created successfully');
      setShowAddUserModal(false);
      setNewUserData({ email: '', password: '', name: '', plan: 'Free', role: 'user' });
      await loadUsers(currentPage);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!token || !editingUser || !canManageUsersFinal) {
      setError('User management is not enabled for your role');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      const oldRole = selectedUser?.role;
      await updateUser(token, editingUser.id, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        plan: editingUser.plan,
        isActive: editingUser.isActive !== false
      });
      
      // If role changed, clear feature cache for that user's old and new roles
      // This ensures UI updates immediately when role changes
      if (oldRole && oldRole !== editingUser.role) {
        // Clear cache for all features for both old and new roles
        Object.keys(featureFlags).forEach(featureKey => {
          clearFeatureCacheForKey(featureKey);
        });
        // Trigger refresh so all useFeatureAccess hooks re-check
        triggerFeatureRefresh();
      }
      
      setSuccess('User updated successfully');
      setEditingUser(null);
      await loadUsers(currentPage);
      if (selectedUser?.id === editingUser.id) {
        await loadUserDetails(editingUser.id);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token || !canManageUsers) {
      showAlert('User management is not enabled for your role');
      return;
    }
    
    if (!(await showConfirm('Are you sure you want to delete this user? This will also delete all their projects. This action cannot be undone.'))) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteUser(token, userId);
      setSuccess('User deleted successfully');
      await loadUsers(currentPage);
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
      alert(`Failed to delete user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFeatureFlag = async (featureKey: string) => {
    if (!token) return;
    
    const feature = ALL_FEATURES.find(f => f.key === featureKey);
    if (!feature) return;
    
    setSaving(true);
    setError(null);
    try {
      await createFeatureFlag(token, {
        featureKey: feature.key,
        featureName: feature.name,
        description: feature.description,
        category: feature.category.toLowerCase(),
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        enabledEnvironments: [],
        isActive: true
      });
      
      await loadFeatureFlags();
      clearFeatureCache();
      triggerFeatureRefresh();
      
      setSuccess(`Feature flag "${feature.name}" created successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create feature flag');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeatureForRole = async (featureKey: string, role: string) => {
    if (!token) return;
    
    let flag = featureFlags[featureKey];
    // If flag doesn't exist, create it first
    if (!flag) {
      setSaving(true);
      setError(null);
      try {
        const feature = ALL_FEATURES.find(f => f.key === featureKey);
        if (!feature) {
          setError('Feature not found in predefined list');
          setSaving(false);
          return;
        }
        
        await createFeatureFlag(token, {
          featureKey: feature.key,
          featureName: feature.name,
          description: feature.description,
          category: feature.category.toLowerCase(),
          enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
          enabledEnvironments: [],
          isActive: true
        });
        
        // Reload flags to get the new one
        await loadFeatureFlags();
        // Wait a bit for state to update, then get fresh flags
        const updatedFlags = await getFeatureFlags(token);
        const flagsMap: Record<string, FeatureFlag> = {};
        updatedFlags.forEach((f: FeatureFlag) => {
          flagsMap[f.featureKey] = f;
        });
        flag = flagsMap[featureKey];
        
        if (!flag) {
          setError('Failed to load newly created feature flag. Please refresh the page.');
          setSaving(false);
          return;
        }
      } catch (err: any) {
        setError(err.message || 'Failed to create feature flag');
        setSaving(false);
        return;
      }
    }
    
    if (!flag) {
      setError('Failed to load feature flag');
      return;
    }
    
    const currentRoles = flag.enabledRoles || [];
    const roleIndex = currentRoles.indexOf(role);
    const newRoles = roleIndex >= 0
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    setSaving(true);
    setError(null);
    try {
      // Update on server
      const updatedFlag = await updateFeatureFlag(token, featureKey, {
        enabledRoles: newRoles
      });
      
      // Reload feature flags from server to ensure we have the latest data
      await loadFeatureFlags();
      
      // Clear cache for all roles (not just current user) and trigger refresh
      // This ensures changes are visible immediately for all users
      clearFeatureCacheForKey(featureKey);
      // Also clear entire cache to ensure all users see changes immediately
      clearFeatureCache();
      triggerFeatureRefresh();
      
      setSuccess(`Feature ${roleIndex >= 0 ? 'disabled' : 'enabled'} for ${ROLE_LABELS[role]}. Changes are effective immediately!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update feature flag');
      // Reload flags even on error to ensure UI is in sync
      await loadFeatureFlags();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeatureForEnvironment = async (featureKey: string, environment: string) => {
    if (!token) return;
    
    const flag = featureFlags[featureKey];
    if (!flag) return;
    
    const currentEnvironments = flag.enabledEnvironments || [];
    const envIndex = currentEnvironments.indexOf(environment);
    const newEnvironments = envIndex >= 0
      ? currentEnvironments.filter(e => e !== environment)
      : [...currentEnvironments, environment];
    
    setSaving(true);
    setError(null);
    try {
      // Update on server
      await updateFeatureFlag(token, featureKey, {
        enabledEnvironments: newEnvironments
      });
      
      // Reload feature flags from server to ensure we have the latest data
      await loadFeatureFlags();
      
      // Clear cache and trigger refresh
      clearFeatureCacheForKey(featureKey);
      clearFeatureCache();
      triggerFeatureRefresh();
      
      setSuccess(`Feature ${envIndex >= 0 ? 'disabled' : 'enabled'} for ${ENVIRONMENT_LABELS[environment]}. Changes are effective immediately!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update feature flag');
      await loadFeatureFlags();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAllEnvironments = async (featureKey: string) => {
    if (!token) return;
    
    const flag = featureFlags[featureKey];
    if (!flag) return;
    
    const currentEnvironments = flag.enabledEnvironments || [];
    const isAllEnvironments = currentEnvironments.length === 0;
    
    // If all environments (empty array = available everywhere), select all specific environments
    // If specific environments selected, clear to enable all (empty array)
    const newEnvironments = isAllEnvironments ? ENVIRONMENT_OPTIONS : [];
    
    setSaving(true);
    setError(null);
    try {
      await updateFeatureFlag(token, featureKey, {
        enabledEnvironments: newEnvironments
      });
      
      await loadFeatureFlags();
      clearFeatureCacheForKey(featureKey);
      clearFeatureCache();
      triggerFeatureRefresh();
      
      setSuccess(`Feature ${isAllEnvironments ? 'limited to specific environments' : 'enabled for all environments'}. Changes are effective immediately!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update feature flag');
      await loadFeatureFlags();
    } finally {
      setSaving(false);
    }
  };

  const getFeaturesForRole = (role: string): FeatureFlag[] => {
    return (Object.values(featureFlags) as FeatureFlag[]).filter((flag: FeatureFlag) => 
      flag.isActive && flag.enabledRoles?.includes(role)
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (!canManageUsersFinal) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
        <h3 className="font-bold text-yellow-800 mb-1">User Management Disabled</h3>
        <p className="text-sm text-yellow-700">
          The user_management feature is not enabled for your role. Contact a superadmin to enable this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User & Feature Access Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage users and their feature access permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'users' ? 'features' : 'users')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            {viewMode === 'users' ? <Shield size={16} /> : <Users size={16} />}
            {viewMode === 'users' ? 'View Features' : 'View Users'}
          </button>
          {viewMode === 'users' && (
            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle size={20} className="text-emerald-600" />
          <span className="text-sm text-emerald-800">{success}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {viewMode === 'users' ? (
        /* USERS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      loadUsers(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    loadUsers(1);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  {ROLE_OPTIONS.map(role => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredUsers.map(user => (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                        selectedUser?.id === user.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-800">{user.name}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                              user.role === 'editor' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {ROLE_LABELS[user.role]}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{user.email}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span>Plan: {user.plan}</span>
                            <span>Status: {user.isActive ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUser(user);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit size={16} className="text-slate-600" />
                          </button>
                          {currentAdminRole === 'superadmin' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUser(user.id);
                              }}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={16} className="text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => loadUsers(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => loadUsers(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* User Details & Features Sidebar */}
          <div className="space-y-4">
            {selectedUser ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800">User Details</h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Name</label>
                    <p className="text-sm text-slate-800 mt-1">{selectedUser.name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
                    <p className="text-sm text-slate-800 mt-1">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Role</label>
                    <p className="text-sm text-slate-800 mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedUser.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                        selectedUser.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                        selectedUser.role === 'editor' ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {ROLE_LABELS[selectedUser.role]}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Plan</label>
                    <p className="text-sm text-slate-800 mt-1">{selectedUser.plan}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3">Enabled Features ({getFeaturesForRole(selectedUser.role).length})</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {getFeaturesForRole(selectedUser.role).length === 0 ? (
                      <p className="text-xs text-slate-400">No features enabled for this role</p>
                    ) : (
                      getFeaturesForRole(selectedUser.role).map(flag => (
                        <div key={flag.featureKey} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-start gap-2">
                            <CheckSquare size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block">{flag.featureName}</span>
                              {flag.description && (
                                <span className="text-xs text-slate-500 mt-0.5 block">{flag.description}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                <Users size={32} className="mx-auto mb-2 text-slate-400 opacity-50" />
                <p className="text-sm text-slate-500">Select a user to view details</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* FEATURES VIEW */
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 mb-2">Feature Access by Role</h3>
            <p className="text-sm text-slate-500">Toggle features for each role. Changes affect all users with that role. <strong>Public</strong> role refers to users who are not signed in.</p>
          </div>

          {/* Feature Filters */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search features..."
                  value={featureSearchTerm}
                  onChange={(e) => setFeatureSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <select
                value={featureCategoryFilter}
                onChange={(e) => setFeatureCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {Array.from(new Set(ALL_FEATURES.map(f => f.category))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Show all predefined features, grouped by category */}
          {(() => {
            // Get unique categories from ALL_FEATURES
            const categories = Array.from(new Set(ALL_FEATURES.map(f => f.category)));
            
            // Filter features based on search and category
            const filteredFeatures = ALL_FEATURES.filter(feature => {
              const matchesSearch = !featureSearchTerm || 
                feature.name.toLowerCase().includes(featureSearchTerm.toLowerCase()) ||
                feature.key.toLowerCase().includes(featureSearchTerm.toLowerCase()) ||
                (feature.description && feature.description.toLowerCase().includes(featureSearchTerm.toLowerCase()));
              const matchesCategory = featureCategoryFilter === 'all' || feature.category === featureCategoryFilter;
              return matchesSearch && matchesCategory;
            });

            // Group filtered features by category
            const groupedByCategory = filteredFeatures.reduce((acc, feature) => {
              if (!acc[feature.category]) {
                acc[feature.category] = [];
              }
              acc[feature.category].push(feature);
              return acc;
            }, {} as Record<string, typeof ALL_FEATURES>);

            return Object.entries(groupedByCategory).map(([category, features]) => {
              return (
                <div key={category} className="mb-8">
                  <h4 className="font-semibold text-slate-700 mb-4 capitalize">{category}</h4>
                  <div className="space-y-3">
                    {features.map((feature) => {
                      const flag = featureFlags[feature.key];
                      const enabledEnvs = flag?.enabledEnvironments || [];
                      const isAllEnvironments = enabledEnvs.length === 0;
                      const existsInDb = !!flag;
                      
                      return (
                        <div key={feature.key} className={`border rounded-lg p-4 transition-colors ${
                          existsInDb 
                            ? 'border-slate-200 hover:border-blue-300 bg-white' 
                            : 'border-amber-200 hover:border-amber-300 bg-amber-50'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h5 className="font-semibold text-slate-800 text-base">{feature.name}</h5>
                                {existsInDb ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                                    flag.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {flag.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium shrink-0 bg-amber-100 text-amber-700">
                                    Not Created
                                  </span>
                                )}
                                {feature.packageControlled && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                    Package Controlled
                                  </span>
                                )}
                              </div>
                              <div className="bg-slate-50 border-l-4 border-blue-500 pl-3 py-2 rounded-r">
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {existsInDb && flag.description ? flag.description : feature.description}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {existsInDb ? (
                            <>
                              {/* Role Access */}
                              <div className="mb-4">
                                <label className="text-xs font-semibold text-slate-600 uppercase mb-2 block">Role Access</label>
                                <div className="grid grid-cols-5 gap-2">
                                  {ROLE_OPTIONS.map(role => {
                                    const isEnabled = flag.enabledRoles.includes(role);
                                    return (
                                      <button
                                        key={role}
                                        onClick={() => handleToggleFeatureForRole(flag.featureKey, role)}
                                        disabled={saving}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                                          isEnabled
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        } disabled:opacity-50`}
                                        title={role === 'public' ? 'Users not signed in (unauthenticated users)' : undefined}
                                      >
                                        {isEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                        {ROLE_LABELS[role]}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              
                              {/* Environment Access */}
                              <div>
                                <label className="text-xs font-semibold text-slate-600 uppercase mb-2 block">Environment Access</label>
                                <div className="flex items-center gap-2 mb-2">
                                  <button
                                    onClick={() => handleToggleAllEnvironments(flag.featureKey)}
                                    disabled={saving}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                      isAllEnvironments
                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    } disabled:opacity-50`}
                                  >
                                    {isAllEnvironments ? <CheckSquare size={12} /> : <Square size={12} />}
                                    All Environments
                                  </button>
                                  <span className="text-xs text-slate-400">or select specific:</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {ENVIRONMENT_OPTIONS.map(env => {
                                    const isEnabled = enabledEnvs.includes(env);
                                    return (
                                      <button
                                        key={env}
                                        onClick={() => handleToggleFeatureForEnvironment(flag.featureKey, env)}
                                        disabled={saving}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                                          isEnabled
                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        } disabled:opacity-50`}
                                      >
                                        {isEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
                                        {ENVIRONMENT_LABELS[env]}
                                      </button>
                                    );
                                  })}
                                </div>
                                {enabledEnvs.length > 0 && (
                                  <p className="text-xs text-slate-400 mt-2">
                                    Active in: {enabledEnvs.map(e => ENVIRONMENT_LABELS[e]).join(', ')}
                                  </p>
                                )}
                                {isAllEnvironments && (
                                  <p className="text-xs text-blue-600 mt-2 font-medium">
                                    ✓ Available in all environments
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <p className="text-sm text-amber-800 mb-3">
                                This feature flag doesn't exist in the database yet. Create it to start managing permissions.
                              </p>
                              <button
                                onClick={() => handleCreateFeatureFlag(feature.key)}
                                disabled={saving}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                              >
                                <Plus size={16} />
                                Create Feature Flag
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}

          {(() => {
            const filteredFeatures = ALL_FEATURES.filter(feature => {
              const matchesSearch = !featureSearchTerm || 
                feature.name.toLowerCase().includes(featureSearchTerm.toLowerCase()) ||
                feature.key.toLowerCase().includes(featureSearchTerm.toLowerCase()) ||
                (feature.description && feature.description.toLowerCase().includes(featureSearchTerm.toLowerCase()));
              const matchesCategory = featureCategoryFilter === 'all' || feature.category === featureCategoryFilter;
              return matchesSearch && matchesCategory;
            });

            if (filteredFeatures.length === 0) {
              return (
                <div className="text-center py-12 text-slate-500">
                  <p>No features found matching your search.</p>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddUserModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add New User</h2>
              <button onClick={() => setShowAddUserModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {ROLE_OPTIONS.map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Plan</label>
                  <select
                    value={newUserData.plan}
                    onChange={(e) => setNewUserData({ ...newUserData, plan: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Free">Free</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateUser(); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    disabled={currentAdminRole !== 'superadmin' && editingUser.role === 'superadmin'}
                  >
                    {ROLE_OPTIONS.map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Plan</label>
                  <select
                    value={editingUser.plan}
                    onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Free">Free</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editingUser.isActive ? 'Active' : 'Inactive'}
                  onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.value === 'Active' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Changing a user's role will automatically update their feature access based on the role's enabled features.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAndFeatureAccessManager;

