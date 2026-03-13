/**
 * React Hook for Feature Flag Adapter
 * Provides unified interface for feature flags with A/B testing and gradual rollouts
 */

import { useState, useEffect, useCallback } from 'react';
import { featureFlagService, FeatureFlagUser, RolloutConfig, ABTestConfig } from '../services/featureFlagAdapter';

export interface UseFeatureFlagOptions {
  user?: FeatureFlagUser;
  rolloutConfig?: RolloutConfig;
  abTestConfig?: ABTestConfig;
  fallbackEnabled?: boolean;
}

export interface UseFeatureFlagResult {
  enabled: boolean;
  value: any;
  loading: boolean;
  error: string | null;
  source?: string;
  variant?: string; // For A/B testing
  refresh: () => Promise<void>;
}

/**
 * Main hook for checking feature flags
 */
export function useFeatureFlag(
  featureKey: string,
  options: UseFeatureFlagOptions = {}
): UseFeatureFlagResult {
  const {
    user,
    rolloutConfig,
    abTestConfig,
    fallbackEnabled = false
  } = options;

  const [enabled, setEnabled] = useState<boolean>(fallbackEnabled);
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | undefined>(undefined);
  const [variant, setVariant] = useState<string | undefined>(undefined);

  const checkFeature = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let result;

      // If A/B test config is provided, get variant first
      if (abTestConfig) {
        const testVariant = await featureFlagService.getABTestVariant(
          featureKey,
          user,
          abTestConfig
        );
        setVariant(testVariant);

        // Check if this variant is enabled
        const variantKey = `${featureKey}_${testVariant}`;
        result = await featureFlagService.isEnabled(variantKey, user);
        
        // If variant-specific flag doesn't exist, check base flag
        if (!result.enabled) {
          result = await featureFlagService.isEnabled(featureKey, user);
        }
      } else if (rolloutConfig) {
        // Use gradual rollout
        result = await featureFlagService.isEnabledWithRollout(
          featureKey,
          user,
          rolloutConfig
        );
      } else {
        // Standard check
        result = await featureFlagService.isEnabled(featureKey, user);
      }

      setEnabled(result.enabled);
      setValue(result.value !== undefined ? result.value : result.enabled);
      setSource(result.source);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setEnabled(fallbackEnabled);
      console.error(`[useFeatureFlag] Error checking '${featureKey}':`, err);
    } finally {
      setLoading(false);
    }
  }, [featureKey, user, rolloutConfig, abTestConfig, fallbackEnabled]);

  useEffect(() => {
    checkFeature();
  }, [checkFeature]);

  return {
    enabled,
    value,
    loading,
    error,
    source,
    variant,
    refresh: checkFeature
  };
}

/**
 * Hook for A/B testing
 */
export function useABTest(
  featureKey: string,
  variants: ABTestConfig['variants'],
  user?: FeatureFlagUser,
  targetRoles?: string[],
  targetPlans?: string[]
): {
  variant: string;
  value: any;
  loading: boolean;
  error: string | null;
} {
  const [variant, setVariant] = useState<string>('control');
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const runABTest = async () => {
      try {
        setLoading(true);
        setError(null);

        const config: ABTestConfig = {
          variants,
          targetRoles,
          targetPlans
        };

        const selectedVariant = await featureFlagService.getABTestVariant(
          featureKey,
          user,
          config
        );

        setVariant(selectedVariant);

        // Get value for the variant
        const variantKey = `${featureKey}_${selectedVariant}`;
        const result = await featureFlagService.getValue(variantKey, user);
        setValue(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error(`[useABTest] Error running A/B test for '${featureKey}':`, err);
      } finally {
        setLoading(false);
      }
    };

    runABTest();
  }, [featureKey, user, JSON.stringify(variants), JSON.stringify(targetRoles), JSON.stringify(targetPlans)]);

  return {
    variant,
    value,
    loading,
    error
  };
}

/**
 * Hook for gradual rollouts
 */
export function useGradualRollout(
  featureKey: string,
  user: FeatureFlagUser | undefined,
  percentage: number,
  options: {
    targetRoles?: string[];
    targetPlans?: string[];
    startDate?: Date;
    endDate?: Date;
  } = {}
): {
  enabled: boolean;
  loading: boolean;
  error: string | null;
} {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkRollout = async () => {
      try {
        setLoading(true);
        setError(null);

        const config: RolloutConfig = {
          percentage,
          ...options
        };

        const result = await featureFlagService.isEnabledWithRollout(
          featureKey,
          user,
          config
        );

        setEnabled(result.enabled);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error(`[useGradualRollout] Error checking rollout for '${featureKey}':`, err);
      } finally {
        setLoading(false);
      }
    };

    checkRollout();
  }, [featureKey, user, percentage, JSON.stringify(options)]);

  return {
    enabled,
    loading,
    error
  };
}

/**
 * Hook to get all feature flags for a user
 */
export function useAllFeatureFlags(user?: FeatureFlagUser): {
  flags: Record<string, { enabled: boolean; value: any; source?: string }>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [flags, setFlags] = useState<Record<string, { enabled: boolean; value: any; source?: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const allFlags = await featureFlagService.getAllFlags(user);
      
      const formattedFlags: Record<string, { enabled: boolean; value: any; source?: string }> = {};
      Object.keys(allFlags).forEach(key => {
        formattedFlags[key] = {
          enabled: allFlags[key].enabled,
          value: allFlags[key].value,
          source: allFlags[key].source
        };
      });

      setFlags(formattedFlags);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useAllFeatureFlags] Error loading flags:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  return {
    flags,
    loading,
    error,
    refresh: loadFlags
  };
}

