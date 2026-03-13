
import React from 'react';
import { Agent, Mode, AgentRole } from '@orbitai/shared';
import { Bot, BrainCircuit, Terminal, Cpu, MessageSquare, Globe, Sparkles, Edit2, Trash2 } from 'lucide-react';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface AgentCardProps {
  agent: Agent;
  isActive: boolean;
  onChat?: (agent: Agent) => void;
  onSelect?: (agent: Agent) => void;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agentId: string) => void;
  useInternet?: boolean;
  canCustomize?: boolean;
  canDelete?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, isActive, onChat, onSelect, onEdit, onDelete, useInternet, canCustomize = false, canDelete = false }) => {
  const canSearch = useInternet && [
      AgentRole.ORCHESTRATOR,
      AgentRole.REQUIREMENTS_AGENT,
      AgentRole.DESIGN_ARCH_AGENT,
      AgentRole.QA_AUDIT_AGENT,
      AgentRole.TEST_REQ_ENGINEER,
      AgentRole.NOTEBOOK_AGENT
  ].includes(agent.role as any);

  return (
    <div 
      onClick={() => onSelect && onSelect(agent)}
      className={`
      relative p-4 rounded-xl border transition-all duration-300 overflow-hidden group shadow-sm
      ${onSelect ? 'cursor-pointer' : ''}
      ${isActive 
        ? 'bg-white border-primary/50 shadow-[0_0_20px_rgba(37,99,235,0.15)] translate-x-1 ring-1 ring-primary/30' 
        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}
    `}>
      {/* Active Indicator Line */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-500 ${isActive ? 'bg-primary' : 'bg-transparent'}`} />
      
      {/* Background Tech Pattern (Subtle) */}
      {isActive && (
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      )}

      <div className="flex items-start gap-4 relative z-10">
        <div className="relative shrink-0">
          
          {/* Holographic Glow for Active State */}
          {isActive && (
            <>
                <div className="absolute -inset-2 bg-gradient-to-tr from-primary/0 via-primary/20 to-primary/0 rounded-full blur-md opacity-70 animate-spin-slow" />
                <div className="absolute -inset-1 rounded-full border border-primary/30 border-dashed animate-spin-slow" style={{ animationDuration: '10s' }} />
            </>
          )}

          <div className={`
             w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-500 relative overflow-hidden backdrop-blur-sm
             ${isActive 
                ? 'border-primary/50 bg-gradient-to-br from-white to-slate-100' 
                : 'border-slate-100 bg-slate-50'}
          `}>
            <img 
              src={agent.avatar} 
              alt={agent.name} 
              className={`w-9 h-9 object-contain transition-all duration-500 ${isActive ? 'opacity-100 scale-110 drop-shadow-md animate-pulse-slow' : 'opacity-70 grayscale hover:grayscale-0 hover:opacity-100 hover:scale-105'}`}
            />
            
            {/* Thinking Overlay */}
            {isActive && (
               <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                   <div className="absolute top-1 right-1">
                       <Sparkles size={10} className="text-primary animate-pulse" />
                   </div>
               </div>
            )}
          </div>
          
          <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-md border-2 border-white flex items-center justify-center shadow-md transition-transform duration-300 z-10 ${isActive ? 'scale-110' : ''} ${
            agent.mode === Mode.REASONING ? 'bg-secondary' : 'bg-success'
          }`}>
             {agent.mode === Mode.REASONING ? <BrainCircuit size={10} className="text-white" /> : <Terminal size={10} className="text-white" />}
          </div>
        </div>
        
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex justify-between items-center mb-1">
            <h3 className={`font-bold text-sm tracking-tight transition-colors flex items-center gap-2 ${isActive ? 'text-primary' : 'text-slate-800'}`}>
              {agent.name}
              {isActive && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono uppercase tracking-wider animate-pulse">
                      Processing
                  </span>
              )}
            </h3>
            <div className="flex items-center gap-1.5">
                {canSearch && (
                    <div className="relative group/tooltip">
                        <Globe size={12} className={`text-success transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`} />
                        <span className="absolute hidden group-hover/tooltip:block right-0 -top-6 bg-slate-800 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-20 border border-slate-700 shadow-xl">
                            Internet Access
                        </span>
                    </div>
                )}

                {isActive && <Cpu size={12} className="text-primary animate-spin-slow" />}
                
                {onChat && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onChat(agent); }}
                        className={`p-1.5 rounded-lg transition-all shadow-sm ${isActive ? 'bg-primary text-white hover:bg-blue-600' : 'bg-slate-100 hover:bg-primary hover:text-white text-slate-400 border border-transparent'}`}
                        title="Neural Link (Chat)"
                    >
                        <MessageSquare size={10} className="fill-current" />
                    </button>
                )}
                {canCustomize && onEdit && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(agent); }}
                        className="p-1.5 rounded-lg transition-all shadow-sm bg-slate-100 hover:bg-blue-100 hover:text-blue-600 text-slate-400 border border-transparent"
                        title="Edit Agent"
                    >
                        <Edit2 size={10} />
                    </button>
                )}
                {canDelete && onDelete && (
                      <button 
                          onClick={async (e) => { e.stopPropagation(); if (await showConfirm(`Delete agent "${agent.name}"?`)) onDelete(agent.id); }}
                        className="p-1.5 rounded-lg transition-all shadow-sm bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-400 border border-transparent"
                        title="Delete Agent"
                    >
                        <Trash2 size={10} />
                    </button>
                )}
            </div>
          </div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1 font-bold">
            <Bot size={10} className="opacity-50" /> {agent.role.replace(' Agent', '')}
          </p>
        </div>
      </div>
      
      <div className="mt-3 pl-1 relative">
         <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity">
          {agent.description}
        </p>
      </div>
      
      {/* Scanline effect for active agents */}
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-[200%] w-full animate-scan pointer-events-none" />
      )}
    </div>
  );
};

export default AgentCard;
