import { useEffect, startTransition } from 'react';
import React from 'react';
import { TaskStatus, AgentRole, AGENTS, INITIAL_PROJECT_NAME, ProjectState, ProjectMetadata } from '@orbitai/shared';
import { projectsApi } from '@src/services/api';
import { projectStorage, isValidObjectId, isProjectNotFound, cleanupProjectIdFromAllSources, cleanupInvalidProjectIds } from '../services/projectStorage';
import { generateQuickSuggestions } from '../services/geminiService';
import { Sparkles } from 'lucide-react';
import { hasCompletedTutorial } from '../components/WorkspaceTutorial';

export interface AppEffectDeps {
  // All state variables that effects need
  user: any;
  userRole: string;
  state: any;
  stateRef: React.MutableRefObject<any>;
  dispatch: React.Dispatch<any>;
  appSettings: any;
  settingsRef: React.MutableRefObject<any>;
  autoPilotStatus: any;
  autoPilotStatusRef: React.MutableRefObject<any>;
  isStoppingRef: React.MutableRefObject<boolean>;
  isBatchingRef: React.MutableRefObject<boolean>;
  batchIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  activeTaskControllersRef: React.MutableRefObject<Map<string, AbortController>>;
  previousUserRoleRef: React.MutableRefObject<string>;
  hasClearedCacheRef: React.MutableRefObject<boolean>;
  hasRefreshedRoleRef: React.MutableRefObject<boolean>;
  viewModeRef: React.MutableRefObject<any>;
  userRef: React.MutableRefObject<any>;
  isManuallyLoadingProjectRef: React.MutableRefObject<boolean>;
  prevViewModeRef: React.MutableRefObject<any>;

  // State setters
  setIsOffline: (v: boolean) => void;
  setAutoPilotStatus: (s: any) => void;
  setIsRestoring: (v: boolean) => void;
  setViewMode: (m: any) => void;
  setSelectedTheme: (id: string) => void;
  setIsLogsCollapsed: (v: boolean) => void;
  setLogHeight: (h: number) => void;
  setIsResizingLeft: (v: boolean) => void;
  setIsResizingLogs: (v: boolean) => void;
  setLeftWidth: (w: number) => void;
  setActiveTab: (t: string) => void;
  setLeftTab: (t: string) => void;
  setDynamicSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  setDisplayedSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  setIsGeneratingSuggestions: (v: boolean) => void;
  setSetupMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setShowWorkspaceTutorial: (v: boolean) => void;

  // Feature flags
  canUseAISuggestions: { enabled: boolean; loading: boolean };
  canUseCodeEditor: { enabled: boolean; loading: boolean };
  canUseArtifactViewer: { enabled: boolean; loading: boolean };
  canUseAIChat: { enabled: boolean; loading: boolean };
  shouldShowFeature: (f: { enabled: boolean; loading: boolean } | undefined) => boolean;

  // UI state
  isResizingLeft: boolean;
  isResizingLogs: boolean;
  leftTab: string;
  activeTab: string;
  setupInput: string;
  setupMessages: any[];
  viewMode: any;
  setupStage: string;
  globalMessages: any[];
  setupEndRef: React.RefObject<HTMLDivElement>;
  globalChatEndRef: React.RefObject<HTMLDivElement>;
  dynamicSuggestions: any[];

  // Functions
  saveProject: () => Promise<void>;
  handleLoadSharedProject: (projectId: string, token: string) => Promise<void>;
  debouncedSaveProject: () => void;
  addLog: (msg: string, agent: any, type?: any, taskId?: string) => void;
  updateUser: (update: any) => void;
  updatePreference: (key: string, value: any) => void;

  // Other
  hasLoaded: boolean;
  showWorkspaceTutorial: boolean;
  saveProjectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setupInputRef: React.RefObject<HTMLTextAreaElement>;
}

export function useAppEffects(deps: AppEffectDeps): void {
  // Effect 1: Reload loop detection (lines 66-112) - deps []
  useEffect(() => {
    const reloadCount = sessionStorage.getItem('app_reload_count') || '0';
    const reloadTime = sessionStorage.getItem('app_reload_time') || '0';
    const now = Date.now();

    // If we've reloaded more than 3 times in 5 seconds, stop
    if (parseInt(reloadCount) > 3 && (now - parseInt(reloadTime)) < 5000) {
      console.error('🚨 RELOAD LOOP DETECTED - Stopping app to prevent infinite reload');
      sessionStorage.setItem('app_reload_count', '0');
      sessionStorage.setItem('app_reload_time', '0');
      // Show error message
      const root = document.getElementById('root');
      if (root) {
        root.innerHTML = `
          <div style="padding: 50px; text-align: center; font-family: sans-serif;">
            <h1 style="color: #dc2626;">⚠️ Reload Loop Detected</h1>
            <p>Please clear your browser cache and service workers:</p>
            <ol style="text-align: left; max-width: 600px; margin: 20px auto;">
              <li>Open DevTools (F12)</li>
              <li>Go to Application → Service Workers → Unregister all</li>
              <li>Go to Application → Clear storage → Clear site data</li>
              <li>Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)</li>
            </ol>
            <button onclick="location.reload()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Try Again
            </button>
          </div>
        `;
      }
      return;
    }

    // Increment reload count
    const newCount = parseInt(reloadCount) + 1;
    sessionStorage.setItem('app_reload_count', newCount.toString());
    sessionStorage.setItem('app_reload_time', now.toString());

    // Reset after 5 seconds
    setTimeout(() => {
      sessionStorage.setItem('app_reload_count', '0');
    }, 5000);

    // Diagnostic logging
    if (newCount > 1) {
      console.warn(`⚠️ App mounted ${newCount} times - possible reload loop`);
    }
  }, []);

  // Effect 3: refreshUserRole (lines 294-341) - deps [deps.user?.email]
  useEffect(() => {
    const refreshUserRole = async () => {
      // Only refresh once per email change, and only if role is missing
      if (!deps.user || deps.user.role || deps.hasRefreshedRoleRef.current) {
        return;
      }

      deps.hasRefreshedRoleRef.current = true;

      try {
        // Try to get role from admin API
        const adminToken = localStorage.getItem('admin_token');
        if (adminToken && deps.user.email) {
          const { getUsers } = await import('../services/adminApi');
          const response = await getUsers(adminToken);
          const adminUser = response.users.find((u: any) => u.email === deps.user.email);
          if (adminUser && adminUser.role) {
            const roleStr = adminUser.role.toLowerCase().trim();
            const role = (['user', 'admin', 'editor', 'superadmin'].includes(roleStr) ? roleStr : 'user') as 'user' | 'admin' | 'editor' | 'superadmin';
            const updatedUser = { ...deps.user, role };
            deps.updateUser({ role });
            // Save user preferences to database if user is logged in
            if (deps.user?.token) {
              try {
                await deps.updatePreference('selectedTheme', updatedUser.selectedTheme);
                if (updatedUser.theme) {
                  await deps.updatePreference('theme', updatedUser.theme);
                }
              } catch (dbError) {
                console.warn('Failed to save preferences to database:', dbError);
              }
            }
            // Keep localStorage as fallback
            localStorage.setItem('orbitai_user', JSON.stringify(updatedUser));
            console.log('[Refresh Role] User role updated from admin API:', adminUser.role);
          }
        }
      } catch (e) {
        console.warn('Failed to refresh user role from admin API', e);
        deps.hasRefreshedRoleRef.current = false; // Allow retry on error
      }
    };

    refreshUserRole();
  }, [deps.user?.email]); // Only run when user email changes

  // Effect 4: Reset refresh flag when email changes
  useEffect(() => {
    deps.hasRefreshedRoleRef.current = false;
  }, [deps.user?.email]);

  // Effect 5: cleanupInvalidProjectIds (lines 347-383) - deps [deps.user?.id]
  useEffect(() => {
    const performCleanup = async () => {
      try {
        // Clean up invalid project IDs from all sources (URL, localStorage, user settings)
        // This prevents the "Project not found" warning by removing invalid IDs before they're used
        await cleanupInvalidProjectIds();

        // Also check URL and clean up immediately if project doesn't exist
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project');
        if (urlProjectId && isValidObjectId(urlProjectId)) {
          // Verify project exists before allowing it to be loaded
          try {
            const dbProject = await projectsApi.getById(urlProjectId);
            if (!dbProject) {
              // Project doesn't exist - clean up immediately
              await cleanupProjectIdFromAllSources(urlProjectId);
            }
          } catch (error) {
            // Silently ignore - cleanup will handle it
          }
        }
      } catch (error) {
        // Silently fail - cleanup is non-critical
        if (import.meta.env.DEV) {
          console.debug('[App] Project ID cleanup error (non-critical):', error);
        }
      }
    };

    // Run cleanup on mount or when user logs in
    // This MUST run before the project loading useEffect below
    performCleanup();
  }, [deps.user?.id]);

  // Effect 6: Cache clearing on role change (lines 398-420)
  useEffect(() => {
    // Clear cache when:
    // 1. User logs in (transitions from 'public' to actual role)
    // 2. User role changes
    // 3. User object loads after initial render (to clear any 'public' cache from initial load)
    const shouldClearCache =
      (deps.user && deps.user.role && deps.userRole !== 'public' && deps.previousUserRoleRef.current !== deps.userRole) ||
      (deps.user && deps.user.role && deps.userRole !== 'public' && !deps.hasClearedCacheRef.current);

    if (shouldClearCache) {
      deps.previousUserRoleRef.current = deps.userRole;
      deps.hasClearedCacheRef.current = true;
      // User just logged in or role changed - clear old 'public' cache entries
      import('../services/featureAccess').then(({ clearFeatureCache }) => {
        clearFeatureCache();
        if (import.meta.env.DEV) {
          console.log('[App] Cleared feature cache - user role:', deps.userRole);
        }
      });
    }

    // Reset flag when user logs out
    if (!deps.user || !deps.user.role) {
      deps.hasClearedCacheRef.current = false;
    }
  }, [deps.userRole, deps.user?.role, deps.user?.id]);

  // Effect 7: WebSocket listener (lines 421-503)
  useEffect(() => {
    // Only set up WebSocket listener if socket.io is available
    let socket: any = null;

    const setupWebSocket = async () => {
      try {
        // Delay WebSocket connection slightly to not block initial render
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Dynamically import socket.io-client only if needed
        const { io } = await import('socket.io-client');
        // Ensure we have a proper URL - socket.io-client needs a full URL
        // Import the normalizer to ensure port 3002
        const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
        let API_BASE_URL = getApiBaseUrl();

        // Ensure URL is properly formatted (no trailing slash, has protocol)
        API_BASE_URL = API_BASE_URL.trim().replace(/\/$/, '');
        if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
          API_BASE_URL = 'http://' + API_BASE_URL;
        }

        socket = io(API_BASE_URL, {
          transports: ['polling', 'websocket'], // Try polling first, then websocket
          reconnection: false, // Disable automatic reconnection to prevent console spam
          reconnectionDelay: 5000,
          reconnectionDelayMax: 10000,
          reconnectionAttempts: 1, // Only try once
          timeout: 5000, // Fail fast
          forceNew: false,
          upgrade: false, // Disable automatic upgrade to prevent multiple connection attempts
          autoConnect: false // Don't auto-connect - only connect when needed
        });

        // Only attempt connection if backend might be available
        // This prevents constant failed connection attempts
        socket.connect();

        socket.on('connect', () => {
          if (import.meta.env.DEV) {
            console.log('[WebSocket] Connected for feature flag updates');
          }
        });

        socket.on('connect_error', (error: any) => {
          // Completely silent - backend is not running or WebSocket not ready, this is expected
          // Feature flags will work without WebSocket
          // Don't log anything to avoid console noise
          // Suppress the error from appearing in console
          if (error.message) {
            // Prevent default error logging
            error.preventDefault = () => { };
          }
        });

        socket.on('broadcast', (message: { type: string; featureKey?: string; message?: string }) => {
          if (import.meta.env.DEV) {
            console.log('[WebSocket] Received broadcast:', message);
          }
          if (message.type === 'feature_flag_updated') {
            // Clear feature flag cache when flags are updated
            import('../services/featureAccess').then(({ clearFeatureCache, clearFeatureCacheForKey }) => {
              if (message.featureKey) {
                clearFeatureCacheForKey(message.featureKey);
              } else {
                clearFeatureCache();
              }
              // Trigger refresh of all useFeatureAccess hooks
              // Throttle to prevent rapid-fire updates
              const lastRefresh = sessionStorage.getItem('last_feature_refresh') || '0';
              const now = Date.now();
              if ((now - parseInt(lastRefresh)) > 500) { // Throttle to max once per 500ms
                sessionStorage.setItem('last_feature_refresh', now.toString());
                import('../hooks/useFeatureAccess').then(({ triggerFeatureRefresh }) => {
                  triggerFeatureRefresh();
                });
              }
            });
          }
        });

        socket.on('disconnect', () => {
          if (import.meta.env.DEV) {
            console.log('[WebSocket] Disconnected');
          }
        });
      } catch (error) {
        // Socket.io not available or failed to connect - that's okay
        // Feature flags will still work, just without real-time updates
        if (import.meta.env.DEV) {
          console.debug('[WebSocket] Not available for feature flag updates');
        }
      }
    };

    setupWebSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []); // Only run once on mount

  // Effect 8: superadmin debug log (lines 505-509)
  useEffect(() => {
    if (deps.userRole === 'superadmin' && (import.meta as any).env?.DEV) {
      // Debug: Reduced console noise
      // console.debug('[App] Superadmin detected - role:', deps.userRole);
    }
  }, [deps.userRole]);

  // Effect 9: isOffline detection (lines 654-660)
  useEffect(() => {
    const handleOnline = () => deps.setIsOffline(false);
    const handleOffline = () => deps.setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Effect 10: Initialize feature flags (lines 730-760)
  useEffect(() => {
    const initFeatureFlags = async () => {
      try {
        const { initializeFeatureFlags } = await import('../services/featureFlagAdapter');
        await initializeFeatureFlags({
          providerType: (import.meta.env.VITE_FEATURE_FLAG_PROVIDER as 'custom' | 'flagsmith' | 'hybrid') || 'custom',
          flagsmith: {
            environmentId: import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID || '',
            apiUrl: import.meta.env.VITE_FLAGSMITH_API_URL
          }
        });
        if (import.meta.env.DEV) {
          // Debug: Reduced console noise
          // console.log('[Feature Flags] Adapter initialized');
        }
      } catch (error) {
        console.warn('[Feature Flags] Failed to initialize adapter, using default:', error);
      }
    };
    initFeatureFlags();
  }, []);

  // Effect 11: viewModeRef sync
  useEffect(() => {
    deps.viewModeRef.current = deps.viewMode;
  }, [deps.viewMode]);

  // Effect 12: userRef sync
  useEffect(() => {
    deps.userRef.current = deps.user;
  }, [deps.user]);

  // Effect 13: Big "shared project / workspace restore" effect (lines 862-1333)
  useEffect(() => {
    const checkShareLink = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const fullPath = path + (hash ? hash : '');

      // Try both /share/ and #/share/ patterns
      const shareMatch = path.match(/^\/share\/([^/]+)\/([^/]+)$/) ||
        fullPath.match(/\/share\/([^/]+)\/([^/]+)/);

      if (shareMatch) {
        const projectId = shareMatch[1];
        const token = shareMatch[2];
        console.log('Share link detected in URL:', { projectId, token });

        // Load shared project - this will set viewMode to 'workspace' if successful
        deps.handleLoadSharedProject(projectId, token);
        return true; // Indicate we handled a share link
      }
      return false;
    };

    // Check immediately - this must run before any other initialization
    const isShareLink = checkShareLink();

    // Only load user/auth if NOT a share link
    if (!isShareLink) {
      // AuthContext now handles user initialization automatically
      // No need to manually load from localStorage here
    }

    // Also listen for popstate events (back/forward navigation)
    const handlePopState = () => {
      checkShareLink();
    };

    // Listen for hash changes (for SPA routing)
    // P1 FIX: Removed duplicate view mode switching - useViewMode hook is now single source of truth
    // This handler only checks for share links and triggers project restoration on #workspace
    const handleHashChange = () => {
      // Check for share link first (takes priority)
      const isShareLink = checkShareLink();

      // If #workspace hash and not a share link, may need to restore project
      // View mode switching is handled by useViewMode hook
      if (!isShareLink && window.location.hash === '#workspace') {
        // Project restoration will be handled by the effect below
        // No need to duplicate view mode switching here
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);

    // Check hash on initial load only if not a share link
    if (!isShareLink) {
      handleHashChange();

      // If workspace hash is present, try to restore the current project
      if (window.location.hash === '#workspace') {
        // Skip auto-restore if we're manually loading a project
        if (deps.isManuallyLoadingProjectRef.current) {
          console.log('[Project Load] Skipping auto-restore - manual load in progress');
          return;
        }

        // Skip auto-restore if project is already loaded and matches URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project');
        if (urlProjectId && deps.stateRef.current.id === urlProjectId && deps.stateRef.current.name !== INITIAL_PROJECT_NAME) {
          console.log('[Project Load] Skipping auto-restore - project already loaded:', urlProjectId);
          return;
        }

        // Restore immediately without delay to prevent flickering
        // Wrap in startTransition to fix React Suspense error
        startTransition(() => {
          (async () => {
            try {
              deps.setIsRestoring(true);
              // First, check URL for project ID (most reliable)
              // Validate the project ID from URL - must be a valid MongoDB ObjectId
              let currentProjectId: string | null = urlProjectId && isValidObjectId(urlProjectId) ? urlProjectId : null;

              // If URL has invalid project ID, clear it
              if (urlProjectId && !currentProjectId) {
                console.warn('[Project Load] Invalid project ID in URL, clearing:', urlProjectId);
                const url = new URL(window.location.href);
                url.searchParams.delete('project');
                window.history.replaceState({}, '', url.toString());
              }

              const currentUserId = deps.userRef.current?.id;
              const userToken = deps.userRef.current?.token;

              // If not in URL, try database (if user is logged in)
              if (!currentProjectId && userToken && currentUserId) {
                try {
                  const { getUserSettings } = await import('../services/userSettingsApi');
                  const settings = await getUserSettings(userToken);
                  if (settings.currentProjectId && isValidObjectId(settings.currentProjectId)) {
                    currentProjectId = settings.currentProjectId;
                    // Update URL to include project ID
                    const url = new URL(window.location.href);
                    url.searchParams.set('project', currentProjectId);
                    window.history.replaceState({}, '', url.toString());
                  } else if (settings.currentProjectId) {
                    console.warn('[Project Load] Invalid project ID in user settings, ignoring:', settings.currentProjectId);
                  }
                } catch (dbError) {
                  console.warn('Failed to load currentProjectId from database, falling back to localStorage:', dbError);
                }
              }

              // For logged-in users: ONLY use database (no localStorage fallback)
              // For guest users: can use localStorage as fallback
              if (!currentProjectId && !userToken) {
                // Guest users: try localStorage as fallback
                try {
                  const localStorageProjectId = localStorage.getItem('orbitai_current_project_id');
                  if (localStorageProjectId && isValidObjectId(localStorageProjectId)) {
                    currentProjectId = localStorageProjectId;
                    // Update URL to include project ID
                    const url = new URL(window.location.href);
                    url.searchParams.set('project', currentProjectId);
                    window.history.replaceState({}, '', url.toString());
                  } else if (localStorageProjectId) {
                    // Clear invalid project ID from localStorage
                    console.warn('[Project Load] Invalid project ID in localStorage, clearing:', localStorageProjectId);
                    localStorage.removeItem('orbitai_current_project_id');
                  }
                } catch (e) {
                  // Ignore localStorage errors
                }
              }

              let projectToLoad: ProjectMetadata | null = null;
              let projectDataToLoad: string | null = null;

              if (currentProjectId) {
                // Check "not found" cache FIRST to prevent unnecessary API requests
                if (isProjectNotFound(currentProjectId)) {
                  // Project was recently confirmed as not found - clean up immediately
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('project');
                    window.history.replaceState({}, '', url.toString());
                    await cleanupProjectIdFromAllSources(currentProjectId);
                  } catch (cleanupError) {
                    // Silently ignore cleanup errors
                  }
                  currentProjectId = null;
                  deps.setIsRestoring(false);
                  startTransition(() => {
                    deps.setViewMode('setup');
                  });
                  window.location.hash = '#setup';
                  return; // Exit early - don't make API request
                }

                // For logged-in users: ONLY load from database (verify it exists)
                if (userToken && currentUserId) {
                  try {
                    // Suppress 404 errors for project loading - this is expected when project doesn't exist
                    const dbProject = await projectsApi.getById(currentProjectId);

                    // Handle 404 (project not found) - getById returns null for 404s
                    // This is expected behavior when projects are deleted - clean up silently
                    if (!dbProject) {
                      // Project doesn't exist - clean up immediately and prevent retries
                      // This is normal when projects are deleted or IDs are invalid
                      if (currentProjectId) {
                        try {
                          // Clean up synchronously from URL first to prevent retries
                          const url = new URL(window.location.href);
                          url.searchParams.delete('project');
                          window.history.replaceState({}, '', url.toString());
                          // Then clean up from all other sources
                          await cleanupProjectIdFromAllSources(currentProjectId);
                        } catch (cleanupError) {
                          // Silently ignore cleanup errors
                        }
                      }
                      currentProjectId = null;
                      // Redirect to hub silently (no warning - this is expected behavior)
                      deps.setIsRestoring(false);
                      startTransition(() => {
                        deps.setViewMode('setup');
                      });
                      window.location.hash = '#setup';
                      return; // Exit early - don't try to load again
                    }

                    // Verify ownership: only load if it's the user's project (not sample projects or other users' projects)
                    if (dbProject && dbProject.userId === currentUserId && !dbProject.isSample) {
                      projectDataToLoad = JSON.stringify(dbProject);
                      projectToLoad = {
                        id: dbProject._id || dbProject.id,
                        name: dbProject.name,
                        lastModified: new Date(dbProject.lastModified || dbProject.updatedAt || Date.now()).getTime(),
                        description: (dbProject.description || "").substring(0, 100),
                        phase: dbProject.currentPhase || 'Initiation',
                        userId: dbProject.userId
                      };
                    } else if (dbProject && (dbProject.userId !== currentUserId || dbProject.isSample)) {
                      // Project doesn't belong to user or is a sample - clean up silently
                      await cleanupProjectIdFromAllSources(currentProjectId);
                      currentProjectId = null;
                      // Redirect to hub silently (no warning - this is expected behavior)
                      deps.setIsRestoring(false);
                      startTransition(() => {
                        deps.setViewMode('setup');
                      });
                      window.location.hash = '#setup';
                      return; // Exit early
                    }
                  } catch (dbError: any) {
                    // Handle any other errors (but suppress 404s - they're expected)
                    if (dbError?.status !== 404 && !dbError?.isProjectNotFound) {
                      console.error('Failed to load project from database:', dbError);
                    }
                    // Clear project ID from URL on error
                    const url = new URL(window.location.href);
                    url.searchParams.delete('project');
                    window.history.replaceState({}, '', url.toString());
                    if (currentProjectId) {
                      await cleanupProjectIdFromAllSources(currentProjectId);
                    }
                    currentProjectId = null;
                    // Redirect to hub on error
                    deps.setIsRestoring(false);
                    deps.setViewMode('setup');
                    window.location.hash = '#setup';
                    return; // Exit early
                  }
                } else {
                  // Guest users: can use projectStorage as fallback
                  const loadedProject = await projectStorage.getProject(currentProjectId);
                  if (loadedProject) {
                    projectDataToLoad = JSON.stringify(loadedProject);

                    // Also verify it exists in metadata
                    const metas = await projectStorage.getMetadataList();
                    const userProjects = currentUserId
                      ? metas.filter(p => p.userId === currentUserId)
                      : metas.filter(p => !p.userId);

                    // Verify the project exists in the list
                    const foundProject = userProjects.find(p => p.id === currentProjectId);
                    if (foundProject) {
                      projectToLoad = foundProject;
                    }
                  }
                }
              }

              // If current project not found or invalid, fall back to most recent USER project
              if (!projectToLoad || !projectDataToLoad) {
                // Try loading from database first (if user is logged in)
                if (userToken && currentUserId) {
                  try {
                    const dbProjects = await projectsApi.getAll();
                    // Filter to only user's own projects (not sample projects)
                    const userDbProjects = dbProjects.filter((p: any) =>
                      p.userId === currentUserId && !p.isSample
                    );

                    if (userDbProjects.length > 0) {
                      // Sort by lastModified and get the most recent
                      userDbProjects.sort((a: any, b: any) =>
                        new Date(b.lastModified || b.updatedAt || 0).getTime() -
                        new Date(a.lastModified || a.updatedAt || 0).getTime()
                      );
                      const mostRecent = userDbProjects[0];
                      projectDataToLoad = JSON.stringify(mostRecent);
                      projectToLoad = {
                        id: mostRecent._id || mostRecent.id,
                        name: mostRecent.name,
                        lastModified: new Date(mostRecent.lastModified || mostRecent.updatedAt || Date.now()).getTime(),
                        description: (mostRecent.description || "").substring(0, 100),
                        phase: mostRecent.currentPhase || 'Initiation',
                        userId: mostRecent.userId
                      };
                    }
                  } catch (dbError) {
                    console.warn('Failed to load projects from database, trying localStorage:', dbError);
                  }
                }

                // Fallback to projectStorage if database didn't have user projects
                if (!projectToLoad || !projectDataToLoad) {
                  const metas = await projectStorage.getMetadataList();
                  const currentUserId = deps.userRef.current?.id;
                  const userProjects = currentUserId
                    ? metas.filter(p => p.userId === currentUserId)
                    : metas.filter(p => !p.userId);

                  if (userProjects.length > 0) {
                    // Sort by lastModified and get the most recent
                    userProjects.sort((a, b) => b.lastModified - a.lastModified);
                    projectToLoad = userProjects[0];
                    const loadedProject = await projectStorage.getProject(projectToLoad.id);
                    if (loadedProject) {
                      projectDataToLoad = JSON.stringify(loadedProject);
                    }
                  }
                }
              }

              // Load the project if found AND verify it belongs to the current user
              if (projectToLoad && projectDataToLoad) {
                // Verify ownership before loading
                const loadedState = JSON.parse(projectDataToLoad) as ProjectState;
                const projectUserId = loadedState.userId || projectToLoad.userId;
                const currentUserId = deps.userRef.current?.id;

                // Only load if it's the user's project OR if user is not logged in (guest mode)
                const canLoad = !currentUserId || !projectUserId || projectUserId === currentUserId;

                if (canLoad && loadedState && loadedState.name && loadedState.name !== INITIAL_PROJECT_NAME) {
                  // Restore project state
                  if (!loadedState.id) loadedState.id = projectToLoad.id;
                  if (!loadedState.currentSprint) loadedState.currentSprint = 1;
                  if (!loadedState.methodology) loadedState.methodology = 'V-Model';
                  if (!loadedState.selectedTheme) loadedState.selectedTheme = 'modern';

                  // Ensure tasks and artifacts arrays exist (safety check)
                  if (!Array.isArray(loadedState.tasks)) {
                    if ((import.meta as any).env?.DEV) {
                      console.debug('[Project Load] Initializing missing tasks array');
                    }
                    loadedState.tasks = [];
                  }
                  if (!Array.isArray(loadedState.artifacts)) {
                    if ((import.meta as any).env?.DEV) {
                      console.debug('[Project Load] Initializing missing artifacts array');
                    }
                    loadedState.artifacts = [];
                  }

                  // Map tasks to pause any in-progress ones
                  loadedState.tasks = (loadedState.tasks || []).map(t => {
                    if (t.status === TaskStatus.IN_PROGRESS) {
                      return { ...t, status: TaskStatus.PAUSED, logs: [...(t.logs || []), "[System] Session restored. Task paused due to interruption."] };
                    }
                    return t;
                  });

                  // Store as current project (database + localStorage for fallback)
                  if (userToken && currentUserId) {
                    try {
                      const { updateUserSettings } = await import('../services/userSettingsApi');
                      await updateUserSettings(userToken, { currentProjectId: projectToLoad.id });
                    } catch (settingsError) {
                      console.warn('Failed to save currentProjectId to database:', settingsError);
                    }
                  }
                  projectStorage.setCurrentProjectId(projectToLoad.id);

                  // Reset HAND-OFF AI state when restoring project
                  deps.setAutoPilotStatus('idle');
                  deps.autoPilotStatusRef.current = 'idle';
                  deps.isStoppingRef.current = true;
                  deps.isBatchingRef.current = false;
                  if (deps.batchIntervalRef.current) {
                    clearInterval(deps.batchIntervalRef.current);
                    deps.batchIntervalRef.current = null;
                  }
                  deps.activeTaskControllersRef.current.forEach(c => c.abort());
                  deps.activeTaskControllersRef.current.clear();
                  deps.dispatch({ type: 'SET_PROCESSING', payload: false });

                  // Restore the project state
                  deps.dispatch({ type: 'RESET_PROJECT', payload: loadedState });
                  const themeToSet = loadedState.selectedTheme || 'modern';
                  deps.setSelectedTheme(themeToSet);
                  // Save theme preference to database if user is logged in
                  if (userToken && currentUserId) {
                    try {
                      const { updatePreference } = await import('../services/userSettingsApi');
                      await updatePreference(userToken, 'selectedTheme', themeToSet);
                    } catch (dbError) {
                      console.warn('Failed to save theme preference to database:', dbError);
                    }
                  }
                  startTransition(() => {
                    deps.setViewMode('workspace');
                  });
                  // Update URL with project ID
                  const url = new URL(window.location.href);
                  url.hash = '#workspace';
                  url.searchParams.set('project', projectToLoad.id);
                  window.history.replaceState({}, '', url.toString());
                  deps.setIsRestoring(false);
                } else {
                  // Project not found or invalid - clean up and redirect to hub silently
                  // This is expected behavior when projects are deleted or don't exist
                  if (currentProjectId) {
                    await cleanupProjectIdFromAllSources(currentProjectId);
                  }
                  // Clear project ID from URL
                  const url = new URL(window.location.href);
                  url.searchParams.delete('project');
                  window.history.replaceState({}, '', url.toString());
                  deps.setIsRestoring(false);
                  startTransition(() => {
                    deps.setViewMode('setup');
                  });
                  window.location.hash = '#setup';
                }
              } else {
                // No project to load - redirect to hub to prevent blank project
                // Only log in development and suppress duplicate warnings from React StrictMode
                if (import.meta.env?.DEV) {
                  const warningKey = 'no-project-id-on-refresh';
                  if (!sessionStorage.getItem(warningKey)) {
                    sessionStorage.setItem(warningKey, 'true');
                    console.warn('No project ID found on refresh, redirecting to hub');
                    // Clear after 2 seconds to allow re-warning if needed
                    setTimeout(() => sessionStorage.removeItem(warningKey), 2000);
                  }
                }
                deps.setIsRestoring(false);
                deps.setViewMode('setup');
                window.location.hash = '#setup';
              }
            } catch (e) {
              console.error('Failed to restore workspace project on refresh', e);
              deps.setIsRestoring(false);
              // On error, redirect to hub and clean up URL
              const url = new URL(window.location.href);
              url.searchParams.delete('project');
              window.history.replaceState({}, '', url.toString());
              deps.setViewMode('setup');
              window.location.hash = '#setup';
            }
          })();
        });
      } else {
        deps.setIsRestoring(false);
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Only run once on mount - use refs for current values

  // Effect 14: autoPilotStatus reset on mount
  useEffect(() => {
    // Force reset to idle on component mount (page load/refresh)
    // This ensures HAND-OFF AI never auto-starts after refresh
    deps.setAutoPilotStatus('idle');
    deps.autoPilotStatusRef.current = 'idle';
    // Stop any running auto-pilot loops
    deps.isStoppingRef.current = true;
    deps.isBatchingRef.current = false;
    if (deps.batchIntervalRef.current) {
      clearInterval(deps.batchIntervalRef.current);
      deps.batchIntervalRef.current = null;
    }
    deps.activeTaskControllersRef.current.forEach(c => c.abort());
    deps.activeTaskControllersRef.current.clear();
  }, []); // Only run once on mount

  // Effect 15: settingsRef sync
  useEffect(() => { deps.settingsRef.current = deps.appSettings; }, [deps.appSettings]);

  // Effect 16: autoPilotStatusRef sync
  useEffect(() => { deps.autoPilotStatusRef.current = deps.autoPilotStatus; }, [deps.autoPilotStatus]);

  // Effect 17: viewMode/prevViewMode + HAND-OFF reset
  useEffect(() => {
    const prevViewMode = deps.prevViewModeRef.current;
    const isEnteringWorkspace = prevViewMode !== 'workspace' && deps.viewMode === 'workspace';

    if (isEnteringWorkspace && deps.autoPilotStatus !== 'idle') {
      // Force reset HAND-OFF AI to idle state when FIRST entering workspace
      console.log('Entering workspace mode - resetting HAND-OFF AI to idle');
      // Use the same cleanup as stopExecution() to ensure everything is stopped
      deps.isStoppingRef.current = true;
      deps.isBatchingRef.current = false;
      deps.setAutoPilotStatus('idle');
      deps.autoPilotStatusRef.current = 'idle';
      if (deps.batchIntervalRef.current) {
        clearInterval(deps.batchIntervalRef.current);
        deps.batchIntervalRef.current = null;
      }
      deps.activeTaskControllersRef.current.forEach(c => c.abort());
      deps.activeTaskControllersRef.current.clear();
      deps.dispatch({ type: 'SET_PROCESSING', payload: false });
    }

    // Update ref for next comparison
    deps.prevViewModeRef.current = deps.viewMode;
  }, [deps.viewMode]); // Only depend on viewMode, not autoPilotStatus

  // Effect 18: globalMessages scroll
  useEffect(() => {
    if (deps.leftTab === 'chat' && deps.appSettings.autoScrollLogs) {
      deps.globalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [deps.globalMessages, deps.leftTab, deps.appSettings.autoScrollLogs]);

  // Effect 19: setupMessages scroll
  useEffect(() => {
    if (deps.setupEndRef.current && deps.viewMode === 'setup') {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        deps.setupEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [deps.setupMessages, deps.viewMode, deps.setupStage]);

  // Effect 20: auto-switch tabs
  useEffect(() => {
    if (deps.viewMode === 'workspace') {
      startTransition(() => {
        if (deps.activeTab === 'ide' && !deps.shouldShowFeature(deps.canUseCodeEditor)) {
          deps.setActiveTab('board');
        } else if (deps.activeTab === 'artifacts' && !deps.shouldShowFeature(deps.canUseArtifactViewer)) {
          deps.setActiveTab('board');
        }

        if (deps.leftTab === 'chat' && !deps.shouldShowFeature(deps.canUseAIChat)) {
          deps.setLeftTab('agents');
        }
      });
    }
  }, [deps.viewMode, deps.activeTab, deps.leftTab, deps.canUseCodeEditor, deps.canUseArtifactViewer, deps.canUseAIChat, deps.userRole]);

  // Effect 21: AI suggestion logic
  useEffect(() => {
    // Only generate suggestions if feature is enabled (don't clear if just loading)
    if (!deps.canUseAISuggestions.enabled) {
      deps.setDynamicSuggestions([]);
      deps.setIsGeneratingSuggestions(false);
      return;
    }

    // Don't generate if still loading feature access
    if (deps.canUseAISuggestions.loading) {
      return;
    }

    const handler = setTimeout(async () => {
      // Skip suggestion generation for error messages, system status messages, or placeholder text
      const inputTrimmed = deps.setupInput.trim();

      // Enhanced system message detection - catch all status patterns
      const hasEmojiPrefix = /^(⚠️|❌|🎤|🔊|⏸️|▶️|🔄|🛑|🤖|💬)/.test(inputTrimmed);
      const systemStatusPatterns = [
        'Server connection error',
        'Transcription failed',
        'check if backend',
        'Starting live conversation',
        'You interrupted',
        'AI is speaking',
        'listening',
        'Transcribing',
        'Live conversation active',
        'interrupt',
        'AI is thinking',
        'Starting live',
        'thinking',
        'processing',
        'sending',
        'recording',
        'transcription',
        'server error',
        'connection error',
        'backend',
        'error',
        'failed'
      ];
      const isSystemStatus = systemStatusPatterns.some(pattern =>
        inputTrimmed.toLowerCase().includes(pattern.toLowerCase())
      );

      // Check if it's a system message or placeholder
      const isSystemMessage = hasEmojiPrefix || isSystemStatus || inputTrimmed.length < 3;

      if (inputTrimmed.length > 2 && !isSystemMessage) {
        deps.setIsGeneratingSuggestions(true);
        try {
          if ((import.meta as any).env?.DEV) {
            console.log('[Suggestions] Generating suggestions for input:', deps.setupInput.substring(0, 50));
          }
          const suggestions = await generateQuickSuggestions(deps.setupInput, deps.setupMessages);
          if ((import.meta as any).env?.DEV) {
            console.log('[Suggestions] Received', suggestions.length, 'suggestions');
          }
          // Map simple output to UI format
          const formatted = suggestions.map(s => ({
            label: s.label || s.prompt?.substring(0, 30) || 'Suggestion',
            prompt: s.prompt || s.label || '',
            icon: Sparkles
          }));
          // Always update suggestions (even if empty, to clear previous ones)
          // generateQuickSuggestions now returns fallback suggestions when backend returns 0
          deps.setDynamicSuggestions(formatted);
          if ((import.meta as any).env?.DEV && formatted.length > 0) {
            console.log('[Suggestions] Formatted suggestions:', formatted.map(s => s.label));
          } else if ((import.meta as any).env?.DEV && formatted.length === 0) {
            console.log('[Suggestions] No suggestions available (input too short or error)');
          }
        } catch (error) {
          console.error('[Suggestions] Failed to generate suggestions:', error);
          // Don't clear existing suggestions on error, just stop loading
        } finally {
          deps.setIsGeneratingSuggestions(false);
        }
      } else {
        // For system messages or short input, don't generate but keep existing suggestions
        // Only clear if input is completely empty (after debounce delay)
        if (deps.setupInput.trim().length === 0) {
          // Add delay before clearing to prevent flashing
          setTimeout(() => {
            if (deps.setupInput.trim().length === 0) {
              deps.setDynamicSuggestions([]);
            }
          }, 1000); // 1 second delay before clearing when empty
        }
        deps.setIsGeneratingSuggestions(false);
      }
    }, 500); // 500ms debounce before generating

    return () => clearTimeout(handler);
  }, [deps.setupInput, deps.setupMessages, deps.canUseAISuggestions.enabled, deps.canUseAISuggestions.loading]);

  // Effect 22: sync displayedSuggestions
  useEffect(() => {
    deps.setDisplayedSuggestions(deps.dynamicSuggestions);
  }, [deps.dynamicSuggestions]);

  // Effect 23: debouncedSaveProject cleanup
  useEffect(() => {
    return () => {
      if (deps.saveProjectTimeoutRef.current) {
        clearTimeout(deps.saveProjectTimeoutRef.current);
      }
    };
  }, []);

  // Effect 24: beforeunload + visibilitychange
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Clear debounce timeout and save immediately
      if (deps.saveProjectTimeoutRef.current) {
        clearTimeout(deps.saveProjectTimeoutRef.current);
        deps.saveProjectTimeoutRef.current = null;
      }
      await deps.saveProject();

      // If there are running tasks or auto-pilot, transfer them to background
      const hasRunningTasks = deps.stateRef.current.tasks.some((t: any) => t.status === TaskStatus.IN_PROGRESS);
      const hasAutoPilot = deps.autoPilotStatusRef.current === 'running';

      if (hasRunningTasks || hasAutoPilot) {
        // Transfer running tasks to background service
        try {
          const runningTasks = deps.stateRef.current.tasks.filter((t: any) => t.status === TaskStatus.IN_PROGRESS);

          if (runningTasks.length > 0 && deps.user?.id && deps.stateRef.current.id) {
            // Send tasks to background service
            const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
            const API_BASE_URL = getApiBaseUrl();
            // Try to get token from various possible locations
            const token = localStorage.getItem('authToken') ||
              localStorage.getItem('auth_token') ||
              localStorage.getItem('token') ||
              (deps.user as any)?.token;

            for (const task of runningTasks) {
              const agent = deps.stateRef.current.agents.find((a: any) => a.role === task.assignedTo || a.name === task.assignedTo) || deps.stateRef.current.agents[0];

              if (agent) {
                // Use sendBeacon for reliable delivery even if page is closing
                // sendBeacon doesn't support custom headers, so we'll use a different approach
                const data = {
                  projectId: deps.stateRef.current.id,
                  taskId: task.id,
                  agent: agent,
                  task: task,
                  projectContext: deps.stateRef.current.description,
                  artifacts: deps.stateRef.current.artifacts,
                  useInternet: deps.stateRef.current.useInternet,
                  mcpServers: deps.stateRef.current.mcpServers,
                  standards: deps.stateRef.current.selectedStandards,
                  token: token // Include token in body for sendBeacon compatibility
                };

                const dataString = JSON.stringify(data);

                // Use sendBeacon for reliable delivery (works even if page is closing)
                // Note: sendBeacon doesn't support custom headers, so token is in body
                if (navigator.sendBeacon) {
                  const blob = new Blob([dataString], { type: 'application/json' });
                  navigator.sendBeacon(`${API_BASE_URL}/api/background-tasks/start`, blob);
                } else {
                  // Fallback to fetch with keepalive
                  fetch(`${API_BASE_URL}/api/background-tasks/start`, {
                    method: 'POST',
                    headers: token ? {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    } : {
                      'Content-Type': 'application/json'
                    },
                    body: dataString,
                    keepalive: true // Keep request alive even if page closes
                  }).catch(() => {
                    // Silent fail - task will pause on frontend
                    console.warn('Failed to transfer task to background');
                  });
                }
              }
            }
          }
        } catch (error) {
          console.warn('Failed to transfer tasks to background:', error);
        }

        // Transfer HAND-OFF AI to background instead of stopping
        if (hasAutoPilot && deps.user?.id && deps.stateRef.current.id) {
          try {
            const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
            const API_BASE_URL = getApiBaseUrl();
            const token = localStorage.getItem('authToken') ||
              localStorage.getItem('auth_token') ||
              localStorage.getItem('token') ||
              (deps.user as any)?.token;

            if (token) {
              const data = {
                projectId: deps.stateRef.current.id,
                projectContext: deps.stateRef.current.description,
                artifacts: deps.stateRef.current.artifacts,
                agents: deps.stateRef.current.agents,
                useInternet: deps.stateRef.current.useInternet,
                mcpServers: deps.stateRef.current.mcpServers,
                standards: deps.stateRef.current.selectedStandards,
                currentPhase: deps.stateRef.current.currentPhase,
                currentSprint: deps.stateRef.current.currentSprint,
                token: token // Include token in body for sendBeacon compatibility
              };

              const dataString = JSON.stringify(data);

              // Use sendBeacon for reliable delivery (works even if page is closing)
              if (navigator.sendBeacon) {
                const blob = new Blob([dataString], { type: 'application/json' });
                navigator.sendBeacon(`${API_BASE_URL}/api/background-autopilot/start`, blob);
                console.log('HAND-OFF AI transferred to background');
              } else {
                // Fallback to fetch with keepalive
                fetch(`${API_BASE_URL}/api/background-autopilot/start`, {
                  method: 'POST',
                  headers: token ? {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  } : {
                    'Content-Type': 'application/json'
                  },
                  body: dataString,
                  keepalive: true // Keep request alive even if page closes
                }).catch(() => {
                  console.warn('Failed to transfer HAND-OFF AI to background');
                });
              }
            }
          } catch (error) {
            console.warn('Failed to transfer HAND-OFF AI to background:', error);
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      // When page becomes hidden (tab switch, minimize, sleep, etc.)
      if (document.hidden) {
        console.log('[AutoSave] Tab hidden - saving project state...');

        // AUTO-SAVE: Save project state immediately when tab becomes hidden
        // This prevents data loss when PC goes to sleep or user switches tabs
        if (deps.saveProjectTimeoutRef.current) {
          clearTimeout(deps.saveProjectTimeoutRef.current);
          deps.saveProjectTimeoutRef.current = null;
        }

        // Save to localStorage as emergency backup (works even for guests)
        try {
          const currentState = deps.stateRef.current;
          if (currentState && currentState.id) {
            localStorage.setItem('orbitai_autosave_backup', JSON.stringify({
              timestamp: Date.now(),
              projectId: currentState.id,
              description: currentState.description,
              currentPhase: currentState.currentPhase,
              projectPreview: currentState.projectPreview,
              wizardMetadata: currentState.wizardMetadata,
              brainstormingContext: (currentState as any).brainstormingContext,
              artifacts: currentState.artifacts?.slice(0, 5) // Limit to avoid quota
            }));
            console.log('[AutoSave] Emergency backup saved to localStorage');
          }
        } catch (e) {
          console.warn('[AutoSave] Failed to save emergency backup:', e);
        }

        // Also trigger regular save (for logged-in users)
        deps.saveProject();

        // Similar logic for running tasks
        const hasRunningTasks = deps.stateRef.current.tasks.some((t: any) => t.status === TaskStatus.IN_PROGRESS);
        if (hasRunningTasks && deps.user?.id && deps.stateRef.current.id) {
          // Transfer to background (same logic as beforeunload)
          // This allows tasks to continue when tab is hidden
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (deps.viewMode === 'workspace') {
        // Clear debounce and save immediately on cleanup
        if (deps.saveProjectTimeoutRef.current) {
          clearTimeout(deps.saveProjectTimeoutRef.current);
          deps.saveProjectTimeoutRef.current = null;
        }
        // Only save if project ID is valid (prevents warnings during cleanup)
        const currentState = deps.stateRef.current;
        if (currentState && isValidObjectId(currentState.id)) {
          deps.saveProject();
        }
      }
    };
  }, [deps.saveProject, deps.viewMode, deps.user]);

  // Effect 25: save currentProjectId to URL/DB
  useEffect(() => {
    if (deps.viewMode === 'workspace' && deps.state.id && deps.user?.token && deps.user?.id) {
      // Update URL with project ID
      const url = new URL(window.location.href);
      url.hash = '#workspace';
      url.searchParams.set('project', deps.state.id);
      window.history.replaceState({}, '', url.toString());

      // Save to database
      const saveCurrentProject = async () => {
        try {
          const { updateUserSettings } = await import('../services/userSettingsApi');
          await updateUserSettings(deps.user.token!, { currentProjectId: deps.state.id });
        } catch (error) {
          console.warn('Failed to save currentProjectId:', error);
        }
      };
      saveCurrentProject();

      // Only save to localStorage for guest users (not logged in)
      // Logged-in users: database-only via UserSettings
      if (!deps.user?.id) {
        try {
          // Only save valid project IDs to localStorage
          if (isValidObjectId(deps.state.id)) {
            localStorage.setItem('orbitai_current_project_id', deps.state.id);
          } else {
            // Clear invalid ID from localStorage if present
            localStorage.removeItem('orbitai_current_project_id');
          }
        } catch (e) {
          // Ignore localStorage errors for guest users
        }
      }
    }
  }, [deps.state.id, deps.viewMode, deps.user?.token, deps.user?.id]);

  // Effect 26: save on state change
  useEffect(() => {
    if (!deps.hasLoaded) return;

    // Don't save demo projects
    if (deps.state.id && deps.state.id.startsWith('demo-')) {
      return;
    }

    // Don't save if user is not authenticated
    if (!deps.user?.id) {
      return;
    }

    // Check if tutorial should be shown (only once for new users)
    let tutorialTimeout: NodeJS.Timeout | null = null;
    if (deps.viewMode === 'workspace' && !hasCompletedTutorial() && !deps.showWorkspaceTutorial) {
      // Small delay to ensure workspace is fully rendered
      tutorialTimeout = setTimeout(() => {
        deps.setShowWorkspaceTutorial(true);
      }, 1000);
    }

    const timeoutId = setTimeout(() => {
      deps.debouncedSaveProject();
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (tutorialTimeout) clearTimeout(tutorialTimeout);
    };
  }, [deps.state, deps.hasLoaded, deps.viewMode, deps.user?.id, deps.showWorkspaceTutorial, deps.debouncedSaveProject]);

  // Effect 27: store currentProjectId on state.id change
  useEffect(() => {
    if (deps.viewMode === 'workspace' && deps.state.id && deps.state.name !== INITIAL_PROJECT_NAME) {
      // Only save to localStorage for guest users (not logged in)
      // Logged-in users: database-only via UserSettings (handled in saveProject)
      if (!deps.user?.id) {
        try {
          // Only save valid project IDs to localStorage
          if (isValidObjectId(deps.state.id)) {
            localStorage.setItem('orbitai_current_project_id', deps.state.id);
          } else {
            // Clear invalid ID from localStorage if present
            localStorage.removeItem('orbitai_current_project_id');
          }
        } catch (e) {
          // Ignore localStorage errors for guest users
        }
      }
    }
  }, [deps.state.id, deps.state.name, deps.viewMode, deps.user?.id]);

  // Effect 28: mouse move resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (deps.isResizingLeft) deps.setLeftWidth(Math.min(Math.max(e.clientX, 220), 500));
      if (deps.isResizingLogs) {
        deps.setIsLogsCollapsed(false);
        deps.setLogHeight(Math.min(Math.max(document.body.clientHeight - e.clientY, 36), 600));
      }
    };
    const handleMouseUp = () => {
      deps.setIsResizingLeft(false);
      deps.setIsResizingLogs(false);
    };
    if (deps.isResizingLeft || deps.isResizingLogs) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = deps.isResizingLogs ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [deps.isResizingLeft, deps.isResizingLogs]);
}
