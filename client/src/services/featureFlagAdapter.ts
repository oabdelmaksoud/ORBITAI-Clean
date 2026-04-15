/**
 * Feature Flag Adapter
 * Provides a unified interface for different feature flag providers
 * Currently supports: custom (database), flagsmith, and hybrid modes
 */

interface FeatureFlagAdapterConfig {
  providerType: 'custom' | 'flagsmith' | 'hybrid';
  flagsmith?: {
    environmentId?: string;
    apiUrl?: string;
  };
}

let adapterInitialized = false;

/**
 * Initialize the feature flag adapter
 * @param config Configuration for the adapter
 */
export async function initializeFeatureFlags(config: FeatureFlagAdapterConfig): Promise<void> {
  try {
    if (adapterInitialized) {
      if (import.meta.env.DEV) {
        // Debug: Reduced console noise
        // console.log('[Feature Flags] Adapter already initialized');
      }
      return;
    }

    const { providerType, flagsmith } = config;

    // Debug: Reduced console noise
    // if (import.meta.env.DEV) {
    //   console.log('[Feature Flags] Initializing adapter:', {
    //     providerType,
    //     flagsmithConfigured: !!flagsmith?.environmentId
    //   });
    // }

    // Custom provider (database-based) - already handled by featureFlagsApi
    if (providerType === 'custom') {
      // No additional initialization needed - using database feature flags
      // Debug: Reduced console noise
      // if (import.meta.env.DEV) {
      //   console.log('[Feature Flags] Using custom (database) provider');
      // }
    }
    // Flagsmith provider - would require flagsmith SDK
    else if (providerType === 'flagsmith') {
      if (import.meta.env.DEV) {
        console.log('[Feature Flags] Flagsmith provider selected but not fully implemented');
        console.warn('[Feature Flags] Falling back to custom (database) provider');
      }
      // TODO: Initialize Flagsmith SDK if needed
      // const flagsmith = Flagsmith.init({ environmentID: flagsmith?.environmentId });
    }
    // Hybrid mode - use both
    else if (providerType === 'hybrid') {
      if (import.meta.env.DEV) {
        console.log('[Feature Flags] Hybrid mode selected but not fully implemented');
        console.warn('[Feature Flags] Using custom (database) provider only');
      }
      // TODO: Initialize both providers if needed
    }

    adapterInitialized = true;

    if (import.meta.env.DEV) {
      // Debug: Reduced console noise
      // console.log('[Feature Flags] Adapter initialized successfully');
    }
  } catch (error) {
    console.error('[Feature Flags] Failed to initialize adapter:', error);
    // Don't throw - allow app to continue with default behavior
  }
}

/**
 * Check if adapter is initialized
 */
export function isAdapterInitialized(): boolean {
  return adapterInitialized;
}

/**
 * Reset adapter (useful for testing)
 */
export function resetAdapter(): void {
  adapterInitialized = false;
}


