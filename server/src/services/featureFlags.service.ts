import { FeatureFlag } from '../models/FeatureFlag.model.js';
import { logger } from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Get current environment
 */
function getCurrentEnvironment(): string {
  const env = config.nodeEnv || process.env.NODE_ENV || 'development';
  // Normalize environment names
  if (env === 'prod' || env === 'production') return 'production';
  if (env === 'stage' || env === 'staging') return 'staging';
  if (env === 'dev' || env === 'development') return 'development';
  if (env === 'test' || env === 'testing') return 'test';
  return env.toLowerCase();
}

/**
 * Check if a feature is enabled for a specific user role
 * Checks: isActive, enabledEnvironments, and enabledRoles
 */
export async function isFeatureEnabled(
  featureKey: string,
  userRole?: string
): Promise<boolean> {
  try {
    const normalizedRole = userRole?.toLowerCase().trim() || 'public';
    const flag = await FeatureFlag.findOne({
      featureKey: featureKey.toLowerCase()
    }).lean();

    if (!flag) {
      // If flag doesn't exist, default to enabled (backward compatibility)
      logger.debug(`Feature flag '${featureKey}' not found, defaulting to enabled`);
      return true;
    }

    // First check: if isActive is false, feature is disabled for everyone
    if (!flag.isActive) {
      logger.debug(`Feature flag '${featureKey}' is inactive`);
      return false;
    }

    // Second check: environment-specific activation
    // If enabledEnvironments is empty/null, feature is active in all environments
    if (flag.enabledEnvironments && flag.enabledEnvironments.length > 0) {
      const currentEnv = getCurrentEnvironment();
      const isEnabledForEnv = flag.enabledEnvironments.includes(currentEnv);

      if (!isEnabledForEnv) {
        logger.debug(`Feature flag '${featureKey}' is not enabled for environment '${currentEnv}'`);
        return false;
      }
    }

    // Third check: role-based access - check if user's role is in enabledRoles
    const enabledRoles = flag.enabledRoles || [];
    const normalizedEnabledRoles = enabledRoles.map(r => r.toLowerCase().trim());
    const hasAccess = normalizedEnabledRoles.includes(normalizedRole);

    if (!hasAccess) {
      logger.debug(`Feature flag '${featureKey}' is not enabled for role '${normalizedRole}'. Enabled roles: ${normalizedEnabledRoles.join(', ')}`);
      return false;
    }

    // Feature is enabled, active for current environment, and user's role has access
    return true;
  } catch (error: unknown) {
    logger.error(`Error checking feature flag '${featureKey}':`, error);
    // On error, default to enabled to avoid breaking the app
    return true;
  }
}

/**
 * Get all features enabled for a specific role
 */
export async function getEnabledFeaturesForRole(userRole: string): Promise<string[]> {
  try {
    const flags = await FeatureFlag.find({
      isActive: true,
      enabledRoles: userRole
    }).select('featureKey').lean();

    return flags.map(f => f.featureKey);
  } catch (error: unknown) {
    logger.error(`Error getting enabled features for role '${userRole}':`, error);
    return [];
  }
}

/**
 * Get all feature flags grouped by category
 */
export async function getFeatureFlagsByCategory(): Promise<Record<string, any[]>> {
  try {
    const flags = await FeatureFlag.find({ isActive: true })
      .sort({ category: 1, featureName: 1 })
      .lean();

    const grouped: Record<string, any[]> = {};

    flags.forEach(flag => {
      if (!grouped[flag.category]) {
        grouped[flag.category] = [];
      }
      grouped[flag.category].push({
        id: flag._id.toString(),
        featureKey: flag.featureKey,
        featureName: flag.featureName,
        description: flag.description,
        enabledRoles: flag.enabledRoles,
        metadata: flag.metadata || {}
      });
    });

    return grouped;
  } catch (error: unknown) {
    logger.error('Error getting feature flags by category:', error);
    return {};
  }
}
