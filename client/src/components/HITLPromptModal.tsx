import React, { useState } from 'react';
import { X, UserCheck, Zap, AlertCircle } from 'lucide-react';

interface HITLPromptModalProps {
  isOpen: boolean;
  onConfirm: (enableHITL: boolean) => void;
  onClose: () => void;
}

const HITLPromptModal: React.FC<HITLPromptModalProps> = ({
  isOpen,
  onConfirm,
  onClose
}) => {
  const [selectedOption, setSelectedOption] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedOption !== null) {
      onConfirm(selectedOption);
    }
  };

  const handleOptionSelect = (enableHITL: boolean) => {
    setSelectedOption(enableHITL);
  };

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg m-4 border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UserCheck size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-800">Human-in-the-Loop (HITL) Preference</h3>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors shrink-0 ml-2"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              How should the system handle tasks that don't meet quality standards after automatic retries?
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {/* Option 1: Enable HITL */}
          <button
            onClick={() => handleOptionSelect(true)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedOption === true
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-slate-200 hover:border-primary/30 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                selectedOption === true ? 'border-primary bg-primary' : 'border-slate-300'
              }`}>
                {selectedOption === true && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck size={16} className={selectedOption === true ? 'text-primary' : 'text-slate-400'} />
                  <span className="font-bold text-sm text-slate-800">Require Human Review</span>
                </div>
                <p className="text-xs text-slate-600">
                  Low-quality tasks will pause for manual review. You'll have full control over what gets approved.
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Disable HITL */}
          <button
            onClick={() => handleOptionSelect(false)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedOption === false
                ? 'border-accent bg-accent/5 shadow-md'
                : 'border-slate-200 hover:border-accent/30 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                selectedOption === false ? 'border-accent bg-accent' : 'border-slate-300'
              }`}>
                {selectedOption === false && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={16} className={selectedOption === false ? 'text-accent' : 'text-slate-400'} />
                  <span className="font-bold text-sm text-slate-800">Auto-Complete</span>
                </div>
                <p className="text-xs text-slate-600">
                  AI agents will auto-complete tasks even if quality is below threshold. Faster workflow, less control.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg mb-6">
          <AlertCircle size={16} className="text-slate-400 shrink-0" />
          <p className="text-xs text-slate-600">
            This preference will be saved for this session. You can change it anytime in Settings.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-bold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedOption === null}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors font-bold text-sm ${
              selectedOption === null
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-primary hover:bg-blue-600 text-white'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default HITLPromptModal;




