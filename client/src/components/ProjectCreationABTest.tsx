/**
 * Project Creation Component with A/B Testing
 * Demonstrates real-world A/B testing implementation
 */

import { useProjectCreationUI } from '../hooks/useProjectCreationUI';
import { FeatureFlagUser } from '../services/featureFlagAdapter';
import { Plus, Sparkles, Zap } from 'lucide-react';

interface ProjectCreationABTestProps {
  user?: FeatureFlagUser;
  onCreateProject: () => void;
}

export function ProjectCreationABTest({ user, onCreateProject }: ProjectCreationABTestProps) {
  const { variant, loading, isWizard, isQuickStart, isControl } = useProjectCreationUI(user);

  if (loading) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-200 rounded"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Control: Original UI
  if (isControl) {
    return (
      <button
        onClick={onCreateProject}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        <Plus size={20} />
        <span>New Project</span>
      </button>
    );
  }

  // Variant A: Wizard UI
  if (isWizard) {
    return (
      <button
        onClick={onCreateProject}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
      >
        <Sparkles size={20} />
        <span>Start Project Wizard</span>
      </button>
    );
  }

  // Variant B: Quick Start UI
  if (isQuickStart) {
    return (
      <button
        onClick={onCreateProject}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
      >
        <Zap size={20} />
        <span>Quick Start Project</span>
      </button>
    );
  }

  // Fallback
  return (
    <button
      onClick={onCreateProject}
      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
    >
      <Plus size={20} />
      <span>New Project</span>
    </button>
  );
}

