/**
 * Feature Flag Adapter
 * Provides a unified interface for different feature flag providers
 * Currently supports: custom (database), flagsmith, and hybrid modes
 */

export interface FeatureFlagUser {
  id: string;
  email?: string;
  role?: string;
  plan?: string;
  [key: string]: unknown;
}

interface FeatureFlagResult {
  enabled: boolean;
  source: string;
}

interface RolloutOptions {
  percentage: number;
  targetRoles?: string[];
}

interface ABTestConfig {
  variants: Array<{ name: string; percentage: number }>;
  targetRoles?: string[];
}

interface FeatureFlagAdapterConfig {
  providerType: 'custom' | 'flagsmith' | 'hybrid';
  flagsmith?: {
    environmentId?: string;
    apiUrl?: string;
  };
}

/**
 * Custom Feature Flag Provider
 * Uses local configuration to evaluate feature flags
 */
export class CustomFeatureFlagProvider {
  private readonly featureConfig: Record<string, { enabled: boolean; roles?: string[] }> = {
    project_creation: { enabled: true, roles: ['admin', 'user'] },
    advanced_analytics: { enabled: true, roles: ['admin'] },
    collaboration: { enabled: true },
  };

  async initialize(): Promise<void> {
    // No external dependencies needed
  }

  async isEnabled(
    featureName: string,
    user: Partial<FeatureFlagUser>
  ): Promise<FeatureFlagResult> {
    const config = this.featureConfig[featureName];
    if (!config) {
      return { enabled: false, source: 'custom' };
    }

    if (config.roles && user.role) {
      return {
        enabled: config.roles.includes(user.role),
        source: 'custom',
      };
    }

    return { enabled: config.enabled, source: 'custom' };
  }
}

/**
 * Unified Feature Flag Service
 */
class FeatureFlagService {
  private readonly provider: CustomFeatureFlagProvider;

  constructor() {
    this.provider = new CustomFeatureFlagProvider();
  }

  async isEnabled(
    featureName: string,
    user: Partial<FeatureFlagUser>
  ): Promise<FeatureFlagResult> {
    return this.provider.isEnabled(featureName, user);
  }

  async isEnabledWithRollout(
    featureName: string,
    user: FeatureFlagUser,
    options: RolloutOptions
  ): Promise<FeatureFlagResult> {
    if (options.percentage <= 0) {
      return { enabled: false, source: 'custom' };
    }

    if (options.targetRoles && user.role && !options.targetRoles.includes(user.role)) {
      return { enabled: false, source: 'custom' };
    }

    if (options.percentage >= 100) {
      return this.provider.isEnabled(featureName, user);
    }

    // Hash-based rollout
    const hash = this.hashString(`${featureName}:${user.id}`);
    const bucket = hash % 100;
    const enabled = bucket < options.percentage;
    return { enabled, source: 'custom' };
  }

  async getABTestVariant(
    featureName: string,
    user: FeatureFlagUser,
    config: ABTestConfig
  ): Promise<string> {
    // If user role is not in target roles, return control
    if (config.targetRoles && user.role && !config.targetRoles.includes(user.role)) {
      return 'control';
    }

    const hash = this.hashString(`${featureName}:${user.id}`);
    const bucket = hash % 100;

    let cumulative = 0;
    for (const variant of config.variants) {
      cumulative += variant.percentage;
      if (bucket < cumulative) {
        return variant.name;
      }
    }

    return config.variants[config.variants.length - 1]?.name ?? 'control';
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const featureFlagService = new FeatureFlagService();

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


