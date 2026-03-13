/**
 * Hook for Gradual Rollout of New Code Editor
 * Real-world implementation example
 */

import { useGradualRollout } from './useFeatureFlagAdapter';
import { FeatureFlagUser } from '../services/featureFlagAdapter';

interface UseNewCodeEditorOptions {
  rolloutPercentage?: number;
  targetPlans?: string[];
}

export function useNewCodeEditor(
  user?: FeatureFlagUser,
  options: UseNewCodeEditorOptions = {}
) {
  const {
    rolloutPercentage = 25, // Default 25% rollout
    targetPlans = ['pro', 'enterprise']
  } = options;

  const { enabled, loading, error } = useGradualRollout(
    'new_code_editor',
    user,
    rolloutPercentage,
    {
      targetRoles: ['admin', 'superadmin'],
      targetPlans,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31')
    }
  );

  return {
    enabled,
    loading,
    error,
    useNewEditor: enabled,
    useOldEditor: !enabled && !loading
  };
}

