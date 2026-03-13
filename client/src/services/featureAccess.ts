/**
 * Feature Access Helper
 * Client-side utility to check feature access based on user role
 */

import { checkFeatureAccess } from './featureFlagsApi';

// Cache for feature access checks to avoid repeated API calls
const featureCache: Map<string, { enabled: boolean; timestamp: number; cacheVersion: number }> = new Map();
// Cache version to invalidate all cache when feature flags are updated
let cacheVersion = 0;
// Global flag to force bypass cache (set when flags are updated)
let forceBypassCache = false;
// Cache duration - increased to reduce API calls on initial page load
// Cache is also invalidated via WebSocket broadcasts when flags change
const CACHE_DURATION = 5 * 1000; // 5 second cache duration - reduces rapid-fire API calls on page load

// Pending requests map to batch/debounce simultaneous requests for the same feature
const pendingRequests: Map<string, Promise<boolean>> = new Map();

// Global event for cache clearing
if (typeof window !== 'undefined') {
  window.addEventListener('clearFeatureCache', () => {
    cacheVersion++;
    featureCache.clear();
  });
}

/**
 * Check if a feature is enabled for the current user's role
 * @param featureKey The feature key to check
 * @param userRole The user's role. Use 'public' when user is not signed in (user === null/undefined)
 * @param useCache Whether to use cached results (default: true)
 */
export async function hasFeatureAccess(
  featureKey: string,
  userRole: string,
  useCache: boolean = true
): Promise<boolean> {
  // Normalize role for consistent caching
  const normalizedRole = userRole.toLowerCase().trim();
  const cacheKey = `${featureKey}:${normalizedRole}`;

  // Superadmin always has full access - bypass API check entirely
  if (normalizedRole === 'superadmin' || normalizedRole === 'superuser' || normalizedRole === 'super user') {
    if (import.meta.env.DEV) {
      console.log(`[Feature Access] Superadmin bypass for '${featureKey}'`);
    }
    return true;
  }

  // If force bypass is set, always fetch fresh (but reset flag after first use)
  const shouldBypassCache = forceBypassCache;
  if (forceBypassCache) {
    forceBypassCache = false; // Reset after one use
    if (import.meta.env.DEV) {
      console.log(`[Feature Access] Bypassing cache for '${featureKey}' (role: ${normalizedRole}) - force refresh`);
    }
  }

  // Check cache first (but only if cache version matches, hasn't expired, and not bypassing)
  if (useCache && !shouldBypassCache) {
    const cached = featureCache.get(cacheKey);

    if (cached &&
      cached.cacheVersion === cacheVersion &&
      Date.now() - cached.timestamp < CACHE_DURATION) {
      // Return cached value
      if (import.meta.env.DEV) {
        console.debug(`[Feature Access] Using cached value for '${featureKey}' (role: ${normalizedRole}):`, cached.enabled);
      }
      return cached.enabled;
    } else if (cached) {
      // Cache version mismatch or expired - log and fetch fresh
      if (import.meta.env.DEV) {
        console.log(`[Feature Access] Cache invalid for '${featureKey}' (role: ${normalizedRole}) - version mismatch or expired`);
      }
    }
  }

  // Check if there's already a pending request for this feature+role combination
  // This prevents multiple simultaneous requests for the same feature
  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) {
    // Silently reuse pending request to reduce console noise
    return pendingRequest;
  }

  // Create new request and store it
  const requestPromise = (async () => {
    try {
      // Fetch from API - checks database feature flags
      const enabled = await checkFeatureAccess(featureKey, normalizedRole);

      // Update cache with current version
      if (useCache) {
        featureCache.set(cacheKey, {
          enabled,
          timestamp: Date.now(),
          cacheVersion: cacheVersion
        });
      }

      return enabled;
    } catch (error: any) {
      console.error(`[Feature Access] Failed to check '${featureKey}' for role '${normalizedRole}':`, error);

      // Try to use cached value as fallback if available (even if expired)
      const cached = featureCache.get(cacheKey);
      if (cached) {
        console.warn(`[Feature Access] Using cached value for '${featureKey}' due to API error`);
        return cached.enabled;
      }

      // Default to enabled on error for backward compatibility
      // This ensures features remain accessible during temporary API issues
      return true;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();

  // Store pending request
  pendingRequests.set(cacheKey, requestPromise);

  return requestPromise;
}

/**
 * Clear the feature access cache
 */
export function clearFeatureCache(): void {
  cacheVersion++;
  featureCache.clear();
  // Also clear pending requests to force fresh API calls
  pendingRequests.clear();
  // Set flag to bypass cache on next check
  forceBypassCache = true;
  if (import.meta.env.DEV) {
    console.log('[Feature Access] Cache cleared, new version:', cacheVersion, 'pending requests cleared, force bypass enabled');
  }
}

/**
 * Clear cache for a specific feature key (for all roles)
 */
export function clearFeatureCacheForKey(featureKey: string): void {
  cacheVersion++;
  const keysToDelete: string[] = [];
  for (const key of featureCache.keys()) {
    if (key.startsWith(`${featureKey}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => {
    featureCache.delete(key);
    // Also clear any pending requests for this feature
    pendingRequests.delete(key);
  });
  // Set flag to bypass cache on next check
  forceBypassCache = true;
  if (import.meta.env.DEV) {
    console.log('[Feature Access] Cache cleared for feature:', featureKey, 'new version:', cacheVersion, 'pending requests cleared, force bypass enabled');
  }
}

/**
 * Clear cache for a specific feature and role
 */
export function clearFeatureCacheForRole(featureKey: string, userRole: string): void {
  const cacheKey = `${featureKey}:${userRole}`;
  featureCache.delete(cacheKey);
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
  entries: Array<{ key: string; enabled: boolean; age: number }>;
} {
  const keys = Array.from(featureCache.keys());
  const entries = keys.map(key => {
    const cached = featureCache.get(key);
    return {
      key,
      enabled: cached?.enabled ?? false,
      age: cached ? Date.now() - cached.timestamp : 0
    };
  });

  return {
    size: featureCache.size,
    keys,
    entries
  };
}

/**
 * Get cached feature access status synchronously
 * Note: This is NOT a React hook - use the useFeatureAccess hook from hooks/useFeatureAccess.ts for React components
 * This function is for non-React contexts where you need synchronous access to cached values
 */
export function getCachedFeatureAccess(
  featureKey: string,
  userRole: string | undefined
): boolean {
  // Default to enabled if no role (backward compatibility)
  if (!userRole) {
    return true;
  }

  // Superadmin always has access
  const normalizedRole = userRole.toLowerCase().trim();
  if (normalizedRole === 'superadmin' || normalizedRole === 'superuser' || normalizedRole === 'super user') {
    return true;
  }

  // For synchronous access, use cached values
  const cacheKey = `${featureKey}:${userRole.toLowerCase().trim()}`;
  const cached = featureCache.get(cacheKey);

  return cached?.enabled ?? true; // Default to enabled
}
