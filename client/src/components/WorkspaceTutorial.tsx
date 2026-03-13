import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, Code, MessageSquare, FileCode, Eye, Zap, CheckCircle } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string; // CSS selector or element to highlight
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to OrbitAI Workspace!',
    description: 'This is your development workspace where AI agents help you build projects. Let\'s take a quick tour of the key features.',
    icon: <Sparkles size={24} className="text-primary" />
  },
  {
    id: 'agents',
    title: 'AI Agents',
    description: 'Your AI agents work here. Each agent has a specific role - from planning to implementation to testing. Click on an agent card to chat with them.',
    icon: <MessageSquare size={24} className="text-primary" />
  },
  {
    id: 'kanban',
    title: 'Task Board',
    description: 'Track all your project tasks here. Tasks move through phases: Pending → In Progress → Completed. Drag and drop to update status.',
    icon: <CheckCircle size={24} className="text-primary" />
  },
  {
    id: 'code-editor',
    title: 'Code Editor',
    description: 'View and edit all your project files here. The editor supports autocomplete, search, and refactoring. Click the Code Editor tab to open it.',
    icon: <Code size={24} className="text-primary" />
  },
  {
    id: 'artifacts',
    title: 'Artifacts',
    description: 'All generated files, code, designs, and documentation appear here. You can view, edit, and download any artifact.',
    icon: <FileCode size={24} className="text-primary" />
  },
  {
    id: 'preview',
    title: 'Preview Mode',
    description: 'See your project in action! Click the Preview tab to view your running application or prototype.',
    icon: <Eye size={24} className="text-primary" />
  },
  {
    id: 'ai-features',
    title: 'AI Features',
    description: 'Use Cmd/Ctrl + K to search code, select code and click "Explain" or "Refactor", and enjoy AI-powered autocomplete as you type.',
    icon: <Zap size={24} className="text-primary" />
  }
];

const TUTORIAL_STORAGE_KEY = 'orbitai_workspace_tutorial_completed';

export function hasCompletedTutorial(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
}

export function markTutorialComplete(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
}

interface WorkspaceTutorialProps {
  onComplete: () => void;
}

const WorkspaceTutorial: React.FC<WorkspaceTutorialProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    markTutorialComplete();
    setIsVisible(false);
    onComplete();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step.icon}
              <div>
                <h2 className="text-xl font-bold text-slate-800">{step.title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              title="Skip tutorial"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {step.icon}
            </div>
            <p className="text-slate-700 text-lg leading-relaxed max-w-md">
              {step.description}
            </p>
            
            {/* Progress Dots */}
            <div className="flex items-center gap-2 mt-6">
              {TUTORIAL_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'bg-primary w-8'
                      : index < currentStep
                      ? 'bg-primary/30 w-2'
                      : 'bg-slate-200 w-2'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-colors"
          >
            Skip Tutorial
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={isFirstStep}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isFirstStep
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-md"
            >
              {isLastStep ? (
                <>
                  <CheckCircle size={16} />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceTutorial;
















