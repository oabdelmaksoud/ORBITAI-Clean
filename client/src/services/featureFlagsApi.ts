/**
 * Feature Flags API Service
 * Frontend service for fetching and managing feature flags
 */

import { apiRequest } from './adminApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface FeatureFlag {
  id: string;
  featureKey: string;
  featureName: string;
  description: string;
  category: string;
  enabledRoles: string[];
  enabledEnvironments?: string[]; // Array of environments where feature is active: ['development', 'staging', 'production', 'test'] - if empty/null, active in all environments
  isActive: boolean;
  metadata?: {
    icon?: string;
    color?: string;
    requiresPlan?: string[];
    dependsOn?: string[];
  };
}

/**
 * Check if a feature is enabled for a specific role (public endpoint)
 */
export async function checkFeatureAccess(
  featureKey: string,
  role: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const normalizedRole = role.toLowerCase().trim();
    const normalizedKey = featureKey.toLowerCase().trim();

    // Create abort controller if not provided
    const controller = signal ? null : new AbortController();
    const timeoutId = setTimeout(() => controller?.abort(), 5000);

    // Add timestamp to prevent browser/CDN caching
    const timestamp = Date.now();
    const response = await fetch(
      `${API_BASE_URL}/api/admin/feature-flags/check/${normalizedKey}?role=${normalizedRole}&_t=${timestamp}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true' // Fix for localtunnel 511 error
        },
        cache: 'no-store',
        signal: signal || controller?.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // For rate limiting (429) or other temporary errors, default to enabled
      // This ensures features remain accessible during temporary API issues
      if (response.status === 429) {
        console.warn(`[Feature Flags] Rate limited for '${normalizedKey}' (role: ${normalizedRole}), defaulting to enabled`);
        return true;
      }
      // For 404 (feature not found), default to enabled (backward compatibility)
      if (response.status === 404) {
        if (import.meta.env.DEV) {
          console.debug(`[Feature Flags] Feature '${normalizedKey}' not found, defaulting to enabled`);
        }
        return true;
      }
      // For other errors, also default to enabled for backward compatibility
      console.warn(`[Feature Flags] API error (${response.status}) for '${normalizedKey}' (role: ${normalizedRole}), defaulting to enabled`);
      return true;
    }

    const data = await response.json();

    if (!data.success) {
      console.warn(`[Feature Flags] API returned success=false for '${normalizedKey}' (role: ${normalizedRole})`);
      return true; // Default to enabled
    }

    const enabled = data.data?.enabled ?? true;

    // Debug logging for superadmin to help diagnose issues
    if (import.meta.env.DEV && normalizedRole === 'superadmin') {
      console.log(`[Feature Flags] '${normalizedKey}' is ${enabled ? 'enabled' : 'disabled'} for role '${normalizedRole}'`, {
        enabled,
        enabledRoles: data.data?.enabledRoles,
        userRole: data.data?.userRole,
        isActive: data.data?.isActive,
        fullResponse: data.data
      });
    }

    return enabled;
  } catch (error: any) {
    // Handle abort/timeout errors gracefully
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      // Silent - timeout is expected in some cases
      return true;
    }

    // For connection errors (backend not running), suppress all logging
    const isConnectionError = error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('ERR_CONNECTION_REFUSED') ||
      error.name === 'TypeError' ||
      (error.message?.includes('fetch') && error.name === 'TypeError');

    if (isConnectionError) {
      // Completely silent - backend is not running, this is expected
      // Don't log anything, just default to enabled
      return true;
    }

    // Only log non-connection errors in dev mode
    if (import.meta.env.DEV) {
      console.debug(`[Feature Flags] Failed to check '${featureKey}' (role: ${role}):`, error.message);
    }

    // Default to enabled on error for backward compatibility
    return true;
  }
}

/**
 * Check feature flags health
 */
export async function checkFeatureFlagsHealth(): Promise<{
  healthy: boolean;
  database: {
    connected: boolean;
    totalFlags?: number;
    activeFlags?: number;
  };
  responseTime?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();
    const response = await fetch(
      `${API_BASE_URL}/api/admin/feature-flags/health`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        healthy: false,
        database: {
          connected: false
        },
        responseTime,
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json();
    return {
      healthy: data.success && data.data.healthy,
      database: data.data.database || { connected: false },
      responseTime
    };
  } catch (error: any) {
    return {
      healthy: false,
      database: {
        connected: false
      },
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Verify all feature flags for a role
 */
export async function verifyFeatureFlagsForRole(role: string): Promise<{
  role: string;
  totalFlags: number;
  results: Array<{
    featureKey: string;
    featureName: string;
    enabled: boolean;
    hasAccess: boolean;
  }>;
}> {
  try {
    const normalizedRole = role.toLowerCase().trim();
    const response = await fetch(
      `${API_BASE_URL}/api/admin/feature-flags/verify/${normalizedRole}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error: any) {
    throw new Error(`Failed to verify feature flags: ${error.message}`);
  }
}

/**
 * Get all feature flags (admin only)
 */
export async function getFeatureFlags(token: string): Promise<FeatureFlag[]> {
  const response = await apiRequest<{
    success: boolean;
    data: { flags: FeatureFlag[] };
  }>('/api/admin/feature-flags', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch feature flags');
  }

  return response.data.flags;
}

/**
 * Get a specific feature flag by key (admin only)
 */
export async function getFeatureFlag(
  token: string,
  featureKey: string
): Promise<FeatureFlag | null> {
  try {
    const response = await apiRequest<{
      success: boolean;
      data: { flag: FeatureFlag };
    }>(`/api/admin/feature-flags/${featureKey}`, {
      method: 'GET',
    }, token);

    if (!response.success) {
      return null;
    }

    return response.data.flag;
  } catch (error) {
    console.error(`Failed to fetch feature flag '${featureKey}':`, error);
    return null;
  }
}

/**
 * Create a new feature flag (admin only)
 */
export async function createFeatureFlag(
  token: string,
  flagData: Partial<FeatureFlag>
): Promise<FeatureFlag> {
  const response = await apiRequest<{
    success: boolean;
    data: { flag: FeatureFlag };
  }>('/api/admin/feature-flags', {
    method: 'POST',
    body: JSON.stringify(flagData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create feature flag');
  }

  return response.data.flag;
}

/**
 * Update a feature flag (admin only)
 */
export async function updateFeatureFlag(
  token: string,
  featureKey: string,
  updates: Partial<FeatureFlag>
): Promise<FeatureFlag> {
  const response = await apiRequest<{
    success: boolean;
    data: { flag: FeatureFlag };
  }>(`/api/admin/feature-flags/${featureKey}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update feature flag');
  }

  return response.data.flag;
}

/**
 * Delete a feature flag (admin only)
 */
export async function deleteFeatureFlag(
  token: string,
  featureKey: string
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/admin/feature-flags/${featureKey}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete feature flag');
  }
}
