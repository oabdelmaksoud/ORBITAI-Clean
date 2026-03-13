
import React from 'react';
import { Agent, Mode } from '@orbitai/shared';
import { X, BrainCircuit, Terminal, Target, BookOpen, User, Edit2 } from 'lucide-react';

interface AgentDetailModalProps {
  agent: Agent | null;
  onClose: () => void;
  onEdit?: (agent: Agent) => void;
  canEdit?: boolean;
}

const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ agent, onClose, onEdit, canEdit = false }) => {
  if (!agent) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 m-4 relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {canEdit && onEdit && (
            <button 
              onClick={() => onEdit(agent)} 
              className="p-1.5 hover:bg-blue-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
              title="Edit Agent"
            >
              <Edit2 size={18} />
            </button>
          )}
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 text-center border-b border-slate-100 bg-slate-50/50">
            <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 shadow-sm mx-auto mb-4 p-1">
                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover rounded-xl" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{agent.name}</h2>
            <div className="flex justify-center items-center gap-2 mt-2">
                 <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded border border-primary/20">
                    {agent.role}
                 </span>
                 <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded border flex items-center gap-1 ${agent.mode === Mode.REASONING ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-success/10 text-success border-success/20'}`}>
                    {agent.mode === Mode.REASONING ? <BrainCircuit size={10} /> : <Terminal size={10} />}
                    {agent.mode}
                 </span>
            </div>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            
            {/* Description */}
            <div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <User size={12} /> Profile
                 </h3>
                 <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {agent.description}
                 </p>
            </div>

            {/* Goal */}
            <div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Target size={12} className="text-primary" /> Prime Directive (Goal)
                 </h3>
                 <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 italic border-l-4 border-l-primary">
                    "{agent.goal}"
                 </p>
            </div>

            {/* Backstory */}
            <div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <BookOpen size={12} className="text-secondary" /> Backstory
                 </h3>
                 <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {agent.backstory}
                 </p>
            </div>

        </div>
      </div>
    </div>
  );
};

export default AgentDetailModal;
