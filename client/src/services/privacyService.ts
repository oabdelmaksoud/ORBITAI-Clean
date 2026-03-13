export interface PrivacySettings {
  localOnlyMode: boolean;
  dataRetentionDays: number;
  allowRemoteStorage: boolean;
  allowAnalytics: boolean;
  encryptData: boolean;
}

const PRIVACY_SETTINGS_KEY = 'orbitai_privacy_settings';

/**
 * Get privacy settings from localStorage
 */
export function getPrivacySettings(): PrivacySettings {
  if (typeof localStorage === 'undefined') {
    return getDefaultPrivacySettings();
  }
  
  try {
    const stored = localStorage.getItem(PRIVACY_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load privacy settings:', error);
  }
  
  return getDefaultPrivacySettings();
}

/**
 * Save privacy settings to localStorage
 */
export function savePrivacySettings(settings: PrivacySettings): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save privacy settings:', error);
  }
}

/**
 * Get default privacy settings
 */
function getDefaultPrivacySettings(): PrivacySettings {
  return {
    localOnlyMode: false,
    dataRetentionDays: 90,
    allowRemoteStorage: true,
    allowAnalytics: true,
    encryptData: false
  };
}

/**
 * Check if local-only mode is enabled
 */
export function isLocalOnlyMode(): boolean {
  return getPrivacySettings().localOnlyMode;
}

/**
 * Check if data should be encrypted
 */
export function shouldEncryptData(): boolean {
  return getPrivacySettings().encryptData;
}
















