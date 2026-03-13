/**
 * OrbitAI Frontend API Service
 * Handles all communication with the backend API
 */

// Force port 3002 - environment variable override
const API_BASE_URL = (import.meta.env.VITE_API_URL || '')
  .replace(/localhost:3001/g, 'localhost:3002')
  .replace(/127\.0\.0\.1:3001/g, '127.0.0.1:3002')
  .replace(/:3001\//g, ':3002/');

// Request throttling to prevent rate limiting
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;
const MAX_CONCURRENT_REQUESTS = 3;
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests
let lastRequestTime = 0;
let activeRequests = 0;

async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;

  isProcessingQueue = true;

  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      // Wait before making next request
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }

    const requestFn = requestQueue.shift();
    if (requestFn) {
      activeRequests++;
      lastRequestTime = Date.now();

      requestFn()
        .finally(() => {
          activeRequests--;
          // Process next request in queue
          setTimeout(() => processRequestQueue(), MIN_REQUEST_INTERVAL);
        });
    }
  }

  isProcessingQueue = false;
}

// Get auth token from localStorage
export function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('authToken');
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
  }
  return null;
}

// Store auth token
export function setAuthToken(token: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('authToken', token);
    }
  } catch (error) {
    console.error('Error setting auth token:', error);
  }
}

// Remove auth token (logout)
export function removeAuthToken(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('authToken');
    }
  } catch (error) {
    console.error('Error removing auth token:', error);
  }
}

// Get current user
export function getCurrentUser(): any | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) return JSON.parse(userStr);

      // Fallback to 'orbitai_user' if 'currentUser' is missing
      const appUserStr = localStorage.getItem('orbitai_user');
      return appUserStr ? JSON.parse(appUserStr) : null;
    }
  } catch (error) {
    console.error('Error getting current user:', error);
  }
  return null;
}

// Store current user
export function setCurrentUser(user: any): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      // Sync with App.tsx which uses 'orbitai_user'
      localStorage.setItem('orbitai_user', JSON.stringify(user));
    }
  } catch (error) {
    console.error('Error setting current user:', error);
  }
}

// API request wrapper with error handling and throttling
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { suppressAuthErrors?: boolean; skipThrottle?: boolean; suppressProjectNotFound?: boolean } = {}
): Promise<T> {

  const { suppressAuthErrors, skipThrottle, suppressProjectNotFound, ...fetchOptions } = options;

  // Skip throttling for critical requests (like auth)
  if (skipThrottle) {
    return executeRequest<T>(endpoint, fetchOptions, suppressAuthErrors, suppressProjectNotFound);
  }

  // Queue request for throttling
  return new Promise<T>((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await executeRequest<T>(endpoint, fetchOptions, suppressAuthErrors, suppressProjectNotFound);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    processRequestQueue();
  });
}

// Actual request execution
async function executeRequest<T>(
  endpoint: string,
  fetchOptions: RequestInit,
  suppressAuthErrors?: boolean,
  suppressProjectNotFound?: boolean
): Promise<T> {

  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true', // Allow requests through localtunnel
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  // Request timeout (30 seconds default, 60 seconds for file uploads, 5 minutes for agent conversations)
  // Longer timeout for idea extraction (45-60 seconds for agent conversations)
  let timeoutMs: number | undefined;
  if (fetchOptions.signal) {
    // If a signal is provided, check if it's an AbortSignal with timeout
    // For idea extraction with agent messages, we need longer timeouts
    if (endpoint.includes('/llm/chat') && fetchOptions.body) {
      try {
        const body = JSON.parse(fetchOptions.body as string);
        // If this is idea extraction (has preferFastModel or contextType wizard), allow longer timeout
        if (body.contextType === 'wizard' || body.preferFastModel) {
          // Don't override the signal timeout - let it use the provided timeout
          timeoutMs = undefined; // Use provided signal
        } else {
          timeoutMs = undefined; // Use provided signal
        }
      } catch {
        timeoutMs = undefined; // Use provided signal
      }
    } else {
      timeoutMs = undefined; // Use provided signal
    }
  } else if (endpoint.includes('upload')) {
    timeoutMs = 60000; // 60 seconds for uploads
  } else if (endpoint.includes('/autogen/conversations')) {
    timeoutMs = 300000; // 5 minutes for agent conversations
  } else if (endpoint.includes('/llm/chat')) {
    timeoutMs = 120000; // 2 minutes for LLM chat (brainstorming can be slow)
  } else {
    timeoutMs = 60000; // 60 seconds default (increased from 30s for dev reliability)
  }
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = timeoutMs ? setTimeout(() => controller?.abort(), timeoutMs) : null;

  try {

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller?.signal || fetchOptions.signal,
    });

    // Clear timeout on successful response
    if (timeoutId) clearTimeout(timeoutId);


    // Handle network errors (no response received)
    if (!response) {
      throw new Error(`Failed to connect to server at ${API_BASE_URL}. Please ensure the backend is running.`);
    }

    // Read response as text first to check for HTML
    const text = await response.text();

    // Check if response is HTML (common error case)
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
      const error = new Error(`Server returned HTML instead of JSON. This usually means the endpoint doesn't exist or there's a server error.`) as any;
      error.status = response.status;
      throw error;
    }

    // Try to parse JSON, but handle cases where response might not be JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        // Check if it's HTML even though Content-Type says JSON
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
          const error = new Error(`Server returned HTML instead of JSON despite Content-Type header.`) as any;
          error.status = response.status;
          throw error;
        }
        const error = new Error(`Invalid JSON response from server: ${response.statusText}`) as any;
        error.status = response.status;
        throw error;
      }
    } else {
      // Non-JSON response
      const error = new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`) as any;
      error.status = response.status; // Preserve status code even for non-JSON responses
      throw error;
    }

    if (!response.ok) {

      const errorMessage = data.error?.message || data.message || `API Error: ${response.statusText} (${response.status})`;
      const isAuthError = response.status === 401 || response.status === 403 ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('User ID required') ||
        errorMessage.includes('Invalid or expired token');

      // AUTO SIGN-OUT: If token is invalid/expired, automatically sign out the user
      // Only do this if we actually HAD a token - otherwise it's just a guest hitting a protected endpoint
      // ALSO: Do not auto-signout GUEST users. Their tokens are client-side only and will always fail backend validation.
      // Check for guest tokens (start with 'guest-token-' or are not valid JWTs)
      const isGuestToken = token && (token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3);

      // Suppress error logging for guest user 401 errors (expected behavior)
      if (isGuestToken && response.status === 401) {
        const silentError = new Error('Unauthorized (guest user)') as any;
        silentError.isGuestError = true;
        silentError.status = 401;
        silentError.suppressLogging = true;
        throw silentError;
      }

      if (!suppressAuthErrors && (response.status === 401 || errorMessage.includes('Invalid or expired token')) && token && !isGuestToken) {
        console.log('🔐 [Auth] Token expired or invalid, auto signing out...');
        removeAuthToken();
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('orbitai_user');
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        // Redirect to setup page (which will show login prompt)
        // Prevent infinite reload loops by checking if we're already on setup page
        if (typeof window !== 'undefined' && !window.location.hash.startsWith('#setup')) {
          console.log('🔐 [Auth] Redirecting to setup page due to auth error');
          // window.location.href = '/#setup'; // TEMPORARILY DISABLED TO DEBUG RELOAD LOOP
        } else {
          console.log('🔐 [Auth] Already on setup page, skipping redirect to prevent loop');
        }
      }

      // Check if this is an expected 404 for a project GET request (project doesn't exist)
      // Match project ID pattern (24 hex chars) or any valid MongoDB ObjectId
      // Also handle cases where project ID might be in query params or URL hash
      // Use more lenient pattern to catch truncated IDs in error messages
      const projectIdPattern = /\/api\/projects\/[a-f0-9]{12,24}/i;
      const isProjectNotFound = response.status === 404 &&
        endpoint.includes('/api/projects/') &&
        (projectIdPattern.test(endpoint) || suppressProjectNotFound) &&
        (fetchOptions.method === undefined || fetchOptions.method === 'GET');

      // Suppress browser console error for project 404s
      if (isProjectNotFound && typeof window !== 'undefined') {
        // Prevent the error from appearing in console by intercepting it
        const originalError = window.console.error;
        window.console.error = (...args: any[]) => {
          const errorStr = args.join(' ');
          if (!errorStr.includes('/api/projects/') || !errorStr.includes('404')) {
            originalError.apply(window.console, args);
          }
        };
        // Restore after a short delay
        setTimeout(() => {
          window.console.error = originalError;
        }, 0);
      }

      // Also check for LLM usage 404s (expected when project doesn't exist)
      const llmUsagePattern = /\/api\/v1\/llm-usage\/project\/[a-f0-9]{24}/i;
      const isLLMUsageNotFound = response.status === 404 &&
        endpoint.includes('/api/v1/llm-usage/project/') &&
        llmUsagePattern.test(endpoint) &&
        (fetchOptions.method === undefined || fetchOptions.method === 'GET');

      // Create error with status code for better detection
      const error = new Error(errorMessage) as any;
      error.status = response.status;
      error.isProjectNotFound = isProjectNotFound; // Flag for downstream handling
      error.isLLMUsageNotFound = isLLMUsageNotFound; // Flag for LLM usage 404s

      // Suppress logging for auth errors if suppressAuthErrors is true
      if (suppressAuthErrors && isAuthError) {
        // Don't log, just throw silently
        throw error;
      }

      // For project 404s and LLM usage 404s, throw silently (will be handled gracefully)
      // If suppressProjectNotFound is true, mark error to prevent console logging
      if (isProjectNotFound || isLLMUsageNotFound) {
        // Always suppress console for project 404s and LLM usage 404s (expected behavior)
        error.suppressConsole = true; // Flag to prevent console logging downstream
        error.isProjectNotFound = isProjectNotFound; // Ensure flag is set
        error.isLLMUsageNotFound = isLLMUsageNotFound; // Ensure flag is set
        // Don't log, just throw - this is expected when project doesn't exist
        throw error;
      }

      throw error;
    }


    return data;
  } catch (error: any) {
    // Suppress logging for guest user errors FIRST (expected behavior)
    if (error?.suppressLogging || error?.isGuestError) {
      throw error; // Re-throw without logging
    }

    // Check if this is an abort error (request was cancelled)
    const isAbortError = error?.name === 'AbortError' ||
      error?.name === 'DOMException' ||
      error?.message?.includes('aborted') ||
      error?.message?.includes('signal is aborted') ||
      (error instanceof DOMException && error.name === 'AbortError');

    // If aborted, create a clean error that won't be logged
    if (isAbortError) {
      const abortError = new Error('Request was aborted') as any;
      abortError.name = 'AbortError';
      abortError.isAbortError = true;
      abortError.suppressConsole = true; // Suppress console logging
      throw abortError;
    }

    // Check if this is a project 404 that should be suppressed
    // Use more lenient pattern to catch truncated IDs and always respect suppressProjectNotFound flag
    const projectIdPatternCatch = /\/api\/projects\/[a-f0-9]{12,24}/i;
    const isProjectNotFoundCatch = error?.isProjectNotFound ||
      (error?.status === 404 &&
        endpoint.includes('/api/projects/') &&
        (projectIdPatternCatch.test(endpoint) || suppressProjectNotFound));

    // Check if this is an LLM usage 404 (expected when project doesn't exist)
    const llmUsagePatternCatch = /\/api\/v1\/llm-usage\/project\/[a-f0-9]{24}/i;
    const isLLMUsageNotFoundCatch = error?.status === 404 &&
      endpoint.includes('/api/v1/llm-usage/project/') &&
      llmUsagePatternCatch.test(endpoint);

    // Always suppress console logging for project 404s and LLM usage 404s (expected behavior)
    if (isProjectNotFoundCatch || isLLMUsageNotFoundCatch) {
      error.suppressConsole = true; // Ensure flag is set
      error.isProjectNotFound = isProjectNotFoundCatch; // Ensure flag is set
      error.isLLMUsageNotFound = isLLMUsageNotFoundCatch; // Flag for LLM usage 404s
      // Don't log - just rethrow silently
      throw error;
    }

    // Check if this is an auth error before any logging
    const isAuthError = error?.message?.includes('401') ||
      error?.message?.includes('403') ||
      error?.message?.includes('Unauthorized') ||
      error?.message?.includes('User ID required') ||
      error?.status === 401 ||
      error?.status === 403;

    // Suppress ALL logging for auth errors if suppressAuthErrors is true
    // Also suppress for ANY 401/403 in mock/dev mode to prevent side effects
    if (suppressAuthErrors || isAuthError) {
      // Silently re-throw without any console output or error tracking
      // Set suppressConsole explicitly to prevent downstream logging
      error.suppressConsole = true;
      throw error;
    }

    // Re-throw if it's already a proper Error with message
    if (error instanceof Error && error.message) {
      // Suppress logging for connection errors (backend not running)
      const isConnectionError = (error as any).isConnectionError ||
        error.message.includes('ERR_CONNECTION_REFUSED') ||
        error.message.includes('Failed to fetch') ||
        (error.name === 'TypeError' && error.message.includes('fetch')) ||
        error.message.includes('NetworkError');

      // Suppress logging for 404 errors on project GET requests (expected when project doesn't exist)
      // Use more lenient pattern and always respect suppressProjectNotFound flag
      const projectIdPatternInner = /\/api\/projects\/[a-f0-9]{12,24}/i;
      const isProjectNotFoundInner = ((error as any).status === 404 || error.message.includes('404')) &&
        endpoint.includes('/api/projects/') &&
        (projectIdPatternInner.test(endpoint) || suppressProjectNotFound) &&
        (fetchOptions.method === undefined || fetchOptions.method === 'GET');

      // Also suppress 404s for LLM usage endpoints when project doesn't exist (expected behavior)
      const llmUsagePatternInner = /\/api\/v1\/llm-usage\/project\/[a-f0-9]{24}/i;
      const isLLMUsageNotFoundInner = ((error as any).status === 404 || error.message.includes('404')) &&
        endpoint.includes('/api/v1/llm-usage/project/') &&
        llmUsagePatternInner.test(endpoint) &&
        (fetchOptions.method === undefined || fetchOptions.method === 'GET');

      // Suppress ALL logging for project 404s and LLM usage 404s - they are expected and handled gracefully
      // Suppress logging if flagged or if it's a connection/expected error
      if (!isConnectionError && !isProjectNotFoundInner && !isLLMUsageNotFoundInner && !(error as any).suppressConsole) {
        console.error('API Request Error:', error.message, { endpoint, API_BASE_URL });
      }
      // Silently handle connection errors and expected 404s - don't log to console

      // Track API errors (except auth errors, connection errors, expected 404s, and abort errors)
      // NEVER track project 404s, LLM usage 404s, or abort errors - they are expected behavior
      const isAbortErrorForTracking = error?.name === 'AbortError' ||
        (error as any)?.isAbortError ||
        error?.message?.includes('aborted') ||
        error?.message?.includes('signal is aborted');

      if (!isAuthError && !isConnectionError && !isProjectNotFoundInner && !isLLMUsageNotFoundInner && !isAbortErrorForTracking) {
        try {
          const { captureException } = await import('@src/services/errorTracking');
          captureException(error, {
            endpoint,
            method: fetchOptions.method || 'GET',
            url: `${API_BASE_URL}${endpoint}`,
            status: (error as any).status
          });
        } catch (trackingError) {
          // Ignore errors in error tracking itself
          console.debug('Failed to track API error:', trackingError);
        }
      }

      throw error;
    }

    // Handle fetch network errors (backend not running)
    if (error.name === 'TypeError' || error.message === 'Failed to fetch' || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      // Suppress ALL logging for connection errors - backend is not running
      // These errors are expected when the backend is down and clutter the console
      const backendUrl = API_BASE_URL || '';
      const networkError = new Error(`Failed to connect to backend server at ${backendUrl}. Please ensure the backend is running. You can start it with: cd server && npm run dev`);
      (networkError as any).isConnectionError = true;
      (networkError as any).suppressConsole = true; // Flag to prevent console logging
      (networkError as any).message = error.message || networkError.message; // Preserve original message

      // Don't track or log connection errors - they're expected when backend is down
      throw networkError;
    }

    // Check if this is a project 404 that should be suppressed (even if not caught earlier)
    const projectIdPatternFinal = /\/api\/projects\/[a-f0-9]{12,24}/i;
    const isProjectNotFoundFinal = (error as any)?.isProjectNotFound ||
      (((error as any)?.status === 404 || error?.message?.includes('404')) &&
        endpoint.includes('/api/projects/') &&
        (projectIdPatternFinal.test(endpoint) || suppressProjectNotFound));

    // Don't log connection errors or project 404s - they're suppressed
    if (!(error as any).suppressConsole && !(error as any).isConnectionError && !isProjectNotFoundFinal) {
      console.error('API Request Error:', error);
    }

    // Track unknown errors
    if (error instanceof Error) {
      try {
        const { captureException } = await import('@src/services/errorTracking');
        captureException(error, {
          endpoint,
          method: fetchOptions.method || 'GET',
          url: `${API_BASE_URL}${endpoint}`
        });
      } catch (trackingError) {
        // Ignore errors in error tracking itself
        console.debug('Failed to track error:', trackingError);
      }
    }

    throw error;
  }
}

// ==================== Authentication API ====================

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      avatar: string;
      plan: string;
    };
    token: string;
  };
}

export const authApi = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data.token) {
      setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
    }

    return response;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data.token) {
      setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
    }

    return response;
  },

  async getCurrentUser(suppressAuthErrors = false): Promise<any> {
    return apiRequest<any>('/api/auth/me', { suppressAuthErrors });
  },

  logout(): void {
    removeAuthToken();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('orbitai_user');
      }
    } catch (error) {
      console.error('Error removing current user:', error);
    }
  },

  async googleSignIn(idToken: string): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    if (response.success && response.data.token) {
      setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
    }

    return response;
  },

  async appleSignIn(identityToken: string, authorizationCode: string): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/api/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, authorizationCode }),
    });

    if (response.success && response.data.token) {
      setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
    }

    return response;
  },
};

// ==================== Projects API ====================

export interface ProjectResponse {
  success: boolean;
  data: {
    project?: any;
    projects?: any[];
  };
}

export const projectsApi = {
  async getAll(): Promise<any[]> {
    const response = await apiRequest<ProjectResponse>('/api/projects');
    return response.data.projects || [];
  },

  async getById(id: string): Promise<any> {
    try {
      const response = await apiRequest<ProjectResponse>(`/api/projects/${id}`, {
        suppressProjectNotFound: true, // Flag to suppress console errors for expected 404s
        method: 'GET'
      });
      return response?.data?.project || null;
    } catch (error: any) {
      // Silently handle 404 errors for projects (project doesn't exist)
      // This is expected behavior - project may not exist yet or was deleted
      if (error?.status === 404 || error?.isProjectNotFound || error?.message?.includes('404')) {
        // Return null silently - no console logging, no error throwing
        // The error is already suppressed in executeRequest
        return null;
      }
      // Re-throw other errors
      throw error;
    }
  },

  async create(project: any): Promise<any> {
    const response = await apiRequest<ProjectResponse>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    return response.data.project;
  },

  async update(id: string, project: any): Promise<any> {
    const response = await apiRequest<ProjectResponse>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    });
    return response.data.project;
  },

  async delete(id: string): Promise<void> {
    await apiRequest(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  },

  async import(projectData: any, importMode: 'create' | 'merge' | 'overwrite' = 'create'): Promise<any> {
    const response = await apiRequest<ProjectResponse>('/api/projects/import', {
      method: 'POST',
      body: JSON.stringify({ projectData, importMode }),
    });
    return response.data.project;
  },

  async exportReport(
    projectId: string,
    format: 'pdf' | 'docx',
    options?: {
      includeTasks?: boolean;
      includeArtifacts?: boolean;
      includeLogs?: boolean;
      includeAgents?: boolean;
      title?: string;
    }
  ): Promise<Blob> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/export-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        format,
        ...options,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to export report');
    }

    return await response.blob();
  },
};

// ==================== Tasks API ====================

export const tasksApi = {
  async update(projectId: string, taskId: string, updates: any): Promise<any> {
    const response = await apiRequest<any>(`/api/tasks/${projectId}/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return response.data.task;
  },
};

// ==================== Artifacts API ====================

export const artifactsApi = {
  async upload(projectId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/artifacts/upload/${projectId}`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    return data.data.artifact;
  },
};

// ==================== Health API ====================

export const healthApi = {
  async check(): Promise<any> {
    return apiRequest('/health');
  },

  async detailed(): Promise<any> {
    return apiRequest('/api/health/detailed');
  },
};

export default {
  auth: authApi,
  projects: projectsApi,
  tasks: tasksApi,
  artifacts: artifactsApi,
  health: healthApi,
};

