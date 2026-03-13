/**
 * Privacy Settings Utility
 * 
 * This utility provides functions to check and manage user privacy settings
 * throughout the application. Privacy settings control:
 * - Whether user code/data is used for AI training
 * - Whether anonymized data is shared for platform improvements
 * 
 * Settings are stored in the database and synced via API.
 */

import { UserProfile } from '@orbitai/shared';
import { UserPrivacySettings } from '../components/UserSettings';

/**
 * Get privacy settings for a user from database
 * @param userId - The user's ID
 * @returns UserPrivacySettings object with current privacy preferences
 */
export async function getUserPrivacySettings(userId: string): Promise<UserPrivacySettings> {
  try {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${API_BASE_URL}/api/auth/privacy-settings`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-user-id': userId
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        return {
          privacyMode: data.data.privacyMode ?? false
        };
      }
    }
  } catch (error) {
    console.error('Failed to load privacy settings from database:', error);
  }
  
  // Fallback to default if API fails
  return {
    privacyMode: false // Default: privacy mode disabled (training and sharing enabled)
  };
}

/**
 * Get privacy settings synchronously (uses cached value or default)
 * For use in components that need immediate value without async
 * @param userId - The user's ID
 * @returns UserPrivacySettings object (may be default if not loaded yet)
 */
export function getUserPrivacySettingsSync(userId: string): UserPrivacySettings {
  // Try to get from localStorage cache (for immediate access)
  const cached = localStorage.getItem(`user_privacy_settings_cache_${userId}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Invalid cache, continue to default
    }
  }
  
  // Default settings: privacy mode disabled (training and sharing enabled)
  return {
    privacyMode: false
  };
}

/**
 * Check if user has privacy mode enabled (no training)
 * @param userId - The user's ID
 * @returns Promise<boolean> - true if privacy mode is enabled (no training), false otherwise
 */
export async function isPrivacyModeEnabled(userId: string): Promise<boolean> {
  const settings = await getUserPrivacySettings(userId);
  return settings.privacyMode === true;
}

/**
 * Check if user has privacy mode enabled synchronously (uses cache)
 * @param userId - The user's ID
 * @returns boolean - true if privacy mode is enabled (no training), false otherwise
 */
export function isPrivacyModeEnabledSync(userId: string): boolean {
  const settings = getUserPrivacySettingsSync(userId);
  return settings.privacyMode === true;
}

/**
 * Check if user has data sharing enabled
 * @param userId - The user's ID
 * @returns Promise<boolean> - true if data sharing is enabled (privacy mode is off), false otherwise
 */
export async function isDataSharingEnabled(userId: string): Promise<boolean> {
  const settings = await getUserPrivacySettings(userId);
  return !settings.privacyMode; // Sharing enabled when privacy mode is off
}

/**
 * Check if user has data sharing enabled synchronously (uses cache)
 * @param userId - The user's ID
 * @returns boolean - true if data sharing is enabled (privacy mode is off), false otherwise
 */
export function isDataSharingEnabledSync(userId: string): boolean {
  const settings = getUserPrivacySettingsSync(userId);
  return !settings.privacyMode; // Sharing enabled when privacy mode is off
}

/**
 * Check if code/data can be used for AI training
 * @param userId - The user's ID
 * @returns Promise<boolean> - true if code can be used for training, false if privacy mode is enabled
 */
export async function canUseForTraining(userId: string): Promise<boolean> {
  const enabled = await isPrivacyModeEnabled(userId);
  return !enabled;
}

/**
 * Check if code/data can be used for AI training synchronously (uses cache)
 * @param userId - The user's ID
 * @returns boolean - true if code can be used for training, false if privacy mode is enabled
 */
export function canUseForTrainingSync(userId: string): boolean {
  return !isPrivacyModeEnabledSync(userId);
}

/**
 * Check if anonymized data can be shared for platform improvements
 * @param userId - The user's ID
 * @returns Promise<boolean> - true if data can be shared, false otherwise
 */
export async function canShareForImprovements(userId: string): Promise<boolean> {
  return await isDataSharingEnabled(userId);
}

/**
 * Check if anonymized data can be shared synchronously (uses cache)
 * @param userId - The user's ID
 * @returns boolean - true if data can be shared, false otherwise
 */
export function canShareForImprovementsSync(userId: string): boolean {
  return isDataSharingEnabledSync(userId);
}

/**
 * Get privacy settings metadata for API requests
 * This can be included in API calls to inform the backend about user preferences
 * @param userId - The user's ID
 * @returns Promise<Object> with privacy flags for API requests
 */
export async function getPrivacyMetadata(userId: string): Promise<{
  allowTraining: boolean;
  allowSharing: boolean;
}> {
  const settings = await getUserPrivacySettings(userId);
  // When privacy mode is ON: no training, no sharing
  // When privacy mode is OFF: training enabled, sharing enabled
  return {
    allowTraining: !settings.privacyMode,
    allowSharing: !settings.privacyMode
  };
}

/**
 * Get privacy settings metadata synchronously (uses cache)
 * This can be included in API calls to inform the backend about user preferences
 * @param userId - The user's ID
 * @returns Object with privacy flags for API requests
 */
export function getPrivacyMetadataSync(userId: string): {
  allowTraining: boolean;
  allowSharing: boolean;
} {
  const settings = getUserPrivacySettingsSync(userId);
  // When privacy mode is ON: no training, no sharing
  // When privacy mode is OFF: training enabled, sharing enabled
  return {
    allowTraining: !settings.privacyMode,
    allowSharing: !settings.privacyMode
  };
}

/**
 * Save privacy settings for a user to database
 * @param userId - The user's ID
 * @param settings - The privacy settings to save
 * @returns Promise<boolean> - true if saved successfully
 */
export async function saveUserPrivacySettings(
  userId: string,
  settings: UserPrivacySettings
): Promise<boolean> {
  try {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${API_BASE_URL}/api/auth/privacy-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-user-id': userId
      },
      body: JSON.stringify({
        privacyMode: settings.privacyMode
      })
    });
    
    if (response.ok) {
      // Cache in localStorage for quick access
      localStorage.setItem(`user_privacy_settings_cache_${userId}`, JSON.stringify(settings));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to save privacy settings:', error);
    return false;
  }
}

