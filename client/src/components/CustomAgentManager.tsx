import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Plus, Search, X, Save, Loader2, AlertCircle, CheckCircle,
  Trash2, Copy, Star, Globe, Lock, Settings, Sparkles, BookOpen,
  Code, TestTube, Shield, Database, Zap, Users, ChevronDown, ChevronUp,
  Cpu, FolderOpen, User
} from 'lucide-react';
import { Agent, Mode } from '@orbitai/shared';
import { AGENTS as SYSTEM_AGENTS } from '@orbitai/shared';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { showAlert, showConfirm } from '../utils/browserUtils';
import { customAgentApi, ProjectAgent, ProjectAgentGroup, AllProjectAgentsResponse } from '../services/customAgentApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

interface CustomAgent {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  role: string;
  mode: 'Reasoning' | 'Deterministic';
  avatar: string;
  description: string;
  goal: string;
  backstory: string;
  systemPrompt?: string;
  capabilities: string[];
  preferredLLM?: string;
  temperature?: number;
  maxTokens?: number;
  tools: string[];
  isActive: boolean;
  isPublic: boolean;
  usageCount: number;
  rating?: number;
  ratingCount?: number;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  goal: string;
  backstory?: string;
  capabilities: string[];
  tags: string[];
}

interface CustomAgentManagerProps {
  userRole: string;
  projectId?: string;
  token?: string;
  onAgentSelect?: (agent: Agent) => void;
  onAgentsChange?: (agents: CustomAgent[]) => void;
}

const CAPABILITY_OPTIONS = [
  { id: 'code_generation', label: 'Code Generation', icon: Code },
  { id: 'code_review', label: 'Code Review', icon: Shield },
  { id: 'testing', label: 'Testing', icon: TestTube },
  { id: 'documentation', label: 'Documentation', icon: BookOpen },
  { id: 'data_analysis', label: 'Data Analysis', icon: Database },
  { id: 'security_analysis', label: 'Security Analysis', icon: Shield },
  { id: 'performance_optimization', label: 'Performance', icon: Zap },
  { id: 'api_integration', label: 'API Integration', icon: Globe },
];

const CustomAgentManager: React.FC<CustomAgentManagerProps> = ({
  userRole,
  projectId,
  token: propToken,
  onAgentSelect,
  onAgentsChange
}) => {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [publicAgents, setPublicAgents] = useState<CustomAgent[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [projectAgentsData, setProjectAgentsData] = useState<AllProjectAgentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProjectAgents, setLoadingProjectAgents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'my-agents' | 'project-agents' | 'marketplace' | 'templates'>('my-agents');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);
  const [viewingSystemAgent, setViewingSystemAgent] = useState<Agent | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSystemAgents, setShowSystemAgents] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const canCustomize = useFeatureAccess('agent_customization', userRole);
  const canDelete = useFeatureAccess('agent_deletion', userRole);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    mode: 'Reasoning' as 'Reasoning' | 'Deterministic',
    description: '',
    goal: '',
    backstory: '',
    systemPrompt: '',
    capabilities: [] as string[],
    preferredLLM: '',
    temperature: 0.7,
    maxTokens: 4096,
    tools: [] as string[],
    isPublic: false,
    tags: [] as string[],
  });

  const getAuthToken = () => {
    // Use prop token first, then try admin token (for admin console), then regular user token
    const token = propToken || localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
    if (!token) {
      console.warn('CustomAgentManager: No authentication token found');
    }
    return token;
  };

  const fetchAgents = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Access token required. Please log in to view custom agents.');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/custom-agents${projectId ? `?projectId=${projectId}` : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch agents' }));
          throw new Error(errorData.message || 'Failed to fetch agents');
        }
        return;
      }

      const data = await response.json();
      setAgents(data.data.agents || []);
      onAgentsChange?.(data.data.agents || []);
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Error fetching agents:', err);
      setError(err.message || 'Failed to fetch agents');
    }
  }, [projectId, onAgentsChange]);

  const fetchPublicAgents = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        // Public agents might not require auth, but we still need token for consistency
        console.warn('No token available for fetching public agents');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/custom-agents/public${searchTerm ? `?search=${searchTerm}` : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Authentication failed for public agents');
          return;
        }
        throw new Error('Failed to fetch public agents');
      }

      const data = await response.json();
      setPublicAgents(data.data.agents || []);
    } catch (err: any) {
      console.error('Error fetching public agents:', err);
      // Don't set error for public agents as it's not critical
    }
  }, [searchTerm]);

  const fetchTemplates = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No token available for fetching templates');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/custom-agents/templates/list`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Authentication failed for templates');
          return;
        }
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.data.templates || []);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      // Don't set error for templates as it's not critical
    }
  }, []);

  const fetchProjectAgents = useCallback(async () => {
    // Only fetch if user is admin/superadmin
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return;
    }
    
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Access token required. Please log in to view project agents.');
        return;
      }

      setLoadingProjectAgents(true);
      const data = await customAgentApi.getAllProjectAgents(token);
      setProjectAgentsData(data);
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Error fetching project agents:', err);
      // Don't show error for permission denied - just means user isn't admin
      if (!err.message?.includes('permission') && !err.message?.includes('Access token required')) {
        setError(err.message);
      } else if (err.message?.includes('Access token required')) {
        setError('Access token required. Please log in to view project agents.');
      }
    } finally {
      setLoadingProjectAgents(false);
    }
  }, [userRole]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchPublicAgents(), fetchTemplates()]);
      setLoading(false);
    };
    loadData();
  }, [fetchAgents, fetchPublicAgents, fetchTemplates]);

  // Load project agents when switching to that tab
  useEffect(() => {
    if (activeTab === 'project-agents' && !projectAgentsData) {
      fetchProjectAgents();
    }
  }, [activeTab, projectAgentsData, fetchProjectAgents]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: '',
      mode: 'Reasoning',
      description: '',
      goal: '',
      backstory: '',
      systemPrompt: '',
      capabilities: [],
      preferredLLM: '',
      temperature: 0.7,
      maxTokens: 4096,
      tools: [],
      isPublic: false,
      tags: [],
    });
    setEditingAgent(null);
    setViewingSystemAgent(null);
    setShowAdvanced(false);
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.role || !formData.description || !formData.goal || !formData.backstory) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = getAuthToken();
      const url = editingAgent
        ? `${API_BASE_URL}/api/custom-agents/${editingAgent.id}`
        : `${API_BASE_URL}/api/custom-agents`;
      
      const response = await fetch(url, {
        method: editingAgent ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          projectId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to save agent');
      }

      setSuccess(editingAgent ? 'Agent updated successfully!' : 'Agent created successfully!');
      setShowCreateModal(false);
      resetForm();
      await fetchAgents();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!await showConfirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/custom-agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      setSuccess('Agent deleted successfully!');
      await fetchAgents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClone = async (agentId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/custom-agents/${agentId}/clone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to clone agent');
      }

      setSuccess('Agent cloned to your collection!');
      await fetchAgents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRate = async (agentId: string, rating: number) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/custom-agents/${agentId}/rate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating })
      });

      if (!response.ok) {
        throw new Error('Failed to rate agent');
      }

      setSuccess('Rating submitted!');
      await fetchPublicAgents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditAgent = (agent: CustomAgent) => {
    setFormData({
      name: agent.name,
      role: agent.role,
      mode: agent.mode,
      description: agent.description,
      goal: agent.goal,
      backstory: agent.backstory,
      systemPrompt: agent.systemPrompt || '',
      capabilities: agent.capabilities,
      preferredLLM: agent.preferredLLM || '',
      temperature: agent.temperature || 0.7,
      maxTokens: agent.maxTokens || 4096,
      tools: agent.tools,
      isPublic: agent.isPublic,
      tags: agent.tags,
    });
    setEditingAgent(agent);
    setShowCreateModal(true);
  };

  const handleUseTemplate = (template: AgentTemplate) => {
    setFormData({
      ...formData,
      name: template.name,
      role: template.role,
      description: template.description,
      goal: template.goal,
      backstory: template.backstory || `An expert ${template.role} with years of experience in the field.`,
      capabilities: template.capabilities,
      tags: template.tags,
    });
    setShowCreateModal(true);
  };

  const convertToAgent = (customAgent: CustomAgent): Agent => ({
    id: customAgent.id,
    name: customAgent.name,
    role: customAgent.role,
    mode: customAgent.mode === 'Reasoning' ? Mode.REASONING : Mode.DETERMINISTIC,
    avatar: customAgent.avatar,
    description: customAgent.description,
    goal: customAgent.goal,
    backstory: customAgent.backstory,
  });

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canCustomize.enabled && !canCustomize.loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
        <h3 className="font-bold text-yellow-800 mb-1">Agent Customization Disabled</h3>
        <p className="text-sm text-yellow-700">
          This feature is not enabled for your role. Contact an administrator to enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bot className="text-blue-600" />
            Custom Agents
          </h2>
          <p className="text-sm text-slate-500 mt-1">Create and manage your own AI agents</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Create Agent
        </button>
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
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} className="text-red-600" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('my-agents')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my-agents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bot size={14} className="inline mr-1" /> My Agents ({agents.length + SYSTEM_AGENTS.length})
        </button>
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <button
            onClick={() => setActiveTab('project-agents')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'project-agents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FolderOpen size={14} className="inline mr-1" /> Project Agents
            {projectAgentsData && (
              <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                {projectAgentsData.totalAgents}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'marketplace'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe size={14} className="inline mr-1" /> Marketplace
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles size={14} className="inline mr-1" /> Templates
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search agents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* My Agents Tab */}
          {activeTab === 'my-agents' && (
            <div className="space-y-6">
              {/* System Agents Section */}
              <div>
                <button
                  onClick={() => setShowSystemAgents(!showSystemAgents)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3 hover:text-slate-900"
                >
                  <Cpu size={16} className="text-purple-600" />
                  System Agents ({SYSTEM_AGENTS.filter(a => 
                    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    a.role.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length})
                  {showSystemAgents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                
                {showSystemAgents && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SYSTEM_AGENTS
                      .filter(agent =>
                        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        agent.role.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map(agent => (
                        <div
                          key={agent.id}
                          className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 hover:border-purple-400 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={agent.avatar}
                              alt={agent.name}
                              className="w-12 h-12 rounded-lg bg-white"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-800 truncate">{agent.name}</h3>
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                                  SYSTEM
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">{agent.role}</p>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{agent.description}</p>
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-purple-100">
                            <span className="text-xs text-purple-500 flex items-center gap-1">
                              <Cpu size={10} />
                              Built-in Agent
                            </span>
                            <button
                              onClick={() => {
                                // Pre-fill form with system agent data for viewing
                                setFormData({
                                  name: agent.name,
                                  role: agent.role,
                                  mode: agent.mode === Mode.REASONING ? 'Reasoning' : 'Deterministic',
                                  description: agent.description,
                                  goal: agent.goal,
                                  backstory: agent.backstory,
                                  systemPrompt: '',
                                  capabilities: [],
                                  preferredLLM: '',
                                  temperature: 0.7,
                                  maxTokens: 4096,
                                  tools: [],
                                  isPublic: false,
                                  tags: [],
                                });
                                setEditingAgent(null);
                                setViewingSystemAgent(agent); // Mark as viewing system agent
                                setShowCreateModal(true);
                              }}
                              className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 flex items-center gap-1"
                            >
                              <Settings size={12} />
                              View
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Custom Agents Section */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                  <Bot size={16} className="text-blue-600" />
                  Custom Agents ({filteredAgents.length})
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAgents.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg">
                      <Bot size={48} className="mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-500">No custom agents yet. Create your first one!</p>
                    </div>
                  ) : (
                    filteredAgents.map(agent => (
                      <div
                        key={agent.id}
                        className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-12 h-12 rounded-lg bg-slate-100"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-800 truncate">{agent.name}</h3>
                              {agent.isPublic ? (
                                <Globe size={12} className="text-green-600" title="Public" />
                              ) : (
                                <Lock size={12} className="text-slate-400" title="Private" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{agent.role}</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{agent.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {agent.capabilities.slice(0, 3).map(cap => (
                            <span key={cap} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                              {cap.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                          <span className="text-xs text-slate-400">
                            Used {agent.usageCount} times
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => onAgentSelect?.(convertToAgent(agent))}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Use
                            </button>
                            <button
                              onClick={() => handleEditAgent(agent)}
                              className="p-1 text-slate-400 hover:text-blue-600"
                              title="Edit"
                            >
                              <Settings size={14} />
                            </button>
                            {canDelete.enabled && (
                              <button
                                onClick={() => handleDelete(agent.id)}
                                className="p-1 text-slate-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Project Agents Tab */}
          {activeTab === 'project-agents' && (
            <div className="space-y-4">
              {loadingProjectAgents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-purple-600" />
                  <span className="ml-3 text-slate-500">Loading project agents...</span>
                </div>
              ) : !projectAgentsData || projectAgentsData.totalAgents === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                  <FolderOpen size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-600 font-medium">No project-specific agents found.</p>
                  <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                    Project Agents shows custom agents that are assigned to specific projects.
                  </p>
                  <div className="mt-4 text-left max-w-md mx-auto bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm font-medium text-slate-700 mb-2">To create project-specific agents:</p>
                    <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                      <li>Go to the "My Agents" tab</li>
                      <li>Click "Create Agent"</li>
                      <li>When creating, make sure you're in a project workspace</li>
                      <li>The agent will be automatically assigned to the current project</li>
                    </ol>
                  </div>
                  {projectAgentsData?.message && (
                    <p className="text-xs text-slate-400 mt-3 italic">{projectAgentsData.message}</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <Bot size={20} className="text-purple-600" />
                        <span className="text-2xl font-bold text-purple-700">{projectAgentsData.totalAgents}</span>
                      </div>
                      <p className="text-sm text-purple-600 mt-1">Total Agents</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <FolderOpen size={20} className="text-blue-600" />
                        <span className="text-2xl font-bold text-blue-700">{projectAgentsData.totalProjects}</span>
                      </div>
                      <p className="text-sm text-blue-600 mt-1">Projects with Agents</p>
                    </div>
                  </div>

                  {/* Project Groups */}
                  <div className="space-y-4">
                    {projectAgentsData.projectAgents
                      .filter(group => 
                        group.agents.some(agent =>
                          agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          agent.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          group.projectName.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                      )
                      .map(group => (
                        <div key={group.projectId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          {/* Project Header */}
                          <button
                            onClick={() => toggleProjectExpanded(group.projectId)}
                            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                <FolderOpen size={20} className="text-white" />
                              </div>
                              <div className="text-left">
                                <h3 className="font-semibold text-slate-800">{group.projectName}</h3>
                                <p className="text-xs text-slate-500 line-clamp-1">{group.projectDescription || 'No description'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                {group.agents.length} agent{group.agents.length !== 1 ? 's' : ''}
                              </span>
                              {expandedProjects.has(group.projectId) ? (
                                <ChevronUp size={20} className="text-slate-400" />
                              ) : (
                                <ChevronDown size={20} className="text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* Project Agents */}
                          {expandedProjects.has(group.projectId) && (
                            <div className="p-4 border-t border-slate-200 bg-slate-50/50">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {group.agents
                                  .filter(agent =>
                                    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    agent.role.toLowerCase().includes(searchTerm.toLowerCase())
                                  )
                                  .map(agent => (
                                    <div
                                      key={agent.id}
                                      className="bg-white border border-slate-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
                                    >
                                      <div className="flex items-start gap-3">
                                        <img
                                          src={agent.avatar}
                                          alt={agent.name}
                                          className="w-12 h-12 rounded-lg bg-slate-100"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-slate-800 truncate">{agent.name}</h4>
                                            {agent.isPublic ? (
                                              <Globe size={12} className="text-green-600" title="Public" />
                                            ) : (
                                              <Lock size={12} className="text-slate-400" title="Private" />
                                            )}
                                          </div>
                                          <p className="text-xs text-slate-500">{agent.role}</p>
                                        </div>
                                      </div>
                                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">{agent.description}</p>
                                      
                                      {/* Creator Info */}
                                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                                        <User size={12} className="text-slate-400" />
                                        <span className="text-xs text-slate-500">
                                          Created by {agent.creatorName || agent.creatorEmail || 'Unknown'}
                                        </span>
                                      </div>

                                      {/* Capabilities */}
                                      {agent.capabilities && agent.capabilities.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {agent.capabilities.slice(0, 3).map(cap => (
                                            <span key={cap} className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded">
                                              {cap.replace('_', ' ')}
                                            </span>
                                          ))}
                                          {agent.capabilities.length > 3 && (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                                              +{agent.capabilities.length - 3}
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* Actions */}
                                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                                        <span className="text-xs text-slate-400">
                                          Used {agent.usageCount} times
                                        </span>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleClone(agent.id)}
                                            className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 flex items-center gap-1"
                                          >
                                            <Copy size={12} /> Clone
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Marketplace Tab */}
          {activeTab === 'marketplace' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicAgents.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg">
                  <Globe size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500">No public agents available yet.</p>
                </div>
              ) : (
                publicAgents.map(agent => (
                  <div
                    key={agent.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="w-12 h-12 rounded-lg bg-slate-100"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 truncate">{agent.name}</h3>
                        <p className="text-xs text-slate-500">{agent.role}</p>
                        {agent.rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-xs text-slate-600">
                              {agent.rating.toFixed(1)} ({agent.ratingCount})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{agent.description}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        <Users size={12} className="inline mr-1" />
                        {agent.usageCount} users
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleClone(agent.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Copy size={12} /> Clone
                        </button>
                        <button
                          onClick={() => handleRate(agent.id, 5)}
                          className="p-1 text-slate-400 hover:text-yellow-500"
                          title="Rate"
                        >
                          <Star size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-blue-600" />
                    <h3 className="font-semibold text-slate-800">{template.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{template.role}</p>
                  <p className="text-sm text-slate-600 line-clamp-2">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleUseTemplate(template)}
                    className="mt-4 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingAgent ? 'Edit Agent' : 'Create Custom Agent'}
                </h3>
                <button onClick={() => { setShowCreateModal(false); resetForm(); }}>
                  <X size={20} className="text-slate-400 hover:text-slate-600" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g., Code Reviewer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g., Senior Code Reviewer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={2}
                  placeholder="Brief description of what this agent does"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Goal <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={2}
                  placeholder="What is this agent's primary objective?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Backstory <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.backstory}
                  onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={3}
                  placeholder="The agent's background and experience that shapes its behavior"
                />
              </div>

              {/* Capabilities */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Capabilities</label>
                <div className="flex flex-wrap gap-2">
                  {CAPABILITY_OPTIONS.map(cap => (
                    <button
                      key={cap.id}
                      type="button"
                      onClick={() => {
                        const newCaps = formData.capabilities.includes(cap.id)
                          ? formData.capabilities.filter(c => c !== cap.id)
                          : [...formData.capabilities, cap.id];
                        setFormData({ ...formData, capabilities: newCaps });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${
                        formData.capabilities.includes(cap.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <cap.icon size={14} />
                      {cap.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode & Visibility */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mode</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value as 'Reasoning' | 'Deterministic' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Reasoning">Reasoning (Creative)</option>
                    <option value="Deterministic">Deterministic (Precise)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="isPublic" className="text-sm text-slate-700">
                    Make public (share in marketplace)
                  </label>
                </div>
              </div>

              {/* Advanced Settings */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        System Prompt
                      </label>
                      <textarea
                        value={formData.systemPrompt}
                        onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                        rows={4}
                        placeholder="Custom system prompt for this agent..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Temperature ({formData.temperature})
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={formData.temperature}
                          onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Max Tokens
                        </label>
                        <input
                          type="number"
                          value={formData.maxTokens}
                          onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          min="100"
                          max="128000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={formData.tags.join(', ')}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="code, review, security"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrUpdate}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {editingAgent ? 'Update Agent' : 'Create Agent'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomAgentManager;

