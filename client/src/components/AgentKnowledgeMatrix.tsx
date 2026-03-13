import React, { useState, useEffect } from 'react';
import {
  Brain, Users, TrendingUp, Star, Target, Zap, Award, CheckCircle,
  AlertCircle, Loader2, BarChart3, Layers, Code, BookOpen, Filter,
  Search, ChevronDown, ChevronUp, Eye, EyeOff
} from 'lucide-react';
import {
  getAllAgentKnowledge,
  getGlobalKnowledgeMatrix,
  AgentKnowledge,
  GlobalKnowledgeMatrix
} from '../services/agentKnowledgeApi';

interface AgentKnowledgeMatrixProps {
  token: string;
  initialViewMode?: 'agents' | 'skills' | 'knowledge';
  hideHeader?: boolean;
  hideTabs?: boolean;
}

const AgentKnowledgeMatrix: React.FC<AgentKnowledgeMatrixProps> = ({ 
  token, 
  initialViewMode = 'agents',
  hideHeader = false,
  hideTabs = false
}) => {
  const [agents, setAgents] = useState<AgentKnowledge[]>([]);
  const [globalMatrix, setGlobalMatrix] = useState<GlobalKnowledgeMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'agents' | 'skills' | 'knowledge'>(initialViewMode);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  
  // Update viewMode when initialViewMode prop changes
  React.useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [agentsData, matrixData] = await Promise.all([
        getAllAgentKnowledge(token),
        getGlobalKnowledgeMatrix(token)
      ]);

      setAgents(agentsData.agents);
      setGlobalMatrix(matrixData);
    } catch (err: any) {
      console.error('Failed to load agent knowledge:', err);
      setError(err.message || 'Failed to load agent knowledge matrix');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (agentRole: string) => {
    setExpandedAgents(prev => {
      const updated = new Set(prev);
      if (updated.has(agentRole)) {
        updated.delete(agentRole);
      } else {
        updated.add(agentRole);
      }
      return updated;
    });
  };

  const getProficiencyColor = (level: number) => {
    if (level >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (level >= 75) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (level >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const getExperienceBadge = (level: string) => {
    const colors: Record<string, string> = {
      expert: 'bg-purple-100 text-purple-700 border-purple-300',
      advanced: 'bg-blue-100 text-blue-700 border-blue-300',
      intermediate: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      beginner: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return colors[level] || colors.beginner;
  };

  const filteredSkills = globalMatrix?.skillMatrix.filter(skill => {
    if (selectedCategory !== 'all' && skill.category !== selectedCategory) return false;
    if (searchTerm && !skill.skill.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }) || [];

  const filteredKnowledge = globalMatrix?.knowledgeMatrix.filter(knowledge => {
    if (searchTerm && !knowledge.domain.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Only show if not hidden */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Brain size={28} className="text-blue-600" />
              AI Agents Knowledge & Skill Matrix
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Global view of all AI agents' capabilities, knowledge domains, and skills
            </p>
          </div>
          {globalMatrix && (
            <div className="flex items-center gap-4 text-sm">
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
                <div className="text-xs text-slate-500">Total Agents</div>
                <div className="font-bold text-slate-800">{globalMatrix.summary.totalAgents}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
                <div className="text-xs text-slate-500">Total Skills</div>
                <div className="font-bold text-slate-800">{globalMatrix.summary.totalSkills}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
                <div className="text-xs text-slate-500">Knowledge Domains</div>
                <div className="font-bold text-slate-800">{globalMatrix.summary.totalKnowledgeDomains}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats - Show when header is hidden */}
      {hideHeader && globalMatrix && (
        <div className="flex items-center gap-4 text-sm">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
            <div className="text-xs text-slate-500">Total Agents</div>
            <div className="font-bold text-slate-800">{globalMatrix.summary.totalAgents}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
            <div className="text-xs text-slate-500">Total Skills</div>
            <div className="font-bold text-slate-800">{globalMatrix.summary.totalSkills}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
            <div className="text-xs text-slate-500">Knowledge Domains</div>
            <div className="font-bold text-slate-800">{globalMatrix.summary.totalKnowledgeDomains}</div>
          </div>
        </div>
      )}

      {/* View Mode Tabs - Only show if not hidden */}
      {!hideTabs && (
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setViewMode('agents')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewMode === 'agents'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Users size={16} className="inline mr-2" />
            Agents Overview
          </button>
          <button
            onClick={() => setViewMode('skills')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewMode === 'skills'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Target size={16} className="inline mr-2" />
            Skills Matrix
          </button>
          <button
            onClick={() => setViewMode('knowledge')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewMode === 'knowledge'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} className="inline mr-2" />
            Knowledge Matrix
          </button>
        </div>
      )}

      {/* Agents Overview */}
      {viewMode === 'agents' && (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.agentRole}
              className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
            >
              <div
                className="p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(agent.agentRole)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{agent.agentRole}</h3>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <CheckCircle size={14} className="text-emerald-600" />
                        <span className="text-slate-600">
                          {agent.metrics.totalTasksCompleted} tasks completed
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-yellow-500" />
                        <span className="text-slate-600">
                          {agent.metrics.averageTaskQuality.toFixed(0)}% quality
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap size={14} className="text-blue-600" />
                        <span className="text-slate-600">
                          {(agent.metrics.averageResponseTime / 1000).toFixed(1)}s avg
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Skills</div>
                      <div className="font-bold text-slate-800">{agent.skills.length}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Domains</div>
                      <div className="font-bold text-slate-800">{agent.knowledgeDomains.length}</div>
                    </div>
                    {expandedAgents.has(agent.agentRole) ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              {expandedAgents.has(agent.agentRole) && (
                <div className="border-t border-slate-200 p-6 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Skills */}
                    <div>
                      <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Target size={16} />
                        Skills ({agent.skills.length})
                      </h4>
                      <div className="space-y-2">
                        {agent.skills.map((skill, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-slate-800">{skill.skill}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold border ${getProficiencyColor(skill.proficiency)}`}
                              >
                                {skill.proficiency}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="capitalize">{skill.category}</span>
                              <span>•</span>
                              <span
                                className={`px-1.5 py-0.5 rounded border text-xs ${getExperienceBadge(skill.experienceLevel)}`}
                              >
                                {skill.experienceLevel}
                              </span>
                              {skill.tasksCompleted && (
                                <>
                                  <span>•</span>
                                  <span>{skill.tasksCompleted} tasks</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Knowledge Domains */}
                    <div>
                      <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <BookOpen size={16} />
                        Knowledge Domains ({agent.knowledgeDomains.length})
                      </h4>
                      <div className="space-y-2">
                        {agent.knowledgeDomains.map((domain, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-slate-800">{domain.domain}</span>
                              <div className="w-24 bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${domain.level}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">
                              Level: {domain.level}%
                            </div>
                            {domain.examples && domain.examples.length > 0 && (
                              <div className="mt-2 text-xs text-slate-600">
                                <div className="font-medium mb-1">Examples:</div>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {domain.examples.slice(0, 3).map((example, i) => (
                                    <li key={i}>{example}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Specializations */}
                  {agent.specializations.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Award size={16} />
                        Specializations
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {agent.specializations.map((spec, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium border border-blue-200"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills Matrix */}
      {viewMode === 'skills' && globalMatrix && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(globalMatrix.skillMatrix.map(s => s.category))).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {filteredSkills.map((skill, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{skill.skill}</h3>
                    <span className="text-sm text-slate-500">{skill.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Avg Proficiency</div>
                    <div className="text-xl font-bold text-blue-600">
                      {skill.averageProficiency.toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {skill.agents.map((agent) => (
                    <div
                      key={agent.agentRole}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{agent.agentRole}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          <span className={`px-1.5 py-0.5 rounded border text-xs ${getExperienceBadge(agent.experienceLevel)}`}>
                            {agent.experienceLevel}
                          </span>
                          {agent.tasksCompleted && (
                            <span>{agent.tasksCompleted} tasks</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-slate-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full transition-all"
                            style={{ width: `${agent.proficiency}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-800 w-12 text-right">
                          {agent.proficiency}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Matrix */}
      {viewMode === 'knowledge' && globalMatrix && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search knowledge domains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-4">
            {filteredKnowledge.map((knowledge, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">{knowledge.domain}</h3>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Avg Level</div>
                    <div className="text-xl font-bold text-blue-600">
                      {knowledge.averageLevel.toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {knowledge.agents.map((agent) => (
                    <div
                      key={agent.agentRole}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <span className="font-medium text-slate-800">{agent.agentRole}</span>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-slate-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full transition-all"
                            style={{ width: `${agent.level}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-800 w-12 text-right">
                          {agent.level}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentKnowledgeMatrix;

