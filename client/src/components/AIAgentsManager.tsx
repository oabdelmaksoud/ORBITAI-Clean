import React, { useState } from 'react';
import {
  Bot, Brain, Users, Target, BookOpen, Settings, Cpu
} from 'lucide-react';
import AgentKnowledgeMatrix from './AgentKnowledgeMatrix';
import CustomAgentManager from './CustomAgentManager';
import { Agent } from '@orbitai/shared';

interface AIAgentsManagerProps {
  token: string;
  userRole: string;
  onAgentSelect?: (agent: Agent) => void;
}

type ViewMode = 'agents-overview' | 'skills-matrix' | 'knowledge-matrix' | 'custom-agents';

const AIAgentsManager: React.FC<AIAgentsManagerProps> = ({ token, userRole, onAgentSelect }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('agents-overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bot size={28} className="text-blue-600" />
            AI Agents Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage all AI agents, their knowledge, skills, and custom configurations
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 rounded-t-lg p-1">
        <button
          onClick={() => setViewMode('agents-overview')}
          className={`px-4 py-2.5 font-medium rounded-lg transition-all flex items-center gap-2 ${
            viewMode === 'agents-overview'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Users size={16} />
          Agents Overview
        </button>
        <button
          onClick={() => setViewMode('skills-matrix')}
          className={`px-4 py-2.5 font-medium rounded-lg transition-all flex items-center gap-2 ${
            viewMode === 'skills-matrix'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Target size={16} />
          Skills Matrix
        </button>
        <button
          onClick={() => setViewMode('knowledge-matrix')}
          className={`px-4 py-2.5 font-medium rounded-lg transition-all flex items-center gap-2 ${
            viewMode === 'knowledge-matrix'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <BookOpen size={16} />
          Knowledge Matrix
        </button>
        <button
          onClick={() => setViewMode('custom-agents')}
          className={`px-4 py-2.5 font-medium rounded-lg transition-all flex items-center gap-2 ${
            viewMode === 'custom-agents'
              ? 'bg-white text-purple-600 shadow-sm border border-purple-200'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Settings size={16} />
          Custom Agents
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {(viewMode === 'agents-overview' || viewMode === 'skills-matrix' || viewMode === 'knowledge-matrix') && (
          <AgentKnowledgeMatrix 
            token={token} 
            initialViewMode={viewMode === 'agents-overview' ? 'agents' : viewMode === 'skills-matrix' ? 'skills' : 'knowledge'}
            hideHeader={true}
            hideTabs={true}
          />
        )}

        {viewMode === 'custom-agents' && (
          <CustomAgentManager 
            userRole={userRole}
            token={token}
            onAgentSelect={onAgentSelect}
          />
        )}
      </div>
    </div>
  );
};

export default AIAgentsManager;

