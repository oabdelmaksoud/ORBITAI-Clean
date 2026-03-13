/**
 * Feature Access Helper Functions
 * Provides consistent superadmin bypass logic across the app
 */

/**
 * Check if a feature is enabled for a user, with superadmin bypass
 * @param featureResult The result from useFeatureAccess hook
 * @param userRole The user's role
 * @returns true if feature is enabled or user is superadmin
 */
export function isFeatureEnabled(
  featureResult: { enabled: boolean; loading: boolean },
  userRole?: string
): boolean {
  // Superadmin always has access
  if (userRole?.toLowerCase().trim() === 'superadmin') {
    return true;
  }
  
  // For other users, check the feature result
  // If loading, default to false to prevent premature access
  if (featureResult.loading) {
    return false;
  }
  
  return featureResult.enabled;
}

/**
 * Check if a feature should be shown (for conditional rendering)
 * @param featureResult The result from useFeatureAccess hook
 * @param userRole The user's role
 * @returns true if feature should be shown
 */
export function shouldShowFeature(
  featureResult: { enabled: boolean; loading: boolean },
  userRole?: string
): boolean {
  // Superadmin always sees features
  if (userRole?.toLowerCase().trim() === 'superadmin') {
    return true;
  }
  
  // For other users, check if enabled (don't wait for loading)
  return featureResult.enabled;
}

/**
 * Check if a button should be disabled
 * @param featureResult The result from useFeatureAccess hook
 * @param userRole The user's role
 * @returns true if button should be disabled
 */
export function isButtonDisabled(
  featureResult: { enabled: boolean; loading: boolean },
  userRole?: string
): boolean {
  // Superadmin buttons are never disabled
  if (userRole?.toLowerCase().trim() === 'superadmin') {
    return false;
  }
  
  // For other users, disable if loading or not enabled
  if (featureResult.loading) {
    return false; // Don't disable while loading (optimistic)
  }
  
  return !featureResult.enabled;
}

/**
 * Get button className based on feature access
 * @param featureResult The result from useFeatureAccess hook
 * @param userRole The user's role
 * @param enabledClass Class when enabled
 * @param disabledClass Class when disabled
 * @returns className string
 */
export function getFeatureButtonClass(
  featureResult: { enabled: boolean; loading: boolean },
  userRole?: string,
  enabledClass: string = 'bg-primary hover:bg-blue-600 text-white',
  disabledClass: string = 'bg-slate-100 text-slate-400 cursor-not-allowed'
): string {
  const isEnabled = isFeatureEnabled(featureResult, userRole);
  return isEnabled ? enabledClass : disabledClass;
}

