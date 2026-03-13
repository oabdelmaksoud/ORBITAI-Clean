/**
 * GitHub Integration Panel Component
 * UI for connecting GitHub, pushing projects, and managing CI/CD workflows
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Github, GitBranch, GitPullRequest, Upload, Settings, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Plus, Trash2, RefreshCw,
  ExternalLink, Copy, Check, FolderGit, Workflow, Play, Lock,
  ChevronDown, ChevronRight, Eye, FileCode, Link2, Unlink
} from 'lucide-react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  updated_at: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  secrets: string[];
}

interface GitHubIntegrationPanelProps {
  projectId?: string;
  projectName?: string;
  token?: string;
  userRole?: string;
}

const GitHubIntegrationPanel: React.FC<GitHubIntegrationPanelProps> = ({
  projectId,
  projectName = 'my-project',
  token,
  userRole = 'user'
}) => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [activeTab, setActiveTab] = useState<'repos' | 'push' | 'workflows'>('repos');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Push form state
  const [pushConfig, setPushConfig] = useState({
    repoName: projectName.toLowerCase().replace(/\s+/g, '-'),
    branch: 'main',
    createRepo: true,
    commitMessage: 'feat: Initial commit from ORBITAI'
  });

  // Workflow form state
  const [workflowConfig, setWorkflowConfig] = useState({
    platform: 'vercel',
    workflowName: 'deploy'
  });

  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);

  const canAccess = useFeatureAccess('integrations', userRole);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const authToken = token || localStorage.getItem('authToken');

  // Check connection status
  useEffect(() => {
    checkConnection();
    fetchWorkflowTemplates();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/integrations/github/status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      setConnected(data.data?.connected || false);
      if (data.data?.connected) {
        fetchRepos();
      }
    } catch (err) {
      console.error('Failed to check GitHub connection:', err);
    }
  };

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/integrations/github/repos`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setRepos(data.data?.repos || []);
      }
    } catch (err) {
      console.error('Failed to fetch repos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowTemplates = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/integrations/github/workflow-templates`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setWorkflowTemplates(data.data?.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch workflow templates:', err);
    }
  };

  const connectGitHub = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/github/callback`);
    const scope = encodeURIComponent('repo workflow');
    
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  };

  const disconnectGitHub = async () => {
    try {
      await fetch(`${apiUrl}/api/integrations/github/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      setConnected(false);
      setRepos([]);
      setSuccess('GitHub disconnected successfully');
    } catch (err) {
      setError('Failed to disconnect GitHub');
    }
  };

  const pushToGitHub = async () => {
    if (!projectId) {
      setError('No project selected');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${apiUrl}/api/integrations/github/push-project`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          repo: pushConfig.repoName,
          branch: pushConfig.branch,
          createRepo: pushConfig.createRepo,
          commitMessage: pushConfig.commitMessage
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Successfully pushed to GitHub! ${data.data.filesCount} files pushed.`);
        fetchRepos(); // Refresh repo list
      } else {
        setError(data.message || 'Failed to push to GitHub');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to push to GitHub');
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async () => {
    if (!selectedRepo) {
      setError('Please select a repository first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const [owner, repo] = selectedRepo.full_name.split('/');
      
      const response = await fetch(`${apiUrl}/api/integrations/github/create-workflow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner,
          repo,
          workflowName: workflowConfig.workflowName,
          platform: workflowConfig.platform
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Workflow created at ${data.data.path}`);
      } else {
        setError(data.message || 'Failed to create workflow');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const createNewRepo = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/integrations/github/create-repo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: pushConfig.repoName,
          description: `Generated by ORBITAI - ${projectName}`,
          private: true
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Repository created successfully');
        fetchRepos();
      } else {
        setError(data.message || 'Failed to create repository');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create repository');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!canAccess.enabled) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg text-center">
        <Lock className="w-12 h-12 mx-auto text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">GitHub Integration Locked</h3>
        <p className="text-gray-400">Upgrade your plan to access GitHub integration.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-700 rounded-lg">
              <Github className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">GitHub Integration</h2>
              <p className="text-sm text-gray-400">Push code, manage repos, and setup CI/CD</p>
            </div>
          </div>
          
          {connected ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Connected
              </span>
              <button
                onClick={disconnectGitHub}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectGitHub}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Connect GitHub
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'repos', label: 'Repositories', icon: FolderGit },
            { id: 'push', label: 'Push Project', icon: Upload },
            { id: 'workflows', label: 'CI/CD Workflows', icon: Workflow },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              disabled={!connected && tab.id !== 'repos'}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-400/60 hover:text-green-400">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {!connected ? (
          <div className="text-center py-12">
            <Github className="w-16 h-16 mx-auto text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Connect your GitHub account</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Connect GitHub to push your generated code, create repositories, and set up automated CI/CD workflows.
            </p>
            <button
              onClick={connectGitHub}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Github className="w-5 h-5" />
              Connect GitHub
            </button>
          </div>
        ) : (
          <>
            {/* Repositories Tab */}
            {activeTab === 'repos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Your Repositories</h3>
                  <button
                    onClick={fetchRepos}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                  </div>
                ) : repos.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No repositories found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {repos.map(repo => (
                      <div
                        key={repo.id}
                        onClick={() => setSelectedRepo(repo)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedRepo?.id === repo.id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FolderGit className="w-5 h-5 text-gray-400" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{repo.name}</span>
                                {repo.private && (
                                  <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                    Private
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 truncate max-w-md">
                                {repo.description || 'No description'}
                              </p>
                            </div>
                          </div>
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Push Project Tab */}
            {activeTab === 'push' && (
              <div className="space-y-6">
                <h3 className="text-sm font-medium text-gray-300">Push Project to GitHub</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Repository Name</label>
                    <input
                      type="text"
                      value={pushConfig.repoName}
                      onChange={(e) => setPushConfig(c => ({ ...c, repoName: e.target.value }))}
                      placeholder="my-project"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Branch</label>
                    <input
                      type="text"
                      value={pushConfig.branch}
                      onChange={(e) => setPushConfig(c => ({ ...c, branch: e.target.value }))}
                      placeholder="main"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Commit Message</label>
                  <input
                    type="text"
                    value={pushConfig.commitMessage}
                    onChange={(e) => setPushConfig(c => ({ ...c, commitMessage: e.target.value }))}
                    placeholder="feat: Initial commit"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="createRepo"
                    checked={pushConfig.createRepo}
                    onChange={(e) => setPushConfig(c => ({ ...c, createRepo: e.target.checked }))}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                  />
                  <label htmlFor="createRepo" className="text-sm text-gray-300">
                    Create repository if it doesn't exist
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={pushToGitHub}
                    disabled={loading || !projectId}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Push to GitHub
                  </button>
                  <button
                    onClick={createNewRepo}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Repo Only
                  </button>
                </div>

                {!projectId && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Select a project to push to GitHub
                  </div>
                )}
              </div>
            )}

            {/* Workflows Tab */}
            {activeTab === 'workflows' && (
              <div className="space-y-6">
                <h3 className="text-sm font-medium text-gray-300">CI/CD Workflow Templates</h3>

                {!selectedRepo ? (
                  <div className="p-4 bg-gray-800 rounded-lg text-center">
                    <p className="text-gray-400">Select a repository from the Repositories tab first</p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-gray-800 rounded-lg flex items-center gap-3">
                      <FolderGit className="w-5 h-5 text-purple-400" />
                      <span className="text-white">{selectedRepo.full_name}</span>
                      <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-400">
                        {selectedRepo.default_branch}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Deployment Platform</label>
                        <select
                          value={workflowConfig.platform}
                          onChange={(e) => setWorkflowConfig(c => ({ ...c, platform: e.target.value }))}
                          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                        >
                          {workflowTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Workflow Name</label>
                        <input
                          type="text"
                          value={workflowConfig.workflowName}
                          onChange={(e) => setWorkflowConfig(c => ({ ...c, workflowName: e.target.value }))}
                          placeholder="deploy"
                          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    {/* Selected template details */}
                    {workflowTemplates.find(t => t.id === workflowConfig.platform) && (
                      <div className="p-4 bg-gray-800 rounded-lg">
                        <h4 className="text-white font-medium mb-2">
                          {workflowTemplates.find(t => t.id === workflowConfig.platform)?.name}
                        </h4>
                        <p className="text-sm text-gray-400 mb-3">
                          {workflowTemplates.find(t => t.id === workflowConfig.platform)?.description}
                        </p>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Required Secrets</h5>
                          <div className="flex flex-wrap gap-2">
                            {workflowTemplates.find(t => t.id === workflowConfig.platform)?.secrets.map(secret => (
                              <code
                                key={secret}
                                className="text-xs bg-gray-700 px-2 py-1 rounded text-purple-400"
                              >
                                {secret}
                              </code>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={createWorkflow}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Create Workflow
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GitHubIntegrationPanel;
