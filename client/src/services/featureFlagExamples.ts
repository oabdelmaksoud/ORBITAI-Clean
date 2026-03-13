/**
 * Real-World Feature Flag Examples
 * Practical implementations of A/B testing and gradual rollouts
 */

import { 
  featureFlagService, 
  FeatureFlagUser,
  RolloutConfig,
  ABTestConfig 
} from './featureFlagAdapter';

// ==================== A/B Testing Examples ====================

/**
 * Example 1: A/B Test for New Project Creation UI
 */
export async function getProjectCreationUIVariant(user: FeatureFlagUser): Promise<string> {
  const config: ABTestConfig = {
    variants: [
      { name: 'control', percentage: 50 },      // 50% see old UI
      { name: 'wizard', percentage: 30 },      // 30% see wizard UI
      { name: 'quick_start', percentage: 20 }  // 20% see quick start UI
    ],
    targetRoles: ['user', 'admin', 'superadmin'],
    targetPlans: ['starter', 'pro', 'enterprise']
  };

  return await featureFlagService.getABTestVariant('project_creation_ui', user, config);
}

/**
 * Example 2: A/B Test for Dashboard Layout
 */
export async function getDashboardLayoutVariant(user: FeatureFlagUser): Promise<string> {
  const config: ABTestConfig = {
    variants: [
      { name: 'classic', percentage: 40 },
      { name: 'modern', percentage: 40 },
      { name: 'compact', percentage: 20 }
    ],
    targetRoles: ['admin', 'superadmin']
  };

  return await featureFlagService.getABTestVariant('dashboard_layout', user, config);
}

/**
 * Example 3: A/B Test for AI Chat Interface
 */
export async function getAIChatUIVariant(user: FeatureFlagUser): Promise<string> {
  const config: ABTestConfig = {
    variants: [
      { name: 'standard', percentage: 60 },
      { name: 'enhanced', percentage: 40 }
    ],
    targetPlans: ['pro', 'enterprise']
  };

  return await featureFlagService.getABTestVariant('ai_chat_ui', user, config);
}

// ==================== Gradual Rollout Examples ====================

/**
 * Example 1: Gradual Rollout for New Code Editor
 */
export async function checkNewCodeEditorRollout(
  user: FeatureFlagUser,
  rolloutPercentage: number = 25
): Promise<boolean> {
  const config: RolloutConfig = {
    percentage: rolloutPercentage,
    targetRoles: ['admin', 'superadmin'],
    targetPlans: ['pro', 'enterprise'],
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31')
  };

  const result = await featureFlagService.isEnabledWithRollout(
    'new_code_editor',
    user,
    config
  );

  return result.enabled;
}

/**
 * Example 2: Gradual Rollout for Beta Features
 */
export async function checkBetaFeatureAccess(
  user: FeatureFlagUser,
  featureKey: string,
  percentage: number = 10
): Promise<boolean> {
  const config: RolloutConfig = {
    percentage,
    targetRoles: ['admin', 'superadmin'],
    targetPlans: ['enterprise']
  };

  const result = await featureFlagService.isEnabledWithRollout(
    featureKey,
    user,
    config
  );

  return result.enabled;
}

/**
 * Example 3: Time-Based Gradual Rollout
 */
export async function checkTimeBasedRollout(
  user: FeatureFlagUser,
  featureKey: string,
  startDate: Date,
  endDate: Date,
  percentage: number = 50
): Promise<boolean> {
  const config: RolloutConfig = {
    percentage,
    startDate,
    endDate,
    targetRoles: ['user', 'admin', 'superadmin']
  };

  const result = await featureFlagService.isEnabledWithRollout(
    featureKey,
    user,
    config
  );

  return result.enabled;
}

// ==================== Multi-Provider Examples ====================

/**
 * Example: Check feature with provider fallback
 */
export async function checkFeatureWithFallback(
  featureKey: string,
  user: FeatureFlagUser
): Promise<{ enabled: boolean; source: string }> {
  const result = await featureFlagService.isEnabled(featureKey, user);
  
  return {
    enabled: result.enabled,
    source: result.source || 'custom'
  };
}

/**
 * Example: Get all features for a user (multi-provider)
 */
export async function getAllUserFeatures(user: FeatureFlagUser): Promise<Record<string, {
  enabled: boolean;
  source: string;
}>> {
  const flags = await featureFlagService.getAllFlags(user);
  
  const result: Record<string, { enabled: boolean; source: string }> = {};
  
  Object.keys(flags).forEach(key => {
    result[key] = {
      enabled: flags[key].enabled,
      source: flags[key].source || 'custom'
    };
  });
  
  return result;
}

// ==================== Advanced Examples ====================

/**
 * Example: A/B Test with Gradual Rollout
 * First check if feature is rolled out, then assign variant
 */
export async function getAdvancedFeatureVariant(
  user: FeatureFlagUser,
  featureKey: string,
  rolloutPercentage: number = 50
): Promise<{ enabled: boolean; variant: string | null }> {
  // First check rollout
  const rolloutConfig: RolloutConfig = {
    percentage: rolloutPercentage,
    targetRoles: ['user', 'admin', 'superadmin']
  };

  const rolloutResult = await featureFlagService.isEnabledWithRollout(
    featureKey,
    user,
    rolloutConfig
  );

  if (!rolloutResult.enabled) {
    return { enabled: false, variant: null };
  }

  // If rolled out, assign A/B test variant
  const abTestConfig: ABTestConfig = {
    variants: [
      { name: 'control', percentage: 50 },
      { name: 'variant_a', percentage: 50 }
    ]
  };

  const variant = await featureFlagService.getABTestVariant(
    `${featureKey}_variant`,
    user,
    abTestConfig
  );

  return { enabled: true, variant };
}

/**
 * Example: Plan-Based Feature Access with Rollout
 */
export async function checkPlanBasedFeature(
  user: FeatureFlagUser,
  featureKey: string,
  requiredPlans: string[],
  rolloutPercentage: number = 100
): Promise<boolean> {
  const config: RolloutConfig = {
    percentage: rolloutPercentage,
    targetPlans: requiredPlans
  };

  const result = await featureFlagService.isEnabledWithRollout(
    featureKey,
    user,
    config
  );

  return result.enabled;
}

