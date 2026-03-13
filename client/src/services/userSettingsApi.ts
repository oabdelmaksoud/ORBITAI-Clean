/**
 * User Settings API Service
 * Handles user preferences, current project, and other settings stored in database
 */

import { apiRequest } from './adminApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface UserSettings {
  currentProjectId?: string | null;
  preferences: {
    theme?: string;
    selectedTheme?: string;
    viewMode?: string;
    leftTab?: string;
    activeTab?: string;
    dismissedGuestBanner?: boolean;
    [key: string]: any;
  };
  shareLinks?: {
    [projectId: string]: any[];
  };
  shareTokens?: {
    [token: string]: {
      projectId: string;
      createdAt: number;
      expiresAt?: number;
    };
  };
}

/**
 * Get user settings from database
 */
export async function getUserSettings(token: string): Promise<UserSettings> {
  const response = await apiRequest<{
    success: boolean;
    data: { settings: UserSettings };
  }>('/api/user/settings', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch user settings');
  }

  return response.data.settings;
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  token: string,
  updates: Partial<UserSettings>
): Promise<UserSettings> {
  const response = await apiRequest<{
    success: boolean;
    data: { settings: UserSettings };
  }>('/api/user/settings', {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update user settings');
  }

  return response.data.settings;
}

/**
 * Update a specific preference
 */
export async function updatePreference(
  token: string,
  key: string,
  value: any
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
  }>('/api/user/settings/preference', {
    method: 'PATCH',
    body: JSON.stringify({ key, value }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update preference');
  }
}

/**
 * Migrate localStorage data to database
 */
export async function migrateLocalStorageToDatabase(
  token: string,
  localStorageData: {
    currentProjectId?: string;
    preferences?: Record<string, any>;
    shareLinks?: Record<string, any[]>;
    shareTokens?: Record<string, any>;
  }
): Promise<UserSettings> {
  const response = await apiRequest<{
    success: boolean;
    data: { settings: UserSettings };
  }>('/api/user/settings/migrate', {
    method: 'POST',
    body: JSON.stringify({ localStorageData }),
  }, token);

  if (!response.success) {
    throw new Error('Failed to migrate localStorage data');
  }

  return response.data.settings;
}

/**
 * Helper to extract localStorage data for migration
 */
export function extractLocalStorageData(): {
  currentProjectId?: string;
  preferences: Record<string, any>;
  shareLinks: Record<string, any[]>;
  shareTokens: Record<string, any>;
} {
  const data: {
    currentProjectId?: string;
    preferences: Record<string, any>;
    shareLinks: Record<string, any[]>;
    shareTokens: Record<string, any>;
  } = {
    preferences: {},
    shareLinks: {},
    shareTokens: {}
  };

  try {
    // Extract current project ID
    const currentProjectId = localStorage.getItem('orbitai_current_project_id');
    if (currentProjectId) {
      data.currentProjectId = currentProjectId;
    }

    // Extract user preferences
    const userStr = localStorage.getItem('orbitai_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.selectedTheme) data.preferences.selectedTheme = user.selectedTheme;
        if (user.theme) data.preferences.theme = user.theme;
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Extract share links (format: share_links_{projectId})
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith('share_links_')) {
        const projectId = key.replace('share_links_', '');
        try {
          const links = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(links)) {
            data.shareLinks[projectId] = links;
          }
        } catch (e) {
          // Ignore parse errors
        }
      } else if (key.startsWith('share_token_')) {
        const token = key.replace('share_token_', '');
        try {
          const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
          data.shareTokens[token] = tokenData;
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Extract other preferences
    const dismissedBanner = sessionStorage.getItem('guest_banner_dismissed');
    if (dismissedBanner === 'true') {
      data.preferences.dismissedGuestBanner = true;
    }
  } catch (error) {
    console.error('Error extracting localStorage data:', error);
  }

  return data;
}

export interface UserApiKey {
  provider: string;
  createdAt?: Date;
  lastUsed?: Date;
}

export interface LocalLLMConfig {
  type: 'ollama' | 'vllm' | 'openai_compatible';
  baseUrl: string;
  models: string[];
  enabled: boolean;
  createdAt?: Date;
  lastTested?: Date;
}

export interface LLMConfig {
  apiKeys: UserApiKey[];
  localLLMs: LocalLLMConfig[];
  apiKeyPreference: 'user' | 'platform' | 'user_then_platform';
  defaultModels?: {
    [provider: string]: string;
  };
}

/**
 * Get user's LLM configuration
 */
export async function getLLMConfig(token: string): Promise<LLMConfig> {
  const response = await apiRequest<{
    success: boolean;
    data: { llmConfig: LLMConfig };
  }>('/api/user/settings/llm-config', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch LLM configuration');
  }

  return response.data.llmConfig;
}

/**
 * Update user's LLM configuration
 */
export async function updateLLMConfig(
  token: string,
  config: Partial<LLMConfig>
): Promise<LLMConfig> {
  const response = await apiRequest<{
    success: boolean;
    data: { llmConfig: LLMConfig };
  }>('/api/user/settings/llm-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update LLM configuration');
  }

  return response.data.llmConfig;
}

/**
 * Test API key or local LLM connection
 * For API keys: if apiKey is not provided, tests the saved key from database
 */
export async function testLLMConnection(
  token: string,
  params: {
    type: 'api_key' | 'local_llm';
    provider?: string;
    apiKey?: string;
    localLLMType?: 'ollama' | 'vllm' | 'openai_compatible';
    baseUrl?: string;
  }
): Promise<{ success: boolean; error?: string; models?: string[] }> {
  const response = await apiRequest<{
    success: boolean;
    error?: string;
    models?: string[];
  }>('/api/user/settings/llm-config/test', {
    method: 'POST',
    body: JSON.stringify(params),
  }, token);

  return response;
}

/**
 * Delete a user's API key for a provider
 */
export async function deleteApiKey(
  token: string,
  provider: string
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message?: string;
  }>(`/api/user/settings/llm-config/api-key/${provider}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error(response.message || 'Failed to delete API key');
  }
}

/**
 * Delete a user's local LLM configuration
 */
export async function deleteLocalLLM(
  token: string,
  type: 'ollama' | 'vllm' | 'openai_compatible',
  baseUrl: string
): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message?: string;
  }>('/api/user/settings/llm-config/local-llm', {
    method: 'DELETE',
    body: JSON.stringify({ type, baseUrl }),
  }, token);

  if (!response.success) {
    throw new Error(response.message || 'Failed to delete local LLM');
  }
}










