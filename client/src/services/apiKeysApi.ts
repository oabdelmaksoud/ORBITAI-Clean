/**
 * API Keys Management API Service
 * Secure API key management endpoints
 */

import { getAuthToken } from '@src/services/api.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to get auth token (tries both regular and admin tokens)
function getAuthTokenForRequest(providedToken?: string): string | null {
  // Use provided token if available
  if (providedToken) return providedToken;

  // Try regular auth token first
  const authToken = getAuthToken();
  if (authToken) return authToken;

  // Fallback to admin_token if available
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('admin_token') || localStorage.getItem('token') || null;
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
  }

  return null;
}

// Store token for API requests (set by component)
let globalApiKeyToken: string | null = null;

export function setApiKeyToken(token: string | null) {
  globalApiKeyToken = token;
}

// Helper function for authenticated API calls
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get token (tries provided token, then global, then localStorage)
  const token = getAuthTokenForRequest(globalApiKeyToken);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Log warning if no token found
    console.warn('[apiKeysApi] No authentication token found. Request may fail.');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || error.error?.message || `API Error: ${response.statusText}`);
  }

  return response.json();
}

export interface ApiKey {
  id: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'huggingface' | 'e2b' | 'google_search' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'tripo' | 'flux' | 'sloyd' | 'custom';
  keyName: string;
  maskedValue: string; // Masked for display (e.g., "••••••••••••EC2M")
  lastUsed?: string;
  isActive: boolean;
  metadata?: {
    environment?: 'development' | 'staging' | 'production';
    enabledEnvironments?: string[];
    description?: string;
    tags?: string[];
    additionalConfig?: {
      engineId?: string; // For Google Search: GOOGLE_SEARCH_ENGINE_ID
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyInput {
  provider: ApiKey['provider'];
  keyName: string;
  value: string; // Plaintext API key (will be encrypted on backend)
  metadata?: {
    environment?: 'development' | 'staging' | 'production'; // Deprecated - use enabledEnvironments
    enabledEnvironments?: string[]; // Array of environments where this key is active (empty = all environments)
    description?: string;
    tags?: string[];
    additionalConfig?: {
      engineId?: string; // For Google Search: GOOGLE_SEARCH_ENGINE_ID
    };
  };
}

export interface ApiKeyTestResult {
  valid: boolean;
  message: string;
}

/**
 * Get all API keys
 */
export async function getApiKeys(): Promise<{ success: boolean; data: { keys: ApiKey[]; count: number } }> {
  return apiRequest('/api/admin/api-keys');
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(id: string): Promise<{ success: boolean; data: { key: ApiKey } }> {
  return apiRequest(`/api/admin/api-keys/${id}`);
}

/**
 * Create a new API key
 */
export async function createApiKey(input: ApiKeyInput): Promise<{ success: boolean; data: { key: ApiKey }; message: string }> {
  return apiRequest('/api/admin/api-keys', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update API key
 */
export async function updateApiKey(
  id: string,
  updates: Partial<ApiKeyInput>
): Promise<{ success: boolean; data: { key: ApiKey }; message: string }> {
  return apiRequest(`/api/admin/api-keys/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Deactivate API key (soft delete - can be reactivated)
 */
export async function deactivateApiKey(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/admin/api-keys/${id}/deactivate`, {
    method: 'POST',
  });
}

/**
 * Permanently delete API key (hard delete - cannot be recovered)
 */
export async function deleteApiKey(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/admin/api-keys/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Activate API key
 */
export async function activateApiKey(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/admin/api-keys/${id}/activate`, {
    method: 'POST',
  });
}

/**
 * Test API key (without exposing the value)
 */
export async function testApiKey(id: string): Promise<{ success: boolean; data: { testResult: ApiKeyTestResult; provider: string; keyName: string } }> {
  return apiRequest(`/api/admin/api-keys/${id}/test`, {
    method: 'POST',
  });
}

