import React, { useState, useEffect } from 'react';
import { Agent, Mode, AgentRole } from '@orbitai/shared';
import { X, Save, BrainCircuit, Terminal, User, Target, BookOpen, Sparkles, AlertCircle } from 'lucide-react';

interface AgentEditorModalProps {
  agent: Agent | null;
  onClose: () => void;
  onSave: (agent: Agent) => void;
  isNew?: boolean;
}

const AVAILABLE_ROLES = Object.values(AgentRole);

const AgentEditorModal: React.FC<AgentEditorModalProps> = ({ agent, onClose, onSave, isNew = false }) => {
  const [formData, setFormData] = useState<Agent>({
    id: '',
    name: '',
    role: AgentRole.IMPLEMENTATION_AGENT,
    mode: Mode.REASONING,
    avatar: '',
    description: '',
    goal: '',
    backstory: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (agent) {
      setFormData({ ...agent });
    } else if (isNew) {
      // Generate new agent with defaults
      const newId = `custom-${Date.now()}`;
      setFormData({
        id: newId,
        name: '',
        role: AgentRole.IMPLEMENTATION_AGENT,
        mode: Mode.REASONING,
        avatar: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${newId}&backgroundColor=transparent`,
        description: '',
        goal: '',
        backstory: ''
      });
    }
  }, [agent, isNew]);

  if (!agent && !isNew) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.goal.trim()) {
      newErrors.goal = 'Goal is required';
    }
    
    if (!formData.backstory.trim()) {
      newErrors.backstory = 'Backstory is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSaving(true);
    try {
      // Update avatar based on name if it's a new agent or name changed
      const updatedAgent = {
        ...formData,
        avatar: formData.avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${formData.name}&backgroundColor=transparent`
      };
      onSave(updatedAgent);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof Agent, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 m-4 relative max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 shadow-sm p-1 flex items-center justify-center">
              {formData.avatar ? (
                <img src={formData.avatar} alt={formData.name || 'New Agent'} className="w-full h-full object-cover rounded" />
              ) : (
                <Sparkles className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {isNew ? 'Create New Agent' : `Edit ${formData.name}`}
              </h2>
              <p className="text-xs text-slate-500">
                {isNew ? 'Configure your custom AI agent' : 'Modify agent properties'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name & Role Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={12} /> Agent Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Alex"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.name}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white"
              >
                {AVAILABLE_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Processing Mode
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleChange('mode', Mode.REASONING)}
                className={`flex-1 p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  formData.mode === Mode.REASONING
                    ? 'border-secondary bg-secondary/5 text-secondary'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <BrainCircuit size={16} />
                <span className="text-sm font-medium">Reasoning</span>
              </button>
              <button
                type="button"
                onClick={() => handleChange('mode', Mode.DETERMINISTIC)}
                className={`flex-1 p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  formData.mode === Mode.DETERMINISTIC
                    ? 'border-success bg-success/5 text-success'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Terminal size={16} />
                <span className="text-sm font-medium">Deterministic</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {formData.mode === Mode.REASONING 
                ? 'Uses chain-of-thought reasoning for complex analysis and planning tasks'
                : 'Follows precise, step-by-step execution for implementation and testing tasks'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User size={12} /> Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the agent's expertise and capabilities..."
              rows={2}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none ${
                errors.description ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.description}
              </p>
            )}
          </div>

          {/* Goal */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Target size={12} className="text-primary" /> Prime Directive (Goal)
            </label>
            <textarea
              value={formData.goal}
              onChange={(e) => handleChange('goal', e.target.value)}
              placeholder="The agent's primary objective and what they strive to achieve..."
              rows={2}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none ${
                errors.goal ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.goal && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.goal}
              </p>
            )}
          </div>

          {/* Backstory */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BookOpen size={12} className="text-secondary" /> Backstory
            </label>
            <textarea
              value={formData.backstory}
              onChange={(e) => handleChange('backstory', e.target.value)}
              placeholder="The agent's background, experience, and personality that shapes their approach..."
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none ${
                errors.backstory ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {errors.backstory && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.backstory}
              </p>
            )}
          </div>

          {/* Custom Avatar URL (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Avatar URL <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.avatar}
              onChange={(e) => handleChange('avatar', e.target.value)}
              placeholder="https://... (leave empty for auto-generated avatar)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
            <p className="text-xs text-slate-400 mt-1">
              Leave empty to auto-generate based on agent name
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : (isNew ? 'Create Agent' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentEditorModal;

