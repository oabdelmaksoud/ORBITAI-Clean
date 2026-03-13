import React from 'react';
import { Rocket, Settings, ArrowRight, Code2, Sparkles } from 'lucide-react';

interface SubProjectPhaseControlsProps {
  currentPhase: 0 | 1 | 2 | 3 | 4;
  activeSubProjectName?: string;
  onConvertToPrototype?: () => void;
  onLaunchToWorkspace?: () => void;
  isProcessing?: boolean;
  className?: string;
}

const SubProjectPhaseControls: React.FC<SubProjectPhaseControlsProps> = ({
  currentPhase,
  activeSubProjectName,
  onConvertToPrototype,
  onLaunchToWorkspace,
  isProcessing = false,
  className = ''
}) => {
  // Phase 2: Show "Convert to Prototype" button
  if (currentPhase === 2 && activeSubProjectName) {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Code2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Phase 2: Sub-Project Brainstorming</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Working on: <span className="font-semibold text-purple-600">{activeSubProjectName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onConvertToPrototype}
            disabled={isProcessing}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Converting...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4" />
                Convert to Prototype
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Phase 3: Show "Launch to Workspace" button
  if (currentPhase === 3 && activeSubProjectName) {
    return (
      <div className={`bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Phase 3: Prototyping</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Prototype ready for: <span className="font-semibold text-purple-600">{activeSubProjectName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onLaunchToWorkspace}
            disabled={isProcessing}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Launch to Workspace
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Phase 1: Show sub-project selection confirmation
  if (currentPhase === 1 && activeSubProjectName) {
    return (
      <div className={`bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Sparkles className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Phase 1: Sub-Project Selected</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Now brainstorming for: <span className="font-semibold text-green-600">{activeSubProjectName}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Focus your ideas on this sub-project. When ready, you can convert to prototype.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SubProjectPhaseControls;


