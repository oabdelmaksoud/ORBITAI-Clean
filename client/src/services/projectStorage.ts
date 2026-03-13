/**
 * Project Storage Service
 * Database-only storage - no localStorage fallbacks
 * Requires authentication for all operations
 */

import type { ProjectState, Phase } from '@orbitai/shared';
import { DEFAULT_MCP_SERVERS } from '@orbitai/shared';
import { secureSetItem, secureRemoveItem, secureGetItem } from '../utils/secureStorage';

/**
 * Validate MongoDB ObjectId format
 * MongoDB ObjectIds are 24-character hexadecimal strings
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // MongoDB ObjectId is exactly 24 hexadecimal characters
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Track invalid IDs we've already warned about to prevent spam in React StrictMode
const warnedInvalidIds = new Set<string>();
const WARN_CLEAR_INTERVAL = 30000; // Clear warnings after 30 seconds

/**
 * Clear old warnings periodically to prevent memory leaks
 */
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (warnedInvalidIds.size > 100) {
      warnedInvalidIds.clear();
    }
    // Also clean up old "not found" cache entries (older than NOT_FOUND_CACHE_DURATION)
    const now = Date.now();
    for (const [projectId, timestamp] of notFoundCache.entries()) {
      if (now - timestamp > NOT_FOUND_CACHE_DURATION) {
        notFoundCache.delete(projectId);
      }
    }
  }, WARN_CLEAR_INTERVAL);
}

/**
 * Generate a valid MongoDB ObjectId (24 hex characters)
 * This creates a client-side ObjectId that matches MongoDB's format
 */
export function generateObjectId(): string {
  // Generate 24 hex characters (similar to MongoDB ObjectId format)
  // Using timestamp (8 chars) + random (16 chars) for uniqueness
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return (timestamp + random).substring(0, 24);
}

// Lazy import to avoid circular dependencies
let projectsApi: any;
let authApi: any;

async function getProjectsApi() {
  if (!projectsApi) {
    const apiModule = await import('@src/services/api');
    projectsApi = apiModule.projectsApi;
    authApi = apiModule.authApi;
  }
  return projectsApi;
}

// Cache for project metadata list to prevent rate limiting
const projectsListCache: { data: ProjectMetadata[] | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_DURATION = 30 * 1000; // 30 seconds cache for projects list
let pendingProjectsListRequest: Promise<ProjectMetadata[]> | null = null;

// Cache for individual projects to prevent rate limiting
const projectCache: Map<string, { data: ProjectState; timestamp: number }> = new Map();
const PROJECT_CACHE_DURATION = 60 * 1000; // 60 seconds cache for individual projects
const pendingProjectRequests: Map<string, Promise<ProjectState | null>> = new Map();
// Cache for "not found" projects to prevent repeated 404 requests
const notFoundCache: Map<string, number> = new Map();
const NOT_FOUND_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - don't retry missing projects for 5 minutes

export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
  description: string;
  phase: Phase;
  userId?: string;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const token = localStorage.getItem('authToken');
    return !!token;
  } catch (error) {
    return false;
  }
}

/**
 * Throw error if not authenticated
 */
function requireAuth(): void {
  if (!isAuthenticated()) {
    throw new Error('Authentication required. Please log in to access projects.');
  }
}

/**
 * Get project metadata list from database
 * Returns empty array if user is not authenticated
 */
export async function getProjectMetadataList(): Promise<ProjectMetadata[]> {
  // Return empty array if not authenticated (allow unauthenticated users to use the app)
  if (!isAuthenticated()) {
    // Debug: Reduced console noise
    // if (import.meta.env.DEV) {
    //   console.debug('[Project Storage] User not authenticated, returning empty project list');
    // }
    return [];
  }

  // Check for guest tokens - guest users don't have database projects
  const token = localStorage.getItem('authToken');
  if (token) {
    const isGuestToken = token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3;
    if (isGuestToken) {
      // Guest users don't have database projects - return empty array
      return [];
    }
  }

  // Check cache first (30 second TTL)
  const now = Date.now();
  if (projectsListCache.data && (now - projectsListCache.timestamp) < CACHE_DURATION) {
    if (import.meta.env.DEV) {
      // Debug: Reduced console noise
      // console.debug('[Project Storage] Using cached projects list');
    }
    return projectsListCache.data;
  }

  // Check if there's already a pending request
  if (pendingProjectsListRequest) {
    // Silently reuse pending request to reduce console noise
    return pendingProjectsListRequest;
  }

  // Create new request
  const requestPromise = (async (): Promise<ProjectMetadata[]> => {
    try {
      const api = await getProjectsApi();
      const projects = await api.getAll();
      const metadata = projects.map((p: any) => ({
        id: p.id || p._id,
        name: p.name,
        lastModified: new Date(p.lastModified || p.updatedAt).getTime(),
        description: p.description || '',
        phase: p.currentPhase || p.phase || 'requirements',
        userId: p.userId,
      }));

      // Update cache
      projectsListCache.data = metadata;
      projectsListCache.timestamp = Date.now();

      return metadata;
    } catch (error: any) {
      // Suppress errors for guest users (expected behavior)
      if (error.isGuestError || error.suppressLogging) {
        return []; // Return empty array for guest users
      }

      const isConnectionError = error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED');
      if (!isConnectionError && import.meta.env.DEV) {
        console.debug('Failed to fetch projects from database:', error);
      }
      throw new Error(`Failed to load projects: ${error.message || 'Unknown error'}`);
    }
  })();

  // Store pending request
  pendingProjectsListRequest = requestPromise;

  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clear pending request
    pendingProjectsListRequest = null;
  }
}

/**
 * Get project by ID from database
 */
export async function getProject(projectId: string): Promise<ProjectState | null> {
  // Return null if not authenticated (allow unauthenticated users without errors)
  if (!isAuthenticated()) {
    return null;
  }

  // Check for guest tokens - guest users don't have database projects
  const token = localStorage.getItem('authToken');
  if (token) {
    const isGuestToken = token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3;
    if (isGuestToken) {
      // Guest users don't have database projects - return null
      return null;
    }
  }

  // Validate ObjectId format before making API call
  if (!isValidObjectId(projectId)) {
    // Only warn once per invalid ID to prevent spam in React StrictMode
    if (!warnedInvalidIds.has(projectId)) {
      warnedInvalidIds.add(projectId);
      // Clean up invalid ID from URL and localStorage immediately
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get('project') === projectId) {
            url.searchParams.delete('project');
            window.history.replaceState({}, '', url.toString());
          }
        } catch (e) {
          // Ignore errors
        }
      }
      // Don't log warning for invalid IDs - they're likely from stale state
      // console.warn(`[Project Storage] Invalid project ID format: "${projectId}". MongoDB ObjectIds must be 24 hexadecimal characters.`);
      // Clear from set after a delay to allow re-warning if ID persists
      setTimeout(() => {
        warnedInvalidIds.delete(projectId);
      }, 5000);
    }
    return null;
  }

  // Silently return null for 404 errors (project doesn't exist yet) - this is expected for new projects
  // Only log errors for other failure cases

  // Check "not found" cache first - prevent repeated 404 requests
  // This MUST happen before any API call to prevent 404 errors
  const notFoundTimestamp = notFoundCache.get(projectId);
  if (notFoundTimestamp && (Date.now() - notFoundTimestamp) < NOT_FOUND_CACHE_DURATION) {
    // Project was recently confirmed as not found - return null immediately without API call
    // Also trigger cleanup to remove from URL/state
    if (typeof window !== 'undefined') {
      // Clean up synchronously from URL to prevent retries
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('project') === projectId) {
          url.searchParams.delete('project');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        // Ignore errors
      }
    }
    return null;
  }

  // Check cache first
  const cached = projectCache.get(projectId);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < PROJECT_CACHE_DURATION) {
    if (import.meta.env.DEV) {
      // Debug: Reduced console noise
      // console.debug('[Project Storage] Using cached project:', projectId);
    }
    return cached.data;
  }

  // FIRST: Check "not found" cache BEFORE any other operations
  // This prevents any API calls for projects we know don't exist
  const earlyNotFoundCheck = notFoundCache.get(projectId);
  if (earlyNotFoundCheck && (Date.now() - earlyNotFoundCheck) < NOT_FOUND_CACHE_DURATION) {
    // Project is confirmed as not found - clean up URL and return immediately
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('project') === projectId) {
          url.searchParams.delete('project');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        // Ignore errors
      }
    }
    return Promise.resolve(null); // Return resolved promise with null to prevent any API calls
  }

  // Check if there's already a pending request for this project
  const pendingRequest = pendingProjectRequests.get(projectId);
  if (pendingRequest) {
    // Silently reuse pending request to reduce console noise
    return pendingRequest;
  }

  // Create new request
  const requestPromise = (async (): Promise<ProjectState | null> => {
    // Double-check "not found" cache right before making API call (race condition protection)
    const doubleCheckNotFound = notFoundCache.get(projectId);
    if (doubleCheckNotFound && (Date.now() - doubleCheckNotFound) < NOT_FOUND_CACHE_DURATION) {
      // Also clean up URL synchronously if it matches
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get('project') === projectId) {
            url.searchParams.delete('project');
            window.history.replaceState({}, '', url.toString());
          }
        } catch (e) {
          // Ignore errors
        }
      }
      return null; // Skip API call if in cache
    }

    try {
      const api = await getProjectsApi();
      // Use suppressProjectNotFound flag to prevent console errors
      const project = await api.getById(projectId);
      if (!project) {
        // Project doesn't exist - cache the "not found" result IMMEDIATELY
        notFoundCache.set(projectId, Date.now());
        // Clean up invalid ID from all storage locations immediately (synchronously where possible)
        if (typeof window !== 'undefined') {
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.get('project') === projectId) {
              url.searchParams.delete('project');
              window.history.replaceState({}, '', url.toString());
            }
          } catch (e) {
            // Ignore errors
          }
        }
        // Then clean up from other sources
        await cleanupProjectIdFromAllSources(projectId);
        return null;
      }

      // Project exists - remove from not found cache if it was there
      notFoundCache.delete(projectId);

      // Convert API project format to ProjectState
      const projectState = convertApiProjectToState(project);

      // Update cache
      projectCache.set(projectId, {
        data: projectState,
        timestamp: Date.now()
      });

      // Remove from "not found" cache since project now exists
      notFoundCache.delete(projectId);

      return projectState;
    } catch (error: any) {
      // Suppress errors for guest users (expected behavior)
      if (error.isGuestError || error.suppressLogging) {
        return null; // Return null for guest users
      }

      // 404 is expected for new projects or deleted projects - clean up and return null silently
      if (error.status === 404 || error?.isProjectNotFound) {
        // Cache the "not found" result to prevent repeated requests
        notFoundCache.set(projectId, Date.now());
        // Clean up invalid project ID from all storage locations immediately
        await cleanupProjectIdFromAllSources(projectId);
        // Return null silently - no console logging
        return null;
      }
      // Log other errors but don't throw - allow save to proceed
      console.error('Failed to fetch project from database:', error);
      return null;
    }
  })();

  // Store pending request
  pendingProjectRequests.set(projectId, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clear pending request
    pendingProjectRequests.delete(projectId);
  }
}

/**
 * Update project cache synchronously (without saving to database)
 * Useful for immediately updating cache after loading from database
 */
export function updateProjectCache(projectId: string, project: ProjectState): void {
  projectCache.set(projectId, {
    data: project,
    timestamp: Date.now()
  });
}

/**
 * Save project to database
 */
export async function saveProject(projectId: string, project: ProjectState): Promise<void> {
  requireAuth();

  try {
    const api = await getProjectsApi();
    const apiProject = convertStateToApiProject(project);

    // Try to update first
    try {
      await api.update(projectId, apiProject);
    } catch (error: any) {
      // If update fails (404), try creating
      if (error.status === 404) {
        const created = await api.create(apiProject);
        if (created.id || created._id) {
          project.id = created.id || created._id;
        }
      } else {
        throw error;
      }
    }

    // Update cache
    projectCache.set(projectId, {
      data: project,
      timestamp: Date.now()
    });

    // Remove from "not found" cache since project now exists
    notFoundCache.delete(projectId);

    // Invalidate metadata cache
    projectsListCache.data = null;
    projectsListCache.timestamp = 0;
  } catch (error: any) {
    console.error('Failed to save project to database:', error);

    // Check if this is a network/connection error
    const isConnectionError = error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('ERR_CONNECTION_REFUSED') ||
      error?.message?.includes('NetworkError') ||
      error?.name === 'TypeError' ||
      (error?.status === undefined && error?.message?.includes('fetch'));

    if (isConnectionError) {
      // Backend is not available - save to localStorage as fallback
      try {
        secureSetItem(`orbitai_project_${projectId}`, JSON.stringify(project));

        // Also update metadata
        const metaStr = secureGetItem('orbitai_projects_meta');
        const metas = metaStr ? JSON.parse(metaStr) : [];
        const existingIndex = metas.findIndex((p: any) => p.id === projectId);
        const projectMeta = {
          id: projectId,
          name: project.name,
          description: project.description.substring(0, 200),
          lastModified: Date.now(),
          userId: project.userId
        };
        if (existingIndex >= 0) {
          metas[existingIndex] = projectMeta;
        } else {
          metas.push(projectMeta);
        }
        secureSetItem('orbitai_projects_meta', JSON.stringify(metas));

        // Show warning instead of error
        try {
          const { toast } = await import('./toastService');
          toast.warning(
            'Backend unavailable: Project saved to local storage.',
            8000
          );
        } catch (toastError) {
          // Toast service not available
        }

        // Don't throw error - save succeeded locally
        return;
      } catch (localStorageError) {
        console.error('Failed to save to localStorage:', localStorageError);
        // Fall through to show error
      }
    }

    // Show error notification to user
    try {
      const { toast } = await import('./toastService');
      toast.error(`Failed to save project: ${error.message || 'Unknown error'}`, 6000);
    } catch (toastError) {
      // Toast service not available, continue with error
    }
    throw new Error(`Failed to save project: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Create new project in database
 */
export async function createProject(project: ProjectState): Promise<string> {
  requireAuth();

  try {
    const api = await getProjectsApi();
    const apiProject = convertStateToApiProject(project);
    const created = await api.create(apiProject);
    const projectId = created.id || created._id;

    // Update cache
    projectCache.set(projectId, {
      data: { ...project, id: projectId },
      timestamp: Date.now()
    });

    // Invalidate metadata cache
    projectsListCache.data = null;
    projectsListCache.timestamp = 0;

    return projectId;
  } catch (error: any) {
    console.error('Failed to create project in database:', error);
    // Show toast notification to user
    try {
      const { toast } = await import('./toastService');
      toast.error(`Failed to create project: ${error.message || 'Unknown error'}`, 6000);
    } catch (toastError) {
      // Toast service not available, continue with error
    }
    throw new Error(`Failed to create project: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Delete project from database
 */
export async function deleteProject(projectId: string): Promise<void> {
  requireAuth();

  try {
    const api = await getProjectsApi();
    await api.delete(projectId);

    // Remove from cache
    projectCache.delete(projectId);
    // Also remove from not found cache
    notFoundCache.delete(projectId);

    // Invalidate metadata cache
    projectsListCache.data = null;
    projectsListCache.timestamp = 0;
  } catch (error: any) {
    // If project doesn't exist (404), just clear cache - this is fine
    if (error.status === 404 || error.message?.includes('not found')) {
      if (import.meta.env.DEV) {
        // Debug: Reduced console noise
        // console.debug('[Project Storage] Project already deleted (404), clearing cache:', projectId);
      }
      // Remove from cache anyway
      projectCache.delete(projectId);
      // Add to not found cache to prevent future requests
      notFoundCache.set(projectId, Date.now());
      // Invalidate metadata cache
      projectsListCache.data = null;
      projectsListCache.timestamp = 0;
      return; // Success - project is already deleted
    }

    console.error('Failed to delete project from database:', error);
    // Show toast notification to user only for real errors
    try {
      const { toast } = await import('./toastService');
      toast.error(`Failed to delete project: ${error.message || 'Unknown error'}`, 6000);
    } catch (toastError) {
      // Toast service not available, continue with error
    }
    throw new Error(`Failed to delete project: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get current project ID from user settings (database-only for logged-in users)
 * Also verifies project exists in database before returning
 */
export async function getCurrentProjectId(): Promise<string | null> {
  requireAuth();

  try {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    // Skip for guest tokens (not real JWT tokens)
    const isGuestToken = token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3;
    if (isGuestToken) {
      // Guest users use localStorage
      return localStorage.getItem('orbitai_current_project_id') || null;
    }

    const { getUserSettings } = await import('./userSettingsApi');
    const settings = await getUserSettings(token);
    const projectId = settings.currentProjectId || null;

    // Validate ObjectId format
    if (projectId && !isValidObjectId(projectId)) {
      console.warn(`[Project Storage] Invalid currentProjectId in user settings: "${projectId}". Clearing invalid ID.`);
      // Clear invalid ID from user settings
      try {
        const { updateUserSettings } = await import('./userSettingsApi');
        await updateUserSettings(token, { currentProjectId: null });
      } catch (clearError) {
        console.error('Failed to clear invalid currentProjectId:', clearError);
      }
      return null;
    }

    // Verify project exists in database before returning
    if (projectId) {
      try {
        const api = await getProjectsApi();
        const project = await api.getById(projectId);
        if (!project) {
          // Project doesn't exist - clean it
          console.warn(`[Project Storage] Project ${projectId} from user settings does not exist in database. Clearing.`);
          await cleanupProjectIdFromAllSources(projectId);
          return null;
        }
        // Verify ownership
        const currentUserId = localStorage.getItem('userId');
        if (currentUserId && project.userId !== currentUserId) {
          console.warn(`[Project Storage] Project ${projectId} from user settings does not belong to current user. Clearing.`);
          await cleanupProjectIdFromAllSources(projectId);
          return null;
        }
      } catch (error: any) {
        if (error?.status === 404 || error?.isProjectNotFound) {
          console.warn(`[Project Storage] Project ${projectId} from user settings not found (404). Clearing.`);
          await cleanupProjectIdFromAllSources(projectId);
          return null;
        }
        // Other errors - return null to be safe
        return null;
      }
    }

    return projectId;
  } catch (error) {
    console.error('Failed to get current project ID from user settings:', error);
    return null;
  }
}

/**
 * Clear current project ID from all sources (database and localStorage)
 */
export async function clearCurrentProjectId(): Promise<void> {
  const token = localStorage.getItem('authToken');

  // Clear from database (if logged in)
  if (token) {
    try {
      const { updateUserSettings } = await import('./userSettingsApi');
      await updateUserSettings(token, { currentProjectId: null });
    } catch (error) {
      console.warn('Failed to clear currentProjectId from database:', error);
    }
  }

  // Clear from localStorage (for both logged-in and guest users)
  try {
    localStorage.removeItem('orbitai_current_project_id');
  } catch (e) {
    // Ignore localStorage errors
  }

  // Clear from URL
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // Ignore errors
    }
  }
}

/**
 * Set current project ID in user settings
 * Verifies project exists in database before saving
 */
export async function setCurrentProjectId(projectId: string): Promise<void> {
  requireAuth();

  // Validate project ID format before saving
  if (!isValidObjectId(projectId)) {
    console.warn(`[Project Storage] Attempted to set invalid currentProjectId: "${projectId}". Skipping.`);
    return;
  }

  try {
    // Verify project exists in database before saving
    const api = await getProjectsApi();
    const project = await api.getById(projectId);

    if (!project) {
      console.warn(`[Project Storage] Project ${projectId} does not exist in database. Cannot set as current project.`);
      // Clean up invalid ID from all sources
      await cleanupProjectIdFromAllSources(projectId);
      return;
    }

    // Verify project belongs to current user
    const token = localStorage.getItem('authToken');
    const currentUserId = localStorage.getItem('userId');
    if (currentUserId && project.userId !== currentUserId) {
      console.warn(`[Project Storage] Project ${projectId} does not belong to current user. Cannot set as current project.`);
      // Clean up invalid ID from all sources
      await cleanupProjectIdFromAllSources(projectId);
      return;
    }

    // Project exists and belongs to user - save to database
    const { updateUserSettings } = await import('./userSettingsApi');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    await updateUserSettings(token, { currentProjectId: projectId });

    // Remove from localStorage (database-only for logged-in users)
    try {
      localStorage.removeItem('orbitai_current_project_id');
    } catch (e) {
      // Ignore localStorage errors
    }
  } catch (error: any) {
    // If 404, project doesn't exist - clean it
    if (error?.status === 404 || error?.isProjectNotFound) {
      console.warn(`[Project Storage] Project ${projectId} not found (404). Cannot set as current project.`);
      await cleanupProjectIdFromAllSources(projectId);
      return;
    }
    console.error('Failed to set current project ID in user settings:', error);
    throw error;
  }
}

/**
 * Clean up a specific project ID from all storage sources (URL, localStorage, user settings)
 * Called when a project is found to not exist (404) or is deleted
 */
/**
 * Clean up a specific project ID from all storage sources
 * Removes from URL, localStorage, user settings, and project data
 */
export async function cleanupProjectIdFromAllSources(projectId: string): Promise<void> {
  if (!projectId || !isValidObjectId(projectId)) {
    return; // Only clean valid ObjectIds
  }

  // Add to "not found" cache immediately to prevent any future requests
  notFoundCache.set(projectId, Date.now());

  // Clean from URL immediately (synchronously)
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('project') === projectId) {
        url.searchParams.delete('project');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // Clean from localStorage immediately (synchronously)
  try {
    const storedId = localStorage.getItem('orbitai_current_project_id');
    if (storedId === projectId) {
      localStorage.removeItem('orbitai_current_project_id');
    }
    // Also remove project data and metadata from localStorage
    // Also remove project data and metadata from localStorage
    secureRemoveItem(`orbitai_project_${projectId}`);
    secureRemoveItem(`project_metadata_${projectId}`);
  } catch (e) {
    // Ignore localStorage errors (might be in private mode)
  }

  // Clean from user settings (if authenticated) - async but non-blocking
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Skip for guest tokens (not real JWT tokens)
      const isGuestToken = token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3;
      if (!isGuestToken) {
        const { getUserSettings, updateUserSettings } = await import('./userSettingsApi');
        const settings = await getUserSettings(token);
        if (settings.currentProjectId === projectId) {
          await updateUserSettings(token, { currentProjectId: null });
        }
      }
    }
  } catch (e: any) {
    // Silently fail - user might not be logged in, API might not be available, or it's a guest user error
    if (!(e as any).isGuestError) {
      // Only log if it's not a guest user error
    }
  }

  // Also clear from project cache if it exists
  projectCache.delete(projectId);
}

/**
 * Cleanup invalid project IDs from all sources (URL, localStorage, user settings)
 * Verifies ALL project IDs exist in database and removes any that don't
 * For logged-in users: removes localStorage completely (database-only)
 * Ensures project IDs ONLY come from database, never hardcoded
 * Call this on app initialization to prevent invalid IDs from causing issues
 */
export async function cleanupInvalidProjectIds(): Promise<void> {
  const token = localStorage.getItem('authToken');
  const isLoggedIn = !!token;
  const projectsToCheck: Array<{ source: string; id: string }> = [];

  // STEP 1: Always remove localStorage for logged-in users (database-only)
  if (isLoggedIn) {
    try {
      const localStorageProjectId = localStorage.getItem('orbitai_current_project_id');
      if (localStorageProjectId) {
        console.debug(`[Project Storage] Removing project ID from localStorage (logged-in users use database-only): "${localStorageProjectId}"`);
        localStorage.removeItem('orbitai_current_project_id');
      }
      // Also remove any other localStorage project-related keys
      const keysToRemove = ['currentProjectId', 'orbitai_project_id', 'project_id'];
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  // STEP 2: Collect and validate project IDs from URL
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get('project');
    if (urlProjectId) {
      if (!isValidObjectId(urlProjectId)) {
        // Invalid format - clean immediately
        console.debug(`[Project Storage] Cleaning invalid project ID from URL: "${urlProjectId}"`);
        urlParams.delete('project');
        const newUrl = new URL(window.location.href);
        newUrl.search = urlParams.toString();
        window.history.replaceState({}, '', newUrl.toString());
      } else {
        projectsToCheck.push({ source: 'URL', id: urlProjectId });
      }
    }
  }

  // STEP 3: Collect project IDs from localStorage (only for guest users)
  if (!isLoggedIn) {
    try {
      const localStorageProjectId = localStorage.getItem('orbitai_current_project_id');
      if (localStorageProjectId) {
        if (!isValidObjectId(localStorageProjectId)) {
          console.debug(`[Project Storage] Cleaning invalid project ID from localStorage: "${localStorageProjectId}"`);
          localStorage.removeItem('orbitai_current_project_id');
        } else {
          projectsToCheck.push({ source: 'localStorage', id: localStorageProjectId });
        }
      }
    } catch (e) {
      // Ignore localStorage errors (might be in private mode)
    }
  }

  // STEP 4: Collect project IDs from user settings (database - only source for logged-in users)
  if (token) {
    // Skip for guest tokens (not real JWT tokens)
    const isGuestToken = token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3;
    if (!isGuestToken) {
      try {
        const { getUserSettings } = await import('./userSettingsApi');
        const settings = await getUserSettings(token);
        if (settings.currentProjectId) {
          if (!isValidObjectId(settings.currentProjectId)) {
            // Invalid format - clean immediately
            console.debug(`[Project Storage] Cleaning invalid project ID from user settings: "${settings.currentProjectId}"`);
            const { updateUserSettings } = await import('./userSettingsApi');
            await updateUserSettings(token, { currentProjectId: null });
          } else {
            projectsToCheck.push({ source: 'userSettings', id: settings.currentProjectId });
          }
        }
      } catch (error: any) {
        // Silently fail for guest errors or if user might not be logged in or API might not be available
        if (!error.isGuestError) {
          // Only log if it's not a guest user error
        }
      }
    }
  }

  // STEP 5: Verify ALL project IDs exist in database and belong to current user
  // This ensures ONLY valid projects from database are kept
  if (token && projectsToCheck.length > 0) {
    try {
      const api = await getProjectsApi();
      const uniqueIds = [...new Set(projectsToCheck.map(p => p.id))];
      const currentUserId = localStorage.getItem('userId');

      // Check each unique project ID against database
      for (const projectId of uniqueIds) {
        try {
          const project = await api.getById(projectId);
          if (!project) {
            // Project doesn't exist in database - clean from ALL sources
            console.debug(`[Project Storage] Project ${projectId} not found in database, cleaning from all sources`);
            await cleanupProjectIdFromAllSources(projectId);
          } else {
            // Project exists - verify it belongs to current user
            if (currentUserId && project.userId !== currentUserId) {
              // Project belongs to different user - clean it from ALL sources
              console.debug(`[Project Storage] Project ${projectId} belongs to different user, cleaning from all sources`);
              await cleanupProjectIdFromAllSources(projectId);
            }
            // Project exists and belongs to user - keep it (it's valid)
          }
        } catch (error: any) {
          // If 404 or any error, project doesn't exist - clean it
          if (error?.status === 404 || error?.isProjectNotFound) {
            console.debug(`[Project Storage] Project ${projectId} not found (404), cleaning from all sources`);
            await cleanupProjectIdFromAllSources(projectId);
          } else {
            // Other errors - still clean to be safe
            console.debug(`[Project Storage] Error checking project ${projectId}, cleaning from all sources:`, error.message);
            await cleanupProjectIdFromAllSources(projectId);
          }
        }
      }
    } catch (error) {
      // Silently fail - API might not be available
      if (import.meta.env.DEV) {
        console.debug('[Project Storage] Could not verify project existence:', error);
      }
    }
  } else if (!token && projectsToCheck.length > 0) {
    // Guest users: can't verify against database, but we've already validated format
    // These will be validated when user logs in
    console.debug(`[Project Storage] Guest user - ${projectsToCheck.length} project ID(s) validated format but not verified against database`);
  }

  // STEP 6: Clean up stale project data from localStorage
  // For logged-in users: remove all localStorage project data (database-only)
  // For guest users: validate and clean up invalid project data
  try {
    if (isLoggedIn) {
      // Logged-in users: remove all localStorage project data (use database only)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('orbitai_project_') ||
          key.startsWith('project_metadata_') ||
          key === 'orbitai_projects_meta'
        )) {
          keysToRemove.push(key);
        }
      }
      if (keysToRemove.length > 0) {
        console.debug(`[Project Storage] Cleaning ${keysToRemove.length} localStorage project data entries for logged-in user`);
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } else {
      // Guest users: validate project IDs in localStorage and clean up invalid ones
      const projectKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('orbitai_project_')) {
          const projectId = key.replace('orbitai_project_', '');
          if (!isValidObjectId(projectId)) {
            // Invalid format - remove it
            console.debug(`[Project Storage] Cleaning invalid project data from localStorage: ${key}`);
            localStorage.removeItem(key);
            // Also remove associated metadata
            localStorage.removeItem(`project_metadata_${projectId}`);
          } else {
            projectKeys.push(projectId);
          }
        }
      }

      // Clean up metadata for projects that no longer exist in localStorage
      try {
        const metaStr = localStorage.getItem('orbitai_projects_meta');
        if (metaStr) {
          const metas = JSON.parse(metaStr);
          const validMetas = metas.filter((meta: any) => {
            if (!isValidObjectId(meta.id)) {
              return false; // Remove invalid IDs
            }
            // Keep if project data exists in localStorage
            return projectKeys.includes(meta.id);
          });

          if (validMetas.length !== metas.length) {
            console.debug(`[Project Storage] Cleaning ${metas.length - validMetas.length} stale project metadata entries`);
            if (validMetas.length > 0) {
              localStorage.setItem('orbitai_projects_meta', JSON.stringify(validMetas));
            } else {
              localStorage.removeItem('orbitai_projects_meta');
            }
          }
        }
      } catch (e) {
        // Invalid metadata - remove it
        localStorage.removeItem('orbitai_projects_meta');
      }
    }
  } catch (e) {
    // Ignore localStorage errors (might be in private mode)
    if (import.meta.env.DEV) {
      console.debug('[Project Storage] Error cleaning localStorage:', e);
    }
  }
}

/**
 * Convert API project format to ProjectState
 */
function convertApiProjectToState(apiProject: any): ProjectState {
  return {
    id: apiProject.id || apiProject._id,
    name: apiProject.name,
    description: apiProject.description || '',
    created: apiProject.created ? new Date(apiProject.created).getTime() : Date.now(),
    lastModified: new Date(apiProject.lastModified || apiProject.updatedAt || Date.now()).getTime(),
    userId: apiProject.userId,
    currentPhase: apiProject.currentPhase || apiProject.phase || 'requirements',
    methodology: apiProject.methodology || 'V-Model',
    // Ensure estimatedSprints is always a number (never null/undefined)
    estimatedSprints: apiProject.estimatedSprints != null ? apiProject.estimatedSprints : 7,
    // Ensure currentSprint is always a number (never null/undefined)
    currentSprint: apiProject.currentSprint != null ? apiProject.currentSprint : 1,
    agents: apiProject.agents || [],
    tasks: apiProject.tasks || [],
    artifacts: apiProject.artifacts || [],
    logs: apiProject.logs || [],
    selectedStandards: apiProject.selectedStandards || [],
    useInternet: apiProject.useInternet || false,
    selectedTheme: apiProject.selectedTheme || 'modern',
    budget: apiProject.budget || { total: 100, used: 0, totalTokens: 0, currency: 'USD', lastUpdated: Date.now() },
    mcpServers: mergeMCPServers(apiProject.mcpServers || []),
    isProcessing: false,
    architecture: apiProject.architecture || undefined, // Include architecture requirements
    techStack: apiProject.techStack || [],
    folderId: apiProject.folderId,
  };
}

/**
 * Merge default MCP servers with project-specific servers
 * Ensures default system servers are always available and have status: 'active'
 */
function mergeMCPServers(projectServers: any[]): any[] {
  // Start with default system servers (ensure they have status: 'active')
  const merged = DEFAULT_MCP_SERVERS.map(server => ({
    ...server,
    status: 'active' // Ensure status is always 'active' for defaults
  }));

  // Add project-specific servers (excluding duplicates by ID)
  const defaultIds = new Set(DEFAULT_MCP_SERVERS.map(s => s.id));
  projectServers.forEach(server => {
    if (server && server.id && !defaultIds.has(server.id)) {
      // Ensure project servers have status field
      merged.push({
        ...server,
        status: server.status || 'active' // Default to 'active' if missing
      });
    }
  });

  return merged;
}

/**
 * Convert ProjectState to API project format
 */
function convertStateToApiProject(state: ProjectState): any {
  // Ensure MCP servers include defaults before saving
  const mcpServersToSave = mergeMCPServers(state.mcpServers || []);

  // Explicitly build the object without phase field to ensure it's never included
  const result: any = {
    name: state.name,
    description: state.description,
    currentPhase: state.currentPhase || 'Initiation', // Ensure never null/undefined
    methodology: state.methodology || 'V-Model',
    // CRITICAL: Ensure estimatedSprints is always a number (never null/undefined)
    estimatedSprints: state.estimatedSprints != null ? state.estimatedSprints : 7,
    // CRITICAL: Ensure currentSprint is always a number (never null/undefined)
    currentSprint: state.currentSprint != null ? state.currentSprint : 1,
    agents: state.agents || [],
    tasks: state.tasks || [],
    artifacts: state.artifacts || [],
    logs: state.logs || [],
    selectedStandards: state.selectedStandards || [],
    useInternet: state.useInternet || false,
    selectedTheme: state.selectedTheme || 'modern',
    budget: state.budget || { cap: 1000, spent: 0 },
    mcpServers: mcpServersToSave, // Ensure defaults are always saved
    lastModified: new Date(state.lastModified || Date.now()).toISOString(),
    architecture: state.architecture || undefined, // Include architecture requirements
    folderId: state.folderId,
    techStack: state.techStack || [],
  };

  // Explicitly remove phase if it somehow got added
  delete result.phase;

  return result;
}

/**
 * Clear "not found" cache for a project (e.g., when project is created)
 */
export function clearNotFoundCache(projectId: string): void {
  notFoundCache.delete(projectId);
}

/**
 * Check if a project ID is in the "not found" cache
 */
export function isProjectNotFound(projectId: string): boolean {
  // Always return false in dev/debugging mode to prevent page resets
  // The actual 404 handling should be done gracefully in the UI, not by nuclear resets
  return false;
  /*
  if (!projectId) return false;
  const timestamp = notFoundCache.get(projectId);
  if (!timestamp) return false;
  return (Date.now() - timestamp) < NOT_FOUND_CACHE_DURATION;
  */
}

export const projectStorage = {
  getMetadataList: getProjectMetadataList,
  getProject,
  saveProject,
  createProject,
  deleteProject,
  getCurrentProjectId,
  setCurrentProjectId,
  clearCurrentProjectId,
  cleanupInvalidProjectIds,
  clearNotFoundCache,
  isProjectNotFound,
  updateProjectCache,
};
