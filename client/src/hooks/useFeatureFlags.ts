import { useFeatureAccessContext } from '../contexts/FeatureAccessContext';

/**
 * Hook providing convenient access to feature flags
 */
export function useFeatureFlags() {
  const ctx = useFeatureAccessContext();
  return {
    getFeatureAccess: ctx.getFeatureAccess,
    refreshFeatures: ctx.refreshFeatures,
    features: ctx.features,
    loading: ctx.loading,
  };
}
