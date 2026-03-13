import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { hasFeatureAccess, clearFeatureCache } from '../services/featureAccess';

// All feature keys used in the application
const FEATURE_KEYS = [
  'viewing_sample_projects',
  'project_creation',
  'project_deletion',
  'environment_switching',
  'project_export',
  'project_sharing',
  'project_import',
  'export_reports',
  'export_data',
  'terminal_access',
  'template_use',
  'view_all_projects',
  'code_editor',
  'artifact_viewer',
  'preview_mode',
  'ai_chat',
  'ai_code_generation',
  'ai_task_automation',
  'ai_suggestions',
  'agent_customization',
  'agent_deletion',
  'agent_automation',
] as const;

type FeatureKey = typeof FEATURE_KEYS[number];

interface FeatureAccessState {
  [key: string]: { enabled: boolean; loading: boolean };
}

interface FeatureAccessContextValue {
  features: FeatureAccessState;
  loading: boolean;
  refreshFeatures: () => void;
  getFeatureAccess: (featureKey: string) => { enabled: boolean; loading: boolean };
}

const defaultFeatureState: FeatureAccessState = FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = { enabled: true, loading: true }; // Default to enabled during loading
  return acc;
}, {} as FeatureAccessState);

const FeatureAccessContext = createContext<FeatureAccessContextValue>({
  features: defaultFeatureState,
  loading: true,
  refreshFeatures: () => {},
  getFeatureAccess: () => ({ enabled: true, loading: true }),
});

interface FeatureAccessProviderProps {
  children: React.ReactNode;
  userRole?: string;
}

export const FeatureAccessProvider: React.FC<FeatureAccessProviderProps> = ({
  children,
  userRole
}) => {
  const [features, setFeatures] = useState<FeatureAccessState>(defaultFeatureState);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const lastRoleRef = useRef<string | undefined>(undefined);

  // Memoize the role to prevent unnecessary re-fetches
  const role = useMemo(() => userRole || 'public', [userRole]);

  const fetchAllFeatures = useCallback(async (bypassCache = false) => {
    // Skip if role hasn't changed and we're not bypassing cache
    if (!bypassCache && lastRoleRef.current === role && !loading) {
      return;
    }

    lastRoleRef.current = role;
    setLoading(true);

    try {
      // Fetch all features in parallel
      const results = await Promise.all(
        FEATURE_KEYS.map(async (key) => {
          try {
            const enabled = await hasFeatureAccess(key, role, !bypassCache);
            return { key, enabled };
          } catch (error) {
            console.error(`Failed to fetch feature access for ${key}:`, error);
            return { key, enabled: true }; // Default to enabled on error
          }
        })
      );

      if (isMountedRef.current) {
        const newFeatures: FeatureAccessState = {};
        results.forEach(({ key, enabled }) => {
          newFeatures[key] = { enabled, loading: false };
        });
        setFeatures(newFeatures);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch feature access:', error);
      if (isMountedRef.current) {
        // Set all to enabled on error (backward compatibility)
        const errorFeatures: FeatureAccessState = {};
        FEATURE_KEYS.forEach((key) => {
          errorFeatures[key] = { enabled: true, loading: false };
        });
        setFeatures(errorFeatures);
        setLoading(false);
      }
    }
  }, [role, loading]);

  // Fetch features when role changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchAllFeatures();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchAllFeatures]);

  // Listen for cache clear events
  useEffect(() => {
    const handleCacheClear = () => {
      console.log('[FeatureAccessContext] Cache cleared, refreshing features');
      clearFeatureCache();
      fetchAllFeatures(true);
    };

    window.addEventListener('clearFeatureCache', handleCacheClear);
    return () => {
      window.removeEventListener('clearFeatureCache', handleCacheClear);
    };
  }, [fetchAllFeatures]);

  const refreshFeatures = useCallback(() => {
    clearFeatureCache();
    fetchAllFeatures(true);
  }, [fetchAllFeatures]);

  const getFeatureAccess = useCallback((featureKey: string) => {
    return features[featureKey] || { enabled: true, loading: false };
  }, [features]);

  const contextValue = useMemo(() => ({
    features,
    loading,
    refreshFeatures,
    getFeatureAccess,
  }), [features, loading, refreshFeatures, getFeatureAccess]);

  return (
    <FeatureAccessContext.Provider value={contextValue}>
      {children}
    </FeatureAccessContext.Provider>
  );
};

/**
 * Hook to access feature flags from context
 * This replaces individual useFeatureAccess calls to prevent hooks violations
 */
export function useFeatureAccessContext() {
  const context = useContext(FeatureAccessContext);
  if (!context) {
    throw new Error('useFeatureAccessContext must be used within a FeatureAccessProvider');
  }
  return context;
}

/**
 * Hook to check a single feature - returns the same interface as the old useFeatureAccess
 * This is a drop-in replacement that uses the context instead of making individual API calls
 *
 * IMPORTANT: This hook only calls useContext once - it doesn't call any other hooks.
 * The getFeatureAccess function is a plain function that reads from memoized state.
 */
export function useFeatureFlag(featureKey: string): { enabled: boolean; loading: boolean } {
  // Get the context value - this is the ONLY hook call
  const context = useContext(FeatureAccessContext);

  // Return default if context not available (shouldn't happen if provider is set up correctly)
  if (!context) {
    return { enabled: true, loading: true };
  }

  // Get the feature access from the memoized features object
  // This is NOT a hook call - it's just reading from the context value
  return context.features[featureKey] || { enabled: true, loading: false };
}

export { FeatureAccessContext };

/**
 * Wrapper component that connects FeatureAccessProvider to AuthContext
 */
export const FeatureAccessProviderWithAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // We'll get the user role from context in App.tsx and pass it down
  // This component is just for cases where you want automatic auth integration
  return <>{children}</>;
};
