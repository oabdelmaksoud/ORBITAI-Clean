import React, { useState } from 'react';
import { Task } from '@orbitai/shared';
import { X, Save, Wand2, Loader2, FileText, Type } from 'lucide-react';

interface TaskEditModalProps {
  task: Task;
  onClose: () => void;
  onSave: (taskId: string, title: string, description: string) => void;
  onAiModify: (taskId: string, instruction: string) => Promise<{ title: string; description: string }>;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ task, onClose, onSave, onAiModify }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const handleAiGenerate = async () => {
    if (!aiInstruction.trim()) return;
    
    setIsAiProcessing(true);
    try {
      const result = await onAiModify(task.id, aiInstruction);
      setTitle(result.title);
      setDescription(result.description);
      setAiInstruction(''); // Clear instruction on success
    } catch (error) {
      console.error("AI Modification failed", error);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSave = () => {
    onSave(task.id, title, description);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 m-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-primary" /> Edit Task
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
            </button>
        </div>

        <div className="p-6 space-y-6">
            
            {/* AI Magic Section */}
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                <label className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Wand2 size={12} /> AI Rewrite
                </label>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        placeholder="e.g., 'Make this focused on React instead of Vue'"
                        className="flex-1 bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-700 placeholder-purple-300"
                        onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                    />
                    <button 
                        onClick={handleAiGenerate}
                        disabled={!aiInstruction.trim() || isAiProcessing}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    </button>
                </div>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            {/* Manual Edit Fields */}
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Task Title</label>
                    <div className="relative">
                        <div className="absolute left-3 top-2.5 text-slate-400"><Type size={14} /></div>
                        <input 
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Description</label>
                    <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={6}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-600 leading-relaxed resize-none"
                    />
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm flex items-center gap-2"
            >
                <Save size={14} /> Save Changes
            </button>
        </div>

      </div>
    </div>
  );
};

export default TaskEditModal;