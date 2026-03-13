import React, { useState } from 'react';

interface WorkspaceSettingsProps {
  workspace: {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    settings: {
      allowMemberInvite: boolean;
      requireApproval: boolean;
      defaultRole: string;
      maxMembers: number;
    };
  };
  onUpdate: (data: any) => Promise<void>;
  onDelete: () => Promise<void>;
}

const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({
  workspace,
  onUpdate,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'billing' | 'danger'>('general');
  const [loading, setLoading] = useState(false);
  
  // General settings state
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [allowMemberInvite, setAllowMemberInvite] = useState(workspace.settings.allowMemberInvite);
  const [requireApproval, setRequireApproval] = useState(workspace.settings.requireApproval);
  const [defaultRole, setDefaultRole] = useState(workspace.settings.defaultRole);
  const [maxMembers, setMaxMembers] = useState(workspace.settings.maxMembers);

  const handleSaveGeneral = async () => {
    try {
      setLoading(true);
      await onUpdate({
        name,
        description,
        settings: {
          allowMemberInvite,
          requireApproval,
          defaultRole,
          maxMembers
        }
      });
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (window.confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      if (window.confirm('All projects, tasks, and data will be permanently deleted. Are you absolutely sure?')) {
        await onDelete();
      }
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'billing', label: 'Billing', icon: '💳' },
    { id: 'danger', label: 'Danger Zone', icon: '⚠️' }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Workspace Settings</h1>
        <p className="text-slate-400">Manage your workspace settings and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-800 rounded-lg p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white mb-4">General Settings</h2>

              {/* Workspace Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Workspace Slug */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Workspace URL
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">orbitai.app/workspace/</span>
                  <input
                    type="text"
                    value={workspace.slug}
                    disabled
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-400"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  The workspace URL cannot be changed
                </p>
              </div>

              {/* Member Settings */}
              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-medium text-white mb-4">Member Settings</h3>

                <div className="space-y-4">
                  {/* Allow Member Invite */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">Allow members to invite others</div>
                      <div className="text-sm text-slate-400">
                        Members can send invitations to join this workspace
                      </div>
                    </div>
                    <button
                      onClick={() => setAllowMemberInvite(!allowMemberInvite)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        allowMemberInvite ? 'bg-blue-600' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          allowMemberInvite ? 'left-7' : 'left-1'
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* Require Approval */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">Require approval for new members</div>
                      <div className="text-sm text-slate-400">
                        Admins must approve new member requests
                      </div>
                    </div>
                    <button
                      onClick={() => setRequireApproval(!requireApproval)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        requireApproval ? 'bg-blue-600' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          requireApproval ? 'left-7' : 'left-1'
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* Default Role */}
                  <div>
                    <label className="block font-medium text-white mb-2">
                      Default role for new members
                    </label>
                    <select
                      value={defaultRole}
                      onChange={(e) => setDefaultRole(e.target.value)}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  {/* Max Members */}
                  <div>
                    <label className="block font-medium text-white mb-2">
                      Maximum number of members
                    </label>
                    <input
                      type="number"
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                      min={1}
                      max={1000}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-6 border-t border-slate-700">
                <button
                  onClick={handleSaveGeneral}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Member Management</h2>
              <p className="text-slate-400">Manage workspace members and their roles.</p>
              {/* Member list would go here */}
            </div>
          )}

          {activeTab === 'billing' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Billing & Subscription</h2>
              <p className="text-slate-400">Manage your subscription and billing information.</p>
              {/* Billing details would go here */}
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-red-500 mb-4">Danger Zone</h2>
              
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-2">Delete Workspace</h3>
                <p className="text-slate-300 mb-4">
                  Once you delete a workspace, there is no going back. Please be certain.
                </p>
                <button
                  onClick={handleDeleteWorkspace}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Delete this workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSettings;
