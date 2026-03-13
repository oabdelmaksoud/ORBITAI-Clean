import React, { useState, useEffect } from 'react';
import {
  ToggleLeft, ToggleRight, Save, Loader2, AlertCircle,
  CheckCircle, Search, RefreshCw, Shield
} from 'lucide-react';
import {
  getFeatureFlags,
  updateFeatureFlag,
  FeatureFlag
} from '../services/featureFlagsApi';
import { clearFeatureCache, clearFeatureCacheForKey } from '../services/featureAccess';
import { triggerFeatureRefresh } from '../hooks/useFeatureAccess';

interface FeaturePermissionsManagerProps {
  token: string;
}

// User-facing features that can be enabled/disabled system-wide
// These features are actually checked in the frontend codebase
const ALL_FEATURES = [
  // Project Features (5)
  { key: 'project_creation', name: 'Create Projects', category: 'Projects', description: 'Allow users to create new projects', packageControlled: false },
  { key: 'project_deletion', name: 'Delete Projects', category: 'Projects', description: 'Allow users to delete their projects', packageControlled: false },
  { key: 'project_export', name: 'Export Projects', category: 'Projects', description: 'Allow users to export project data', packageControlled: false },
  { key: 'project_sharing', name: 'Share Projects', category: 'Projects', description: 'Allow users to share projects with others', packageControlled: false },
  { key: 'project_import', name: 'Import Projects', category: 'Projects', description: 'Import projects from exported files or external sources', packageControlled: false },
  { key: 'viewing_sample_projects', name: 'View Sample Projects', category: 'Projects', description: 'Allow users to view and load sample projects', packageControlled: false },
  
  // AI & LLM Features (6)
  { key: 'ai_chat', name: 'AI Chat', category: 'AI', description: 'Enable AI-powered chat assistant in workspace', packageControlled: false },
  { key: 'ai_code_generation', name: 'AI Code Generation', category: 'AI', description: 'Enable AI-powered code generation', packageControlled: false },
  { key: 'ai_task_automation', name: 'AI Task Automation', category: 'AI', description: 'Enable AI to automate project tasks', packageControlled: false },
  { key: 'ai_suggestions', name: 'AI Suggestions', category: 'AI', description: 'Receive AI-powered suggestions for improvements and optimizations', packageControlled: false },
  { key: 'chat_history', name: 'Chat History', category: 'AI', description: 'Access and manage saved chat conversations and history', packageControlled: false },
  { key: 'multi_llm_access', name: 'Multi-LLM Access', category: 'AI', description: 'Enable access to multiple LLM models (admin/superadmin only)', packageControlled: true },
  
  // Agent Features (4)
  { key: 'agent_creation', name: 'Create Agents', category: 'Agents', description: 'Create and configure specialized AI agents for different roles', packageControlled: false },
  { key: 'agent_customization', name: 'Customize Agents', category: 'Agents', description: 'Customize agent behavior, instructions, and capabilities', packageControlled: false },
  { key: 'agent_deletion', name: 'Delete Agents', category: 'Agents', description: 'Remove agents from projects', packageControlled: false },
  { key: 'agent_automation', name: 'Agent Automation', category: 'Agents', description: 'Enable autonomous agent execution and task automation workflows', packageControlled: false },
  
  // Workspace Features (4)
  { key: 'code_editor', name: 'Code Editor', category: 'Workspace', description: 'Enable integrated code editor', packageControlled: false },
  { key: 'artifact_viewer', name: 'Artifact Viewer', category: 'Workspace', description: 'Enable viewing project artifacts', packageControlled: false },
  { key: 'preview_mode', name: 'Preview Mode', category: 'Workspace', description: 'Enable project preview functionality', packageControlled: false },
  { key: 'terminal_access', name: 'Terminal Access', category: 'Workspace', description: 'Access to integrated terminal for running commands and scripts', packageControlled: false },
  
  // Export Features (3)
  { key: 'export_data', name: 'Export Data', category: 'Export', description: 'Export project data, tasks, and artifacts in JSON, CSV, or other formats', packageControlled: false },
  { key: 'export_code', name: 'Export Code', category: 'Export', description: 'Export generated code as ZIP files with full project structure', packageControlled: false },
  { key: 'export_reports', name: 'Export Reports', category: 'Export', description: 'Generate and export project reports, documentation, and status summaries', packageControlled: false },
  
  // Admin Features (8)
  { key: 'admin_console', name: 'Admin Console', category: 'Admin', description: 'Access to admin console and management tools', packageControlled: false },
  { key: 'user_management', name: 'User Management', category: 'Admin', description: 'Manage users, roles, and permissions', packageControlled: false },
  { key: 'package_management', name: 'Package Management', category: 'Admin', description: 'Manage subscription packages and pricing', packageControlled: false },
  { key: 'audit_logs', name: 'Audit Logs', category: 'Admin', description: 'View system audit logs and activity', packageControlled: false },
  { key: 'feature_flags', name: 'Feature Flags', category: 'Admin', description: 'Manage feature flags and access control (superadmin only)', packageControlled: false },
  { key: 'system_settings', name: 'System Settings', category: 'Admin', description: 'Configure system-wide settings, environment variables, and API keys', packageControlled: false },
  { key: 'financial_dashboard', name: 'Financial Dashboard', category: 'Admin', description: 'View financial analytics, revenue reports, and subscription metrics', packageControlled: false },
  { key: 'analytics_dashboard', name: 'Analytics Dashboard', category: 'Admin', description: 'Access comprehensive analytics including user activity and system performance', packageControlled: false },
  
  // Advanced Features (4)
  { key: 'cloud_deployment', name: 'Cloud Deployment', category: 'Advanced', description: 'Deploy projects to cloud platforms (AWS, Azure, GCP) with automated CI/CD', packageControlled: true },
  { key: 'api_access', name: 'API Access', category: 'Advanced', description: 'Access to REST API endpoints for programmatic project management', packageControlled: false },
  { key: 'webhooks', name: 'Webhooks', category: 'Advanced', description: 'Configure webhooks to receive real-time notifications and integrate with external systems', packageControlled: true },
  { key: 'third_party_integrations', name: 'Third-party Integrations', category: 'Advanced', description: 'Integrate with external services like Slack, GitHub, Jira, and other development tools', packageControlled: true },
  
  // Template Features (3)
  { key: 'template_use', name: 'Use Templates', category: 'Templates', description: 'Use pre-built project templates to quickly start new projects', packageControlled: false },
  { key: 'template_creation', name: 'Create Templates', category: 'Templates', description: 'Create custom project templates from existing projects for reuse', packageControlled: false },
  { key: 'template_sharing', name: 'Share Templates', category: 'Templates', description: 'Share project templates with other users or make them publicly available', packageControlled: false },
];

// Export for use in other components
export { ALL_FEATURES };

const ROLE_OPTIONS = ['public', 'user', 'editor', 'admin', 'superadmin'];
const ROLE_LABELS: Record<string, string> = {
  'public': 'Public',
  'user': 'User',
  'editor': 'Editor',
  'admin': 'Admin',
  'superadmin': 'Super Admin'
};

const FeaturePermissionsManager: React.FC<FeaturePermissionsManagerProps> = ({ token }) => {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadFeatureFlags();
  }, [token]);

  const loadFeatureFlags = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFeatureFlags(token);
      // Convert array to object for easy lookup
      const flagsMap: Record<string, FeatureFlag> = {};
      data.forEach(flag => {
        flagsMap[flag.featureKey] = flag;
      });
      setFlags(flagsMap);
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature permissions');
      console.error('Failed to load feature permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRoleForFeature = async (featureKey: string, role: string) => {
    if (!token) return;
    
    const currentFlag = flags[featureKey];
    const currentRoles = currentFlag?.enabledRoles || [];
    const roleIndex = currentRoles.indexOf(role);
    const newRoles = roleIndex >= 0
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    
    const isActive = newRoles.length > 0;

    // Update local state immediately for responsive UI
    const updatedFlag: FeatureFlag = {
      ...currentFlag,
      featureKey,
      id: currentFlag?.id || '',
      featureName: currentFlag?.featureName || ALL_FEATURES.find(f => f.key === featureKey)?.name || featureKey,
      description: currentFlag?.description || ALL_FEATURES.find(f => f.key === featureKey)?.description || '',
      category: currentFlag?.category || ALL_FEATURES.find(f => f.key === featureKey)?.category || 'general',
      enabledRoles: newRoles,
      isActive,
      metadata: currentFlag?.metadata || {}
    };

    setFlags({
      ...flags,
      [featureKey]: updatedFlag
    });
    setHasChanges(true);
    setSuccess(null);

    // Save immediately
    try {
      await updateFeatureFlag(token, featureKey, {
        enabledRoles: newRoles,
        isActive
      });
      
      // Clear cache for this feature flag and entire cache so changes take effect immediately for all users
      clearFeatureCache(); // Clear entire cache first
      clearFeatureCacheForKey(featureKey); // Then clear specific feature
      // Trigger all hooks to refresh immediately
      triggerFeatureRefresh();
      // Force a small delay then trigger again to ensure all hooks have re-checked
      setTimeout(() => {
        triggerFeatureRefresh();
      }, 100);
      
      setSuccess(`Permission updated for ${ROLE_LABELS[role]}! Changes are effective immediately for all users.`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update feature permission');
      // Revert on error
      setFlags({
        ...flags,
        [featureKey]: currentFlag || {
          id: '',
          featureKey,
          featureName: ALL_FEATURES.find(f => f.key === featureKey)?.name || featureKey,
          description: ALL_FEATURES.find(f => f.key === featureKey)?.description || '',
          category: ALL_FEATURES.find(f => f.key === featureKey)?.category || 'general',
          enabledRoles: [],
          isActive: false
        }
      });
    }
  };

  const isRoleEnabled = (featureKey: string, role: string): boolean => {
    const flag = flags[featureKey];
    return flag?.enabledRoles?.includes(role) || false;
  };

  const isFeatureEnabled = (featureKey: string): boolean => {
    const flag = flags[featureKey];
    // Check if flag exists and has at least one enabled role
    return flag ? (flag.enabledRoles?.length > 0 && flag.isActive === true) : false;
  };

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(ALL_FEATURES.map(f => f.category)))];
  
  // Filter features
  const filteredFeatures = ALL_FEATURES.filter(feature => {
    const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
    const matchesSearch = feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         feature.key.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });


  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield size={28} className="text-blue-600" />
            Feature Permissions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Control which user roles can access each feature. <strong>Public</strong> role refers to users who are not signed in (non-authenticated users).
          </p>
        </div>
        <button
          onClick={loadFeatureFlags}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
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
            placeholder="Search features..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      {/* Features List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Role Headers */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 sticky top-0 z-10 shadow-sm">
            <div className="grid grid-cols-[2fr_repeat(5,1fr)] gap-4 items-center">
              <div className="font-bold text-slate-800 text-sm">Feature</div>
              {ROLE_OPTIONS.map(role => (
                <div key={role} className="text-center">
                  <div className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                    {ROLE_LABELS[role]}
                  </div>
                  {role === 'public' && (
                    <div className="text-[10px] text-slate-500 mt-0.5">(Not signed in)</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Features with Role Permissions */}
          {filteredFeatures.map((feature) => {
            const flag = flags[feature.key];
            
            return (
              <div
                key={feature.key}
                className="bg-white border border-slate-200 rounded-lg p-4 transition-all hover:shadow-md"
              >
                <div className="grid grid-cols-[2fr_repeat(5,1fr)] gap-4 items-center">
                  {/* Feature Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-800 text-sm">{feature.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        feature.category === 'Projects' ? 'bg-blue-100 text-blue-700' :
                        feature.category === 'AI' ? 'bg-purple-100 text-purple-700' :
                        feature.category === 'Agents' ? 'bg-green-100 text-green-700' :
                        feature.category === 'Workspace' ? 'bg-orange-100 text-orange-700' :
                        feature.category === 'Admin' ? 'bg-red-100 text-red-700' :
                        feature.category === 'Advanced' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {feature.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{feature.description || flag?.description || 'User-facing feature'}</p>
                    {feature.packageControlled && (
                      <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
                        ⚠️ Package-controlled
                      </p>
                    )}
                  </div>
                  
                  {/* Role Toggles */}
                  {ROLE_OPTIONS.map(role => {
                    const isEnabled = isRoleEnabled(feature.key, role);
                    return (
                      <div key={role} className="flex justify-center">
                        <button
                          onClick={() => toggleRoleForFeature(feature.key, role)}
                          disabled={saving}
                          className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                            isEnabled
                              ? 'bg-blue-600'
                              : 'bg-slate-300'
                          } disabled:opacity-50`}
                          title={`${isEnabled ? 'Disable' : 'Enable'} for ${ROLE_LABELS[role]}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transform transition-transform ${
                              isEnabled
                                ? 'translate-x-[18px]'
                                : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredFeatures.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No features found matching your search.
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>💡 Note:</strong> Toggle permissions for each role. <strong>Public</strong> role refers to users who are <strong>not signed in</strong> (non-authenticated users). 
          Actual user access is also determined by their package limits. 
          Features disabled for all roles are hidden from everyone.
        </p>
      </div>
    </div>
  );
};

export default FeaturePermissionsManager;
