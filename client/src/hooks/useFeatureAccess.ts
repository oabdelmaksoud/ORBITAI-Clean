import { useState, useEffect, useRef, useMemo } from 'react';
import { hasFeatureAccess } from '../services/featureAccess';

/**
 * React hook to check feature access for the current user
 * @param featureKey The feature key to check
 * @param userRole The user's role (optional, defaults to 'public' if not provided)
 * @returns Object with `enabled` (boolean) and `loading` (boolean) properties
 */
export function useFeatureAccess(
  featureKey: string,
  userRole?: string
): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const isCheckingRef = useRef<boolean>(false);
  
  // Memoize role to prevent unnecessary re-renders
  const role = useMemo(() => userRole || 'public', [userRole]);

  useEffect(() => {
    let mounted = true;
    
    const checkAccess = async (bypassCache = false) => {
      // Prevent concurrent checks, but allow if cache was cleared
      if (isCheckingRef.current && !bypassCache) {
        // Wait a bit and retry if cache was cleared
        await new Promise(resolve => setTimeout(resolve, 50));
        if (!mounted) return;
      }
      isCheckingRef.current = true;
      
      setLoading(true);
      try {
        // Bypass cache when explicitly requested (e.g., after cache clear)
        const hasAccess = await hasFeatureAccess(featureKey, role, !bypassCache);
        if (mounted) {
          setEnabled(hasAccess);
          if (import.meta.env.DEV) {
            console.log(`[useFeatureAccess] '${featureKey}' (role: ${role}): ${hasAccess ? 'enabled' : 'disabled'}`);
          }
        }
      } catch (error) {
        console.error(`Failed to check feature access for '${featureKey}':`, error);
        // Default to enabled on error for backward compatibility
        if (mounted) {
          setEnabled(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
        isCheckingRef.current = false;
      }
    };

    checkAccess();

    // Listen for cache clear events to re-check access
    const handleCacheClear = () => {
      if (mounted) {
        // Force immediate re-check when cache is cleared (bypass cache)
        console.log(`[useFeatureAccess] Cache cleared, re-checking '${featureKey}' for role '${role}'`);
        // Reset checking flag to allow immediate re-check
        isCheckingRef.current = false;
        checkAccess(true); // Pass true to bypass cache
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('clearFeatureCache', handleCacheClear);
    }

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('clearFeatureCache', handleCacheClear);
      }
    };
  }, [featureKey, role]);

  return { enabled, loading };
}

/**
 * Trigger a refresh of all useFeatureAccess hooks
 * This dispatches an event that all active hooks are listening to
 */
export function triggerFeatureRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('clearFeatureCache'));
  }
}
