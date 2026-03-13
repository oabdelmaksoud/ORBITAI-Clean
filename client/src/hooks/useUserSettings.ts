/**
 * Hook for managing user settings in database
 * Replaces localStorage usage with database API calls
 */

import { useState, useEffect, useCallback } from 'react';
import { getUserSettings, updateUserSettings, updatePreference, migrateLocalStorageToDatabase, extractLocalStorageData, UserSettings } from '../services/userSettingsApi';

export function useUserSettings(userToken: string | null) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!userToken) {
      setLoading(false);
      return;
    }

    // Check if this is a guest token (guest tokens start with 'guest-token-' or are not valid JWTs)
    // Real JWT tokens have 3 parts separated by dots: header.payload.signature
    const isGuestToken = userToken.startsWith('guest-token-') || !userToken.includes('.') || userToken.split('.').length !== 3;
    
    if (isGuestToken) {
      // Guest users don't have database settings - use localStorage fallback
      setLoading(false);
      setSettings({
        currentProjectId: localStorage.getItem('orbitai_current_project_id') || null,
        preferences: {},
        shareLinks: {},
        shareTokens: {}
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userSettings = await getUserSettings(userToken);
      setSettings(userSettings);
    } catch (err: any) {
      // Suppress 401 errors for guest users (already handled above) or silent guest errors
      const isGuestError = (err as any).isGuestError;
      const isUnauthorized = err.message?.includes('401') || err.message?.includes('Unauthorized') || err.message?.includes('Invalid or expired token') || err.message?.includes('Unauthorized (guest user)');
      
      if (!isGuestError && !isUnauthorized) {
        console.error('Failed to load user settings:', err);
      }
      
      // Don't set error state for guest user errors
      if (!isGuestError) {
        setError(err.message || 'Failed to load settings');
      }
      
      // Fallback to empty settings
      setSettings({
        currentProjectId: null,
        preferences: {},
        shareLinks: {},
        shareTokens: {}
      });
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  // Migrate localStorage to database on first load
  const migrateLocalStorage = useCallback(async () => {
    if (!userToken) return;

    try {
      const localStorageData = extractLocalStorageData();
      if (localStorageData.currentProjectId || Object.keys(localStorageData.preferences).length > 0) {
        await migrateLocalStorageToDatabase(userToken, localStorageData);
        // Reload settings after migration
        await loadSettings();
      }
    } catch (err) {
      console.error('Failed to migrate localStorage:', err);
    }
  }, [userToken, loadSettings]);

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!userToken) {
      // Fallback to localStorage if not logged in
      if (updates.currentProjectId) {
        localStorage.setItem('orbitai_current_project_id', updates.currentProjectId);
      }
      return;
    }

    try {
      const updated = await updateUserSettings(userToken, updates);
      setSettings(updated);
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  }, [userToken]);

  // Update a single preference
  const updatePref = useCallback(async (key: string, value: any) => {
    if (!userToken) {
      // Fallback to localStorage if not logged in
      if (key === 'selectedTheme' || key === 'theme') {
        const userStr = localStorage.getItem('orbitai_user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            user[key] = value;
            localStorage.setItem('orbitai_user', JSON.stringify(user));
          } catch (e) {
            // Ignore
          }
        }
      }
      return;
    }

    try {
      await updatePreference(userToken, key, value);
      setSettings(prev => prev ? {
        ...prev,
        preferences: { ...prev.preferences, [key]: value }
      } : null);
    } catch (err: any) {
      console.error('Failed to update preference:', err);
      throw err;
    }
  }, [userToken]);

  // Load settings on mount and when token changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Migrate localStorage on first load if user is logged in
  useEffect(() => {
    if (userToken && settings && !loading) {
      migrateLocalStorage();
    }
  }, [userToken, settings, loading, migrateLocalStorage]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    updatePreference: updatePref,
    reload: loadSettings
  };
}













