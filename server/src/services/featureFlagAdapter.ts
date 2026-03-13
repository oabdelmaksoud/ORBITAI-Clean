/**
 * Backend Feature Flag Adapter Layer
 * Supports multiple feature flag providers with a unified interface
 */

import { FeatureFlag } from '../models/FeatureFlag.model.js';
import { isFeatureEnabled } from './featureFlags.service.js';
import { logger } from '../utils/logger.js';

// ==================== Interfaces ====================

export interface FeatureFlagUser {
  id: string;
  email?: string;
  role?: string;
  plan?: string;
  attributes?: Record<string, any>;
}

export interface FeatureFlagResult {
  enabled: boolean;
  value?: any;
  source?: 'custom' | 'flagsmith' | 'launchdarkly' | 'unleash';
}

export interface RolloutConfig {
  percentage?: number;
  targetRoles?: string[];
  targetPlans?: string[];
  targetAttributes?: Record<string, any>;
  startDate?: Date;
  endDate?: Date;
}

export interface ABTestConfig {
  variants: Array<{
    name: string;
    percentage: number;
    value?: any;
  }>;
  targetRoles?: string[];
  targetPlans?: string[];
}

export interface IFeatureFlagProvider {
  isEnabled(featureKey: string, user: FeatureFlagUser): Promise<FeatureFlagResult>;
  getValue(featureKey: string, user: FeatureFlagUser): Promise<any>;
  getAllFlags(user: FeatureFlagUser): Promise<Record<string, FeatureFlagResult>>;
  initialize(): Promise<void>;
}

// ==================== Custom Provider (Existing System) ====================

export class CustomFeatureFlagProvider implements IFeatureFlagProvider {
  async isEnabled(featureKey: string, user: FeatureFlagUser): Promise<FeatureFlagResult> {
    const role = user.role || 'public';
    const enabled = await isFeatureEnabled(featureKey, role);
    
    return {
      enabled,
      source: 'custom'
    };
  }

  async getValue(featureKey: string, user: FeatureFlagUser): Promise<any> {
    const result = await this.isEnabled(featureKey, user);
    return result.enabled ? true : false;
  }

  async getAllFlags(user: FeatureFlagUser): Promise<Record<string, FeatureFlagResult>> {
    try {
      const role = user.role || 'public';
      const flags = await FeatureFlag.find({ isActive: true }).lean();
      
      const result: Record<string, FeatureFlagResult> = {};
      
      for (const flag of flags) {
        const normalizedRole = role.toLowerCase().trim();
        const enabled = flag.enabledRoles?.some(r => r.toLowerCase().trim() === normalizedRole) || false;
        
        result[flag.featureKey] = {
          enabled: enabled && flag.isActive,
          source: 'custom'
        };
      }
      
      return result;
    } catch (error) {
      logger.error('[Custom Provider] Error getting all flags:', error);
      return {};
    }
  }

  async initialize(): Promise<void> {
    return Promise.resolve();
  }
}

// ==================== Flagsmith Provider ====================

let flagsmithClient: any = null;

export class FlagsmithProvider implements IFeatureFlagProvider {
  private environmentId: string;
  private apiUrl?: string;
  private apiKey?: string;
  private initialized: boolean = false;

  constructor(environmentId: string, apiKey?: string, apiUrl?: string) {
    this.environmentId = environmentId;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const flagsmith = await import('flagsmith');
      flagsmithClient = flagsmith.default || flagsmith;
      
      // For server-side, use API key if available
      if (this.apiKey) {
        flagsmithClient.init({
          environmentID: this.environmentId,
          apiKey: this.apiKey,
          api: this.apiUrl || 'https://api.flagsmith.com/api/v1/',
          enableAnalytics: true
        });
      } else {
        // Client-side initialization (for SSR)
        flagsmithClient.init({
          environmentID: this.environmentId,
          api: this.apiUrl || 'https://api.flagsmith.com/api/v1/',
          enableAnalytics: true
        });
      }

      this.initialized = true;
      logger.info('[Flagsmith] Provider initialized');
    } catch (error) {
      logger.error('[Flagsmith] Failed to initialize:', error);
      throw error;
    }
  }

  async isEnabled(featureKey: string, user: FeatureFlagUser): Promise<FeatureFlagResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const identity = user.id || user.email || 'anonymous';
      const traits: Record<string, any> = {};
      
      if (user.role) traits.role = user.role;
      if (user.plan) traits.plan = user.plan;
      if (user.attributes) {
        Object.assign(traits, user.attributes);
      }

      if (this.apiKey) {
        // Server-side API call
        const flags = await flagsmithClient.getIdentityFlags(identity, traits);
        const flag = flags.find((f: any) => f.feature.name === featureKey);
        
        return {
          enabled: flag?.enabled || false,
          value: flag?.feature_state_value,
          source: 'flagsmith'
        };
      } else {
        // Client-side check
        await flagsmithClient.getIdentityFlags(identity, traits);
        const enabled = flagsmithClient.hasFeature(featureKey);
        const value = flagsmithClient.getValue(featureKey);

        return {
          enabled: enabled || false,
          value: value !== null ? value : enabled,
          source: 'flagsmith'
        };
      }
    } catch (error) {
      logger.error(`[Flagsmith] Error checking feature '${featureKey}':`, error);
      return {
        enabled: false,
        source: 'flagsmith'
      };
    }
  }

  async getValue(featureKey: string, user: FeatureFlagUser): Promise<any> {
    const result = await this.isEnabled(featureKey, user);
    return result.value;
  }

  async getAllFlags(user: FeatureFlagUser): Promise<Record<string, FeatureFlagResult>> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const identity = user.id || user.email || 'anonymous';
      const traits: Record<string, any> = {};
      
      if (user.role) traits.role = user.role;
      if (user.plan) traits.plan = user.plan;
      if (user.attributes) {
        Object.assign(traits, user.attributes);
      }

      if (this.apiKey) {
        const flags = await flagsmithClient.getIdentityFlags(identity, traits);
        const result: Record<string, FeatureFlagResult> = {};
        
        flags.forEach((flag: any) => {
          result[flag.feature.name] = {
            enabled: flag.enabled || false,
            value: flag.feature_state_value,
            source: 'flagsmith'
          };
        });
        
        return result;
      } else {
        await flagsmithClient.getIdentityFlags(identity, traits);
        const flags = flagsmithClient.getAllFlags();
        const result: Record<string, FeatureFlagResult> = {};
        
        Object.keys(flags).forEach(key => {
          result[key] = {
            enabled: flagsmithClient.hasFeature(key),
            value: flagsmithClient.getValue(key),
            source: 'flagsmith'
          };
        });

        return result;
      }
    } catch (error) {
      logger.error('[Flagsmith] Error getting all flags:', error);
      return {};
    }
  }
}

// ==================== Unified Feature Flag Service ====================

export type ProviderType = 'custom' | 'flagsmith' | 'hybrid';

class UnifiedFeatureFlagService {
  private providers: Map<string, IFeatureFlagProvider> = new Map();
  private primaryProvider: IFeatureFlagProvider;
  private fallbackProvider: IFeatureFlagProvider;
  private providerType: ProviderType = 'custom';

  constructor() {
    const customProvider = new CustomFeatureFlagProvider();
    this.providers.set('custom', customProvider);
    this.primaryProvider = customProvider;
    this.fallbackProvider = customProvider;
  }

  async configure(config: {
    providerType: ProviderType;
    flagsmith?: {
      environmentId: string;
      apiKey?: string;
      apiUrl?: string;
    };
  }): Promise<void> {
    this.providerType = config.providerType;

    if (config.providerType === 'flagsmith' || config.providerType === 'hybrid') {
      if (!config.flagsmith?.environmentId) {
        logger.warn('[Feature Flags] Flagsmith environment ID not provided, using custom provider only');
        return;
      }

      const flagsmithProvider = new FlagsmithProvider(
        config.flagsmith.environmentId,
        config.flagsmith.apiKey,
        config.flagsmith.apiUrl
      );
      
      await flagsmithProvider.initialize();
      this.providers.set('flagsmith', flagsmithProvider);

      if (config.providerType === 'flagsmith') {
        this.primaryProvider = flagsmithProvider;
      } else if (config.providerType === 'hybrid') {
        this.primaryProvider = flagsmithProvider;
        this.fallbackProvider = this.providers.get('custom')!;
      }
    }
  }

  async isEnabled(featureKey: string, user: FeatureFlagUser): Promise<FeatureFlagResult> {
    try {
      const result = await this.primaryProvider.isEnabled(featureKey, user);
      
      if (this.providerType === 'hybrid' && result.source === 'flagsmith' && !result.enabled) {
        const customResult = await this.fallbackProvider.isEnabled(featureKey, user);
        if (customResult.enabled) {
          return customResult;
        }
      }
      
      return result;
    } catch (error) {
      logger.error(`[Feature Flags] Error checking '${featureKey}', falling back:`, error);
      return await this.fallbackProvider.isEnabled(featureKey, user);
    }
  }

  async getValue(featureKey: string, user: FeatureFlagUser): Promise<any> {
    try {
      return await this.primaryProvider.getValue(featureKey, user);
    } catch (error) {
      logger.error(`[Feature Flags] Error getting value for '${featureKey}', falling back:`, error);
      return await this.fallbackProvider.getValue(featureKey, user);
    }
  }

  async getAllFlags(user: FeatureFlagUser): Promise<Record<string, FeatureFlagResult>> {
    try {
      if (this.providerType === 'hybrid') {
        const [primaryFlags, fallbackFlags] = await Promise.all([
          this.primaryProvider.getAllFlags(user),
          this.fallbackProvider.getAllFlags(user)
        ]);
        
        return { ...fallbackFlags, ...primaryFlags };
      }
      
      return await this.primaryProvider.getAllFlags(user);
    } catch (error) {
      logger.error('[Feature Flags] Error getting all flags, falling back:', error);
      return await this.fallbackProvider.getAllFlags(user);
    }
  }

  async isEnabledWithRollout(
    featureKey: string,
    user: FeatureFlagUser,
    config: RolloutConfig
  ): Promise<FeatureFlagResult> {
    const baseResult = await this.isEnabled(featureKey, user);
    
    if (!baseResult.enabled) {
      return baseResult;
    }

    if (config.percentage !== undefined) {
      const userHash = this.hashUser(user.id || user.email || 'anonymous');
      const userPercentage = userHash % 100;
      
      if (userPercentage >= config.percentage) {
        return {
          enabled: false,
          source: baseResult.source
        };
      }
    }

    if (config.targetRoles && user.role) {
      if (!config.targetRoles.includes(user.role.toLowerCase())) {
        return {
          enabled: false,
          source: baseResult.source
        };
      }
    }

    if (config.targetPlans && user.plan) {
      if (!config.targetPlans.includes(user.plan)) {
        return {
          enabled: false,
          source: baseResult.source
        };
      }
    }

    if (config.startDate && new Date() < config.startDate) {
      return {
        enabled: false,
        source: baseResult.source
      };
    }

    if (config.endDate && new Date() > config.endDate) {
      return {
        enabled: false,
        source: baseResult.source
      };
    }

    return baseResult;
  }

  async getABTestVariant(
    featureKey: string,
    user: FeatureFlagUser,
    config: ABTestConfig
  ): Promise<string> {
    if (config.targetRoles && user.role) {
      if (!config.targetRoles.includes(user.role.toLowerCase())) {
        return 'control';
      }
    }

    if (config.targetPlans && user.plan) {
      if (!config.targetPlans.includes(user.plan)) {
        return 'control';
      }
    }

    const userHash = this.hashUser(user.id || user.email || 'anonymous');
    const hashValue = userHash % 100;

    let cumulative = 0;
    for (const variant of config.variants) {
      cumulative += variant.percentage;
      if (hashValue < cumulative) {
        return variant.name;
      }
    }

    return config.variants[0]?.name || 'control';
  }

  private hashUser(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export const featureFlagService = new UnifiedFeatureFlagService();

export async function initializeFeatureFlags(config?: {
  providerType?: ProviderType;
  flagsmith?: {
    environmentId: string;
    apiKey?: string;
    apiUrl?: string;
  };
}): Promise<void> {
  const providerType = config?.providerType || (process.env.FEATURE_FLAG_PROVIDER as ProviderType) || 'custom';
  
  await featureFlagService.configure({
    providerType,
    flagsmith: config?.flagsmith || {
      environmentId: process.env.FLAGSMITH_ENVIRONMENT_ID || '',
      apiKey: process.env.FLAGSMITH_API_KEY,
      apiUrl: process.env.FLAGSMITH_API_URL
    }
  });
}

