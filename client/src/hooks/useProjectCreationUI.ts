/**
 * Hook for A/B Testing Project Creation UI
 * Real-world implementation example
 */

import { useABTest } from './useFeatureFlagAdapter';
import { FeatureFlagUser } from '../services/featureFlagAdapter';

export function useProjectCreationUI(user?: FeatureFlagUser) {
  const { variant, loading, error } = useABTest(
    'project_creation_ui',
    [
      { name: 'control', percentage: 50 },      // 50% see old UI
      { name: 'wizard', percentage: 30 },      // 30% see wizard UI
      { name: 'quick_start', percentage: 20 }  // 20% see quick start UI
    ],
    user,
    ['user', 'admin', 'superadmin'],
    ['starter', 'pro', 'enterprise']
  );

  return {
    variant,
    loading,
    error,
    isWizard: variant === 'wizard',
    isQuickStart: variant === 'quick_start',
    isControl: variant === 'control'
  };
}

