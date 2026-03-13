
import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo, startTransition } from 'react';
import {
  ProjectState, Phase, AgentRole, TaskStatus, LogEntry, Artifact, Agent, ChatMessage, UserProfile, Methodology, ProjectMetadata
} from '@orbitai/shared';
import { AGENTS, INITIAL_PROJECT_NAME, QUALITY_STANDARDS, PROJECT_THEMES } from '@orbitai/shared';
import { orchestrateNextSteps, generateAgentProfile, generateProjectPreview, ProjectPreview, generateQuickSuggestions, generateAppTheme } from './services/geminiService';
import { unmarkProjectAsSample } from './services/adminApi';
import { projectsApi, setAuthToken } from '@src/services/api';
import { createAuthHandlers } from './handlers/authHandlers';
import { createUIHandlers } from './handlers/uiHandlers';
import { createProjectHandlers } from './handlers/projectHandlers';
import { createTaskHandlers } from './handlers/taskHandlers';
import { createAiHandlers } from './handlers/aiHandlers';
import { createThemeHandlers } from './handlers/themeHandlers';
import { createSetupHandlers } from './handlers/setupHandlers';
import { createArtifactHandlers } from './handlers/artifactHandlers';
import { projectStorage, generateObjectId, isValidObjectId, cleanupInvalidProjectIds, cleanupProjectIdFromAllSources, isProjectNotFound } from './services/projectStorage';
import { agentAssignmentService } from './services/agentAssignment.service';
import AgentCard from './components/AgentCard';
import { hasCompletedTutorial } from './components/WorkspaceTutorial';
import { initializeBrowserUtils } from './utils/browserUtils';
import Logo from './components/Logo';

import Payment from './components/Payment';
import { Tooltip, HelpIcon } from './components/Tooltip';
import { useHistory } from './hooks/useHistory';
import { useFeatureAccessContext, FeatureAccessProvider } from './contexts/FeatureAccessContext';
import { useUserSettings } from './hooks/useUserSettings';
import { useProjectState } from './hooks/useProjectState';
import { useProjectManagement } from './hooks/useProjectManagement';
import { useAppState, ViewMode } from './hooks/useAppState';
import { useAuth } from './contexts/AuthContext';
import { SkipLink } from './components/SkipLink';
import { ProjectTemplate } from '@orbitai/shared';
import { AppShell } from './components/AppShell';
import { AppRouter } from './components/AppRouter';
import { toastService, Toast } from './services/toastService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Settings, RotateCw, Layout, FileText, ChevronRight, ChevronLeft, Hexagon, Activity, GripVertical, Code, Zap, StopCircle, Bot, Globe, Network, MessageSquare, Users, Send, Sparkles, User, Paperclip, Trash2, ArrowDown, Wand2, MessageSquarePlus, ShieldCheck, CheckSquare, Pause, Square, Terminal as TerminalIcon, Microscope, Book, CreditCard, Layers, Plus, Folder, LayoutGrid, Clock, Calendar, Gauge, Signal, Repeat, FilePlus, X, Save, Edit2, ShoppingCart, Gamepad2, Database, Smartphone, Server, Shield, Crown, Lock, Eye, GitGraph, FileCode, Play, Cpu, ShieldAlert, Palette, Dices, Undo2, Redo2, LogOut, Share2, Rocket, Heart, Ticket, Download, FileJson, Upload, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import JSZip from 'jszip';
// @ts-ignore
import remarkGfm from 'remark-gfm';
import { cleanMermaidCode } from './utils/mermaidUtils';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Helper to clean Mermaid code
// Helper to clean Mermaid code - Moved to utils/mermaidUtils.ts
import { v4 as uuidv4 } from 'uuid';
const generateMessageId = () => uuidv4();

// ... ProcessingOverlay Component ...
// ProcessingOverlay moved to components/ProcessingOverlay.tsx



/**
 * AppContent - Main application component that uses feature flags
 * This is wrapped by App component which provides FeatureAccessProvider
 */
const AppContent: React.FC = () => {
  const isAuthCallback = window.location.pathname === '/auth/callback';

  // Reload loop detection and prevention
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

  const [OAuthCallbackComponent, setOAuthCallbackComponent] = useState<React.FC | null>(null);

  useEffect(() => {
    if (isAuthCallback) {
      // Lazy load the callback component to save bundle size for normal users
      import('./views/OAuthCallback').then(module => {
        setOAuthCallbackComponent(() => module.default);
      });
    }
  }, [isAuthCallback]);

  const { state, dispatch, actions } = useProjectState();
  const stateRef = useRef(state);
  // CRITICAL FIX: Update ref directly in render phase - no useEffect needed
  // This prevents infinite render loop caused by state dependency
  stateRef.current = state;

  const appState = useAppState();
  const {
    viewMode, setViewMode,
    isModernView, toggleModernView,
    activeTab, setActiveTab,
    isRestoring, setIsRestoring,
    isViewOnly, setIsViewOnly,
    sharedProjectToken, setSharedProjectToken,
    showSubscription, setShowSubscription, subscriptionMode, setSubscriptionMode,
    showUserLogin, setShowUserLogin,
    showUserSignup, setShowUserSignup,
    showPackageSelection, setShowPackageSelection,
    selectedPackage, setSelectedPackage,
    pendingUser, setPendingUser,
    showPayment, setShowPayment,
    adminToken, setAdminToken,
    adminUser, setAdminUser,

    // Edits & Modals (Added to fix ReferenceErrors)
    editingTask, setEditingTask,
    editingAgent, setEditingAgent,
    selectedAgentDetail, setSelectedAgentDetail,
    isCreatingNewAgent, setIsCreatingNewAgent,
    showWorkspaceTutorial, setShowWorkspaceTutorial,
    leftTab, setLeftTab,

    showHITLPrompt, setShowHITLPrompt,
    hitlPreference, setHITLPreference,
    showAdminLogin, setShowAdminLogin,
    showFeedbackModal, setShowFeedbackModal,
    showUserProfile, setShowUserProfile,
    showShareModal, setShowShareModal,
    isLeftCollapsed, setIsLeftCollapsed,
    leftWidth, setLeftWidth,
    isResizingLeft, setIsResizingLeft,
    isLogsCollapsed, setIsLogsCollapsed,
    logHeight, setLogHeight,
    isResizingLogs, setIsResizingLogs,
    rightSidebarView, setRightSidebarView,
    isRightSidebarOpen, setIsRightSidebarOpen,
    globalChatInput, setGlobalChatInput,
    globalMessages, setGlobalMessages,
    isChatThinking, setIsChatThinking,
    activeChatAgent, setActiveChatAgent,
    chatHistory, setChatHistory,
    isEnhancingChat, setIsEnhancingChat,
    isResearchingChat, setIsResearchingChat,
    setupInput, setSetupInput,
    setupMessages, setSetupMessages,
    isEnhancingInput, setIsEnhancingInput,
    isResearching, setIsResearching,
    setupInputRef,
    setupEndRef,
    globalChatEndRef,
    globalFileInputRef,
    globalChatInputRef,
    // Wizard State
    setupProjectName, setSetupProjectName,
    hasManuallyEditedProjectName, setHasManuallyEditedProjectName,
    setupFiles, setSetupFiles,
    tempSelectedStandards, setTempSelectedStandards,
    setupStage, setSetupStage,
    projectPreview, setProjectPreview,
    // Toggles & Views
    showTemplateSelector, setShowTemplateSelector,
    showSettings, setShowSettings,
    showThemeStudio, setShowThemeStudio,
    showProjectImport, setShowProjectImport,
    showExportDataMenu, setShowExportDataMenu,
    showShareProject, setShowShareProject,
    showReportExport, setShowReportExport,
    showTerminal, setShowTerminal,
    showMobileDeploymentWizard, setShowMobileDeploymentWizard,
    previewTab, setPreviewTab,
    showStandards, setShowStandards,
    isDraggingSetup, setIsDraggingSetup,
    isGeneratingSuggestions, setIsGeneratingSuggestions,
    displayedSuggestions, setDisplayedSuggestions,
    dynamicSuggestions, setDynamicSuggestions,
    isGeneratingTheme, setIsGeneratingTheme,
    dismissedGuestBanner, setDismissedGuestBanner,
    apiHealth, setApiHealth,
    // Theme & Template
    selectedTheme, setSelectedTheme,
    availableThemes, setAvailableThemes,
    themeInput, setThemeInput,
    selectedTemplateId, setSelectedTemplateId,
    selectedTemplateName, setSelectedTemplateName,
    // AutoPilot
    autoPilotStatus, setAutoPilotStatus, autoPilotStatusRef,
    isStoppingRef, isBatchingRef, activeTaskControllersRef, batchIntervalRef, pendingActionRef,
    // Processing
    processingLabel, setProcessingLabel,
    processingProgress, setProcessingProgress,
    processingStatusText, setProcessingStatusText,
    processingEstimatedTime, setProcessingEstimatedTime,
    processingTaskCount, setProcessingTaskCount,
    processingStartTimeRef,
    // Toasts
    toasts, setToasts,
    currentError, setCurrentError,
    // Renaming
    tempName, setTempName,
    isRenaming, setIsRenaming,
    showConfirmation, setShowConfirmation,
    // AppSettings
    appSettings, setAppSettings, settingsRef,
    // Misc
    globalFileInputRef: _ignoredGlobalFileInputRef, isProcessingFile, setIsProcessingFile,
    taskToDelete, setTaskToDelete,
    projectToDelete, setProjectToDelete
  } = appState;

  // History Management
  const history = useHistory(state);
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);

  // Confirmation modal resolver ref - must be at top level (Rules of Hooks)
  const confirmationResolverRef = useRef<((value: boolean) => void) | null>(null);



  // --- AUTH & SUBSCRIPTION STATE ---
  // Use centralized AuthContext instead of local state
  const { user, loading: authLoading, updateUser, logout: authLogout } = useAuth();

  // User settings from database
  const { settings: userSettings, updateSettings, updatePreference, loading: settingsLoading } = useUserSettings(user?.token || null);

  // Helper function to check if user is admin
  const isAdminUser = useCallback((user: UserProfile | null): boolean => {
    if (!user) return false;

    // Check role from user object
    let role = user.role?.toLowerCase()?.trim();

    // Fallback: Check localStorage directly if role is missing
    if (!role) {
      try {
        const storedUserStr = localStorage.getItem('orbitai_user');
        if (storedUserStr) {
          const storedUser = JSON.parse(storedUserStr);
          role = storedUser?.role?.toLowerCase()?.trim();
        }
      } catch (e) {
        console.error('Failed to check localStorage for role', e);
      }
    }

    const isAdmin = role === 'admin' || role === 'superadmin';

    return isAdmin;
  }, []);

  // Refresh user role from backend if missing (for existing logged-in users)
  const userEmailRef = useRef<string | undefined>(user?.email);
  const hasRefreshedRoleRef = useRef(false);

  useEffect(() => {
    userEmailRef.current = user?.email;
  }, [user?.email]);

  useEffect(() => {
    const refreshUserRole = async () => {
      // Only refresh once per email change, and only if role is missing
      if (!user || user.role || hasRefreshedRoleRef.current || userEmailRef.current !== user?.email) {
        return;
      }

      hasRefreshedRoleRef.current = true;

      try {
        // Try to get role from admin API
        const adminToken = localStorage.getItem('admin_token');
        if (adminToken && user.email) {
          const { getUsers } = await import('./services/adminApi');
          const response = await getUsers(adminToken);
          const adminUser = response.users.find((u: any) => u.email === user.email);
          if (adminUser && adminUser.role) {
            const roleStr = adminUser.role.toLowerCase().trim();
            const role = (['user', 'admin', 'editor', 'superadmin'].includes(roleStr) ? roleStr : 'user') as 'user' | 'admin' | 'editor' | 'superadmin';
            const updatedUser = { ...user, role };
            updateUser({ role });
            // Save user preferences to database if user is logged in
            if (user?.token) {
              try {
                await updatePreference('selectedTheme', updatedUser.selectedTheme);
                if (updatedUser.theme) {
                  await updatePreference('theme', updatedUser.theme);
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
        hasRefreshedRoleRef.current = false; // Allow retry on error
      }
    };

    refreshUserRole();
  }, [user?.email]); // Only run when user email changes

  // Reset refresh flag when email changes
  useEffect(() => {
    hasRefreshedRoleRef.current = false;
  }, [user?.email]);

  // Cleanup invalid project IDs - combined into single effect
  // CRITICAL: Run cleanup BEFORE project loading to prevent invalid project IDs from causing warnings
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
  }, [user?.id]); // Runs on mount (undefined) and when user logs in



  // Project Management State


  // Feature access checks
  // 'public' role is used when user is not signed in (user === null/undefined)
  // Normalize role to lowercase for consistent comparison with backend
  // CRITICAL: Memoize userRole to prevent infinite re-renders
  // Without memoization, this creates a new string on every render,
  // causing all useFeatureAccess hooks to re-run and trigger re-renders
  const userRole = useMemo(() => {
    return user?.role ? user.role.toLowerCase().trim() : 'public';
  }, [user?.role]);

  // Clear cache when user role changes from 'public' to actual role
  // This prevents showing stale 'public' cache entries for logged-in users
  const previousUserRoleRef = useRef<string>(userRole);
  const hasClearedCacheRef = useRef<boolean>(false);

  useEffect(() => {
    // Clear cache when:
    // 1. User logs in (transitions from 'public' to actual role)
    // 2. User role changes
    // 3. User object loads after initial render (to clear any 'public' cache from initial load)
    const shouldClearCache =
      (user && user.role && userRole !== 'public' && previousUserRoleRef.current !== userRole) ||
      (user && user.role && userRole !== 'public' && !hasClearedCacheRef.current);

    if (shouldClearCache) {
      previousUserRoleRef.current = userRole;
      hasClearedCacheRef.current = true;
      // User just logged in or role changed - clear old 'public' cache entries
      import('./services/featureAccess').then(({ clearFeatureCache }) => {
        clearFeatureCache();
        if (import.meta.env.DEV) {
          console.log('[App] Cleared feature cache - user role:', userRole);
        }
      });
    }

    // Reset flag when user logs out
    if (!user || !user.role) {
      hasClearedCacheRef.current = false;
    }
  }, [userRole, user?.role, user?.id]); // Use user?.id instead of user object to prevent re-runs

  // Listen for WebSocket broadcasts about feature flag updates
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
            import('./services/featureAccess').then(({ clearFeatureCache, clearFeatureCacheForKey }) => {
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
                import('./hooks/useFeatureAccess').then(({ triggerFeatureRefresh }) => {
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

  // Debug logging for superadmin role
  useEffect(() => {
    if (userRole === 'superadmin' && (import.meta as any).env?.DEV) {
      // Debug: Reduced console noise
      // console.debug('[App] Superadmin detected - role:', userRole);
    }
  }, [userRole]); // Removed user dependency - userRole already depends on user?.role

  // Feature access checks - TEMPORARILY DISABLED to debug React Hooks violation
  // These will all default to enabled while we investigate the issue
  const defaultFeature = { enabled: true, loading: false };
  const canViewSamples = defaultFeature;
  const canCreateProjects = defaultFeature;
  const canDeleteProjects = defaultFeature;
  const canSwitchEnvironment = defaultFeature;
  const canExportProjects = defaultFeature;
  const canShareProjects = defaultFeature;
  const canImportProjects = defaultFeature;
  const canExportReports = defaultFeature;
  const canExportData = defaultFeature;
  const canAccessTerminal = defaultFeature;
  const canUseTemplates = defaultFeature;
  const canViewAllProjects = defaultFeature;
  const canUseCodeEditor = defaultFeature;
  const canUseArtifactViewer = defaultFeature;
  const canUsePreviewMode = defaultFeature;
  const canUseAIChat = defaultFeature;
  const canUseAICodeGeneration = defaultFeature;
  const canUseAITaskAutomation = defaultFeature;
  const canUseAISuggestions = defaultFeature;
  const canCustomizeAgents = defaultFeature;
  const canDeleteAgents = defaultFeature;
  const canAutomateAgents = defaultFeature;

  /**
   * Helper function to check if feature is enabled
   * ALL roles (including superadmin) are determined by database feature flags
   * 
   * @param feature - Feature access result from useFeatureAccess hook
   * @returns true if feature is enabled for the current role (from database)
   * 
   * Access is determined by:
   * - Database feature flags (enabledRoles array)
   * - Feature must be active (isActive = true)
   * - Role must be in enabledRoles array
   * - While loading: Returns false to prevent premature access
   */
  const isFeatureEnabled = (feature: { enabled: boolean; loading: boolean } | undefined) => {
    // Handle undefined feature (e.g., not passed as prop)
    if (!feature) {
      return false;
    }

    // If still loading, return false to prevent premature access
    if (feature.loading) {
      return false; // Wait for API response
    }

    // Return the actual enabled status from database
    return feature.enabled;
  };

  /**
   * Helper function to check if feature should be shown (for conditional rendering)
   * ALL roles (including superadmin) are determined by database feature flags
   * 
   * @param feature - Feature access result from useFeatureAccess hook
   * @returns true if feature should be rendered (from database)
   * 
   * Access is determined by:
   * - Database feature flags (enabledRoles array)
   * - Feature must be active (isActive = true)
   * - Role must be in enabledRoles array
   * - While loading: Uses optimistic rendering (shows if enabled)
   */
  const shouldShowFeature = (feature: { enabled: boolean; loading: boolean } | undefined) => {
    // Handle undefined feature (e.g., not passed as prop)
    if (!feature) {
      return false;
    }

    // Optimistic: Show while loading (better UX - buttons appear immediately)
    // If loading, show optimistically (assume enabled until we know otherwise)
    // If not loading, use actual enabled status
    if (feature.loading) {
      return true; // Show optimistically while loading
    }
    return feature.enabled;
  };

  /**
   * Helper function to check if button should be disabled
   * ALL roles (including superadmin) are determined by database feature flags
   * 
   * @param feature - Feature access result from useFeatureAccess hook
   * @returns true if button should be disabled (from database)
   * 
   * Access is determined by:
   * - Database feature flags (enabledRoles array)
   * - Feature must be active (isActive = true)
   * - Role must be in enabledRoles array
   * - While loading: Not disabled (optimistic UI)
   */
  const isButtonDisabled = (feature: { enabled: boolean; loading: boolean } | undefined) => {
    // Handle undefined feature (e.g., not passed as prop)
    if (!feature) {
      return true; // Disable if feature is not available
    }

    // Don't disable while loading (optimistic UI - better UX)
    if (feature.loading) {
      return false; // Optimistic: allow interaction while loading
    }

    // Disable if feature is not enabled for this role (from database)
    return !feature.enabled;
  };

  // Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);





  // Use stable dispatch reference - ensure it's never undefined in deps
  const safeDispatch = dispatch || (() => { });
  const safeSetGlobalMessages = setGlobalMessages || (() => { });

  const addLog = useCallback((message: string, agentRole: string | any = AgentRole.ORCHESTRATOR, type: LogEntry['type'] = 'info', taskId?: string) => {
    if (!dispatch) return; // Guard against undefined dispatch during init

    dispatch({ type: 'ADD_LOG', payload: { id: Math.random().toString(36).substring(7), timestamp: Date.now(), agent: agentRole, message, type } });

    if (taskId) {
      const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      dispatch({ type: 'ADD_TASK_LOG', payload: { id: taskId, message: `[${timestamp}] ${message}` } });
    }

    if (type === 'action' || type === 'error' || type === 'success' || (agentRole === AgentRole.ORCHESTRATOR && type === 'info')) {
      const agentObj = (stateRef.current?.agents || []).find(a => a.role === agentRole) || AGENTS.find(a => a.role === agentRole);
      if (agentObj && setGlobalMessages) {
        setGlobalMessages(prev => [...prev, { id: Math.random().toString(36), sender: 'agent', text: message, timestamp: Date.now(), agentId: agentObj.id, isLogEvent: true }]);
      }
    }
  }, [safeDispatch, safeSetGlobalMessages]);

  // Proxy for stopAutoPilot to break dependency cycle
  const stopAutoPilotRef = useRef<() => void>(() => setAutoPilotStatus('idle'));
  const stopAutoPilot = useCallback(() => stopAutoPilotRef.current(), []);

  const uiHelpers = useMemo(() => ({
    setGlobalMessages: safeSetGlobalMessages,
    addLog
  }), [safeSetGlobalMessages, addLog]);

  const pm = useProjectManagement({
    user,
    state,
    dispatch,
    viewModeHelpers: { viewMode, setViewMode },
    featureFlags: {
      canCreateProjects,
      canViewSamples,
      isFeatureEnabled: (f) => isFeatureEnabled(f),
      shouldShowFeature: (f) => shouldShowFeature(f)
    },
    autoPilot: { stop: stopAutoPilot },
    uiHelpers,
    setupHelpers: {
      setSetupMessages, setSetupInput, setSetupProjectName, setHasManuallyEditedProjectName,
      setSetupFiles, setTempSelectedStandards, setSetupStage, setProjectPreview
    },
    themeHelpers: {
      setSelectedTheme, setAvailableThemes, setThemeInput
    },
    templateHelpers: {
      setSelectedTemplateId, setSelectedTemplateName
    }
  });

  // Destructure state and actions
  const {
    projectList,
    sampleProjects,
    loadingSamples,
    hasLoaded
  } = pm.state;

  const {
    setHasLoaded,
    setProjectList,
    setSampleProjects,
    setLoadingSamples,
    // Actions
    handleCreateNewProject,
    handleLoadProject,
    handleLoadDemoProject,
    handleSelectTemplate,
    handleSaveAsTemplate,
    deleteProject,
  } = pm.actions;

  // Shim basic setters that were just useState setters to the hook's actions



  // Initialize Feature Flag Adapter
  useEffect(() => {
    const initFeatureFlags = async () => {
      try {
        const { initializeFeatureFlags } = await import('./services/featureFlagAdapter');
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

  // Confirmation Modal State
  // Confirmation Modal - Handled by useAppState now

  // --- UI HANDLERS (Refactored) ---
  const {
    showConfirmation: showConfirmationUi,
    handleUndo,
    handleRedo,
    toggleRightSidebar,
    handleOpenSettings
  } = React.useMemo(() => createUIHandlers({
    setShowConfirmation: (show) => {
      appState.setConfirmationModal(prev => ({ ...prev, isOpen: show }));
    },
    setConfirmationConfig: (config) => {
      appState.setConfirmationModal(prev => ({ ...prev, ...config }));
    },
    setRightSidebarView,
    setIsRightSidebarOpen,
    setShowSettings,
    confirmationResolverRef, // Use existing ref from top level
    historyRef
  }), [setRightSidebarView, setIsRightSidebarOpen, setShowSettings, historyRef, confirmationResolverRef]);

  // Stop Execution callback
  const stopExecution = React.useCallback(() => {
    isStoppingRef.current = true;
    isBatchingRef.current = false;
    setAutoPilotStatus('idle');
    autoPilotStatusRef.current = 'idle';
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
    activeTaskControllersRef.current.forEach(c => c.abort());
    activeTaskControllersRef.current.clear();
    dispatch({ type: 'SET_PROCESSING', payload: false });
  }, [setAutoPilotStatus, dispatch]);

  // Active Tab - Handled by useAppState now



  // Debug: Log when tempSelectedStandards changes
  useEffect(() => {
    // Debug: Standards state change (reduced console noise)
    // if ((import.meta as any).env?.DEV) {
    //   console.debug('[Standards] tempSelectedStandards state changed:', {
    //     count: tempSelectedStandards.length,
    //     standards: tempSelectedStandards,
    //     timestamp: new Date().toISOString()
    //   });
    // }
  }, [tempSelectedStandards]);

  // Template reference tracking (for wizard migration)


  // Project Renaming State in Workspace
  // API health monitoring handled by useAppState




  // Subscribe to API Monitor
  // API monitor subscription handled by useAppState


  // Track if user has been loaded to prevent duplicate logs in StrictMode
  const userLoadedRef = useRef(false);

  // --- Auth Check on Mount ---
  // NOTE: User loading is now handled by AuthContext (contexts/AuthContext.tsx)
  // AuthContext automatically loads user from localStorage on mount
  // No need to duplicate that logic here



  // Refs to track current state without causing re-renders
  const viewModeRef = useRef(viewMode);
  const userRef = useRef(user);
  const isManuallyLoadingProjectRef = useRef(false); // Flag to prevent auto-restore when manually loading
  const isProgrammaticHashChangeRef = useRef(false); // Track if hash change is programmatic to prevent loops

  // Keep refs in sync with state
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Check for shared project link on mount and on URL change - MUST RUN FIRST
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
        handleLoadSharedProject(projectId, token);
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
        if (isManuallyLoadingProjectRef.current) {
          console.log('[Project Load] Skipping auto-restore - manual load in progress');
          return;
        }

        // Skip auto-restore if project is already loaded and matches URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project');
        if (urlProjectId && stateRef.current.id === urlProjectId && stateRef.current.name !== INITIAL_PROJECT_NAME) {
          console.log('[Project Load] Skipping auto-restore - project already loaded:', urlProjectId);
          return;
        }

        // Restore immediately without delay to prevent flickering
        // Wrap in startTransition to fix React Suspense error
        startTransition(() => {
          (async () => {
            try {
              setIsRestoring(true);
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

              const currentUserId = userRef.current?.id;
              const userToken = userRef.current?.token;

              // If not in URL, try database (if user is logged in)
              if (!currentProjectId && userToken && currentUserId) {
                try {
                  const { getUserSettings } = await import('./services/userSettingsApi');
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
                  setIsRestoring(false);
                  startTransition(() => {
                    setViewMode('setup');
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
                      setIsRestoring(false);
                      startTransition(() => {
                        setViewMode('setup');
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
                      setIsRestoring(false);
                      startTransition(() => {
                        setViewMode('setup');
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
                    setIsRestoring(false);
                    setViewMode('setup');
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
                  const currentUserId = userRef.current?.id;
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
                const currentUserId = userRef.current?.id;

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
                      const { updateUserSettings } = await import('./services/userSettingsApi');
                      await updateUserSettings(userToken, { currentProjectId: projectToLoad.id });
                    } catch (settingsError) {
                      console.warn('Failed to save currentProjectId to database:', settingsError);
                    }
                  }
                  projectStorage.setCurrentProjectId(projectToLoad.id);

                  // Reset HAND-OFF AI state when restoring project
                  setAutoPilotStatus('idle');
                  autoPilotStatusRef.current = 'idle';
                  isStoppingRef.current = true;
                  isBatchingRef.current = false;
                  if (batchIntervalRef.current) {
                    clearInterval(batchIntervalRef.current);
                    batchIntervalRef.current = null;
                  }
                  activeTaskControllersRef.current.forEach(c => c.abort());
                  activeTaskControllersRef.current.clear();
                  dispatch({ type: 'SET_PROCESSING', payload: false });

                  // Restore the project state
                  dispatch({ type: 'RESET_PROJECT', payload: loadedState });
                  const themeToSet = loadedState.selectedTheme || 'modern';
                  setSelectedTheme(themeToSet);
                  // Save theme preference to database if user is logged in
                  if (userToken && currentUserId) {
                    try {
                      const { updatePreference } = await import('./services/userSettingsApi');
                      await updatePreference(userToken, 'selectedTheme', themeToSet);
                    } catch (dbError) {
                      console.warn('Failed to save theme preference to database:', dbError);
                    }
                  }
                  startTransition(() => {
                    setViewMode('workspace');
                  });
                  // Update URL with project ID
                  const url = new URL(window.location.href);
                  url.hash = '#workspace';
                  url.searchParams.set('project', projectToLoad.id);
                  window.history.replaceState({}, '', url.toString());
                  setIsRestoring(false);
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
                  setIsRestoring(false);
                  startTransition(() => {
                    setViewMode('setup');
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
                setIsRestoring(false);
                setViewMode('setup');
                window.location.hash = '#setup';
              }
            } catch (e) {
              console.error('Failed to restore workspace project on refresh', e);
              setIsRestoring(false);
              // On error, redirect to hub and clean up URL
              const url = new URL(window.location.href);
              url.searchParams.delete('project');
              window.history.replaceState({}, '', url.toString());
              setViewMode('setup');
              window.location.hash = '#setup';
            }
          })();
        });
      } else {
        setIsRestoring(false);
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Only run once on mount - use refs for current values



  // --- AUTH & USER HANDLERS (Refactored) ---
  const {
    handleLaunchDemo,
    handleSignup,
    handleLogin,
    handleUserLoginSuccess,
    handleUserSignupSuccess,
    handlePackageSelect,
    handlePaymentSuccess,
    completeSignup,
    handleUpgradeClick,
    handleProfileClick,
    handleAdminClick,
    handleAdminLoginSuccess,
    handleAdminLogout,
    handleUserLogout
  } = React.useMemo(() => createAuthHandlers({
    setViewMode,
    setShowUserLogin,
    setShowUserSignup,
    setShowSubscription,
    setShowPackageSelection,
    setShowPayment,
    setShowUserProfile,
    setSelectedPackage,
    setPendingUser,
    setSubscriptionMode,
    setAdminToken,
    setAdminUser,
    isProgrammaticHashChangeRef,
    user,
    projectList,
    selectedPackage,
    pendingUser,
    handleCreateNewProject,
    authLogout
  }), [
    setViewMode, setShowUserLogin, setShowUserSignup, setShowSubscription,
    setShowPackageSelection, setShowPayment, setShowUserProfile,
    setSelectedPackage, setPendingUser, setSubscriptionMode,
    setAdminToken, setAdminUser, isProgrammaticHashChangeRef,
    user, projectList, selectedPackage, pendingUser,
    handleCreateNewProject, authLogout
  ]);

  // ... existing resizing state ...
  // Left sidebar state handled by useAppState


  // Memoize collapse handler to prevent unnecessary re-renders
  const handleToggleLogsCollapse = useCallback(() => {
    setIsLogsCollapsed(prev => !prev);
  }, []);

  // ... existing chat state ...


  // Ensure autoPilotStatus is always reset to 'idle' on mount/refresh
  // This prevents any accidental auto-start from previous session
  useEffect(() => {
    // Force reset to idle on component mount (page load/refresh)
    // This ensures HAND-OFF AI never auto-starts after refresh
    // Debug: Component mount (reduced console noise)
    // console.log('Component mounted - resetting HAND-OFF AI to idle state');
    setAutoPilotStatus('idle');
    autoPilotStatusRef.current = 'idle';
    // Stop any running auto-pilot loops
    isStoppingRef.current = true;
    isBatchingRef.current = false;
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
    activeTaskControllersRef.current.forEach(c => c.abort());
    activeTaskControllersRef.current.clear();
  }, []); // Only run once on mount

  // ... existing settings state ...
  // showSettings handled by useAppState



  useEffect(() => { settingsRef.current = appSettings; }, [appSettings]);
  useEffect(() => { autoPilotStatusRef.current = autoPilotStatus; }, [autoPilotStatus]);

  // Track previous viewMode to detect transitions
  const prevViewModeRef = useRef<ViewMode | null>(null);

  // CRITICAL: Reset HAND-OFF AI to idle ONLY when transitioning INTO workspace mode
  // This ensures it never auto-starts when opening a project, but allows it to run once started
  useEffect(() => {
    const prevViewMode = prevViewModeRef.current;
    const isEnteringWorkspace = prevViewMode !== 'workspace' && viewMode === 'workspace';

    if (isEnteringWorkspace && autoPilotStatus !== 'idle') {
      // Force reset HAND-OFF AI to idle state when FIRST entering workspace
      console.log('Entering workspace mode - resetting HAND-OFF AI to idle');
      // Use the same cleanup as stopExecution() to ensure everything is stopped
      isStoppingRef.current = true;
      isBatchingRef.current = false;
      setAutoPilotStatus('idle');
      autoPilotStatusRef.current = 'idle';
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
        batchIntervalRef.current = null;
      }
      activeTaskControllersRef.current.forEach(c => c.abort());
      activeTaskControllersRef.current.clear();
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }

    // Update ref for next comparison
    prevViewModeRef.current = viewMode;
  }, [viewMode]); // Only depend on viewMode, not autoPilotStatus

  useEffect(() => { if (leftTab === 'chat' && appSettings.autoScrollLogs) { globalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); } }, [globalMessages, leftTab, appSettings.autoScrollLogs]);
  useEffect(() => {
    if (setupEndRef.current && viewMode === 'setup') {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        setupEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [setupMessages, viewMode, setupStage]);

  // Auto-switch tabs if they become disabled by permissions
  useEffect(() => {
    if (viewMode === 'workspace') {
      startTransition(() => {
        if (activeTab === 'ide' && !shouldShowFeature(canUseCodeEditor)) {
          setActiveTab('board');
        } else if (activeTab === 'artifacts' && !shouldShowFeature(canUseArtifactViewer)) {
          setActiveTab('board');
        }

        if (leftTab === 'chat' && !shouldShowFeature(canUseAIChat)) {
          setLeftTab('agents');
        }
      });
    }
  }, [viewMode, activeTab, leftTab, canUseCodeEditor, canUseArtifactViewer, canUseAIChat, userRole]);

  // AI Suggestion Logic - Protected by ai_suggestions flag
  useEffect(() => {
    // Only generate suggestions if feature is enabled (don't clear if just loading)
    if (!canUseAISuggestions.enabled) {
      setDynamicSuggestions([]);
      setIsGeneratingSuggestions(false);
      return;
    }

    // Don't generate if still loading feature access
    if (canUseAISuggestions.loading) {
      return;
    }

    const handler = setTimeout(async () => {
      // Skip suggestion generation for error messages, system status messages, or placeholder text
      const inputTrimmed = setupInput.trim();

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
        setIsGeneratingSuggestions(true);
        try {
          if ((import.meta as any).env?.DEV) {
            console.log('[Suggestions] Generating suggestions for input:', setupInput.substring(0, 50));
          }
          const suggestions = await generateQuickSuggestions(setupInput, setupMessages);
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
          setDynamicSuggestions(formatted);
          if ((import.meta as any).env?.DEV && formatted.length > 0) {
            console.log('[Suggestions] Formatted suggestions:', formatted.map(s => s.label));
          } else if ((import.meta as any).env?.DEV && formatted.length === 0) {
            console.log('[Suggestions] No suggestions available (input too short or error)');
          }
        } catch (error) {
          console.error('[Suggestions] Failed to generate suggestions:', error);
          // Don't clear existing suggestions on error, just stop loading
        } finally {
          setIsGeneratingSuggestions(false);
        }
      } else {
        // For system messages or short input, don't generate but keep existing suggestions
        // Only clear if input is completely empty (after debounce delay)
        if (setupInput.trim().length === 0) {
          // Add delay before clearing to prevent flashing
          setTimeout(() => {
            if (setupInput.trim().length === 0) {
              setDynamicSuggestions([]);
            }
          }, 1000); // 1 second delay before clearing when empty
        }
        setIsGeneratingSuggestions(false);
      }
    }, 500); // 500ms debounce before generating

    return () => clearTimeout(handler);
  }, [setupInput, setupMessages, canUseAISuggestions.enabled, canUseAISuggestions.loading]);

  // Convert displayedSuggestions from useMemo to state to match SetupView interface
  // suggestions handled by useAppState


  // Sync displayedSuggestions with dynamicSuggestions
  useEffect(() => {
    setDisplayedSuggestions(dynamicSuggestions);
  }, [dynamicSuggestions]);



  // Debounce and throttle saveProject to prevent rate limiting
  const saveProjectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const pendingSaveRef = useRef<boolean>(false);
  const fixingInvalidIdRef = useRef<string | null>(null); // Track which invalid ID we're fixing
  const MIN_SAVE_INTERVAL = 2000; // Minimum 2 seconds between saves
  const DEBOUNCE_DELAY = 1000; // Wait 1 second after last change before saving

  // --- PROJECT HANDLERS (Refactored) ---
  const {
    saveProject,
    handleLoadSharedProject: loadSharedProject,
    handleLaunchApp: launchApp,
    handleDeleteProject,
    handleToggleSampleProject,
    handleExportProjectData,
    handleRenameProject
  } = React.useMemo(() => createProjectHandlers({
    stateRef,
    dispatch,
    user,
    viewMode,
    startTransition,
    setIsViewOnly,
    setSharedProjectToken,
    setAutoPilotStatus,
    autoPilotStatusRef,
    isStoppingRef,
    isBatchingRef,
    batchIntervalRef,
    activeTaskControllersRef,
    setGlobalMessages,
    setShowUserLogin,
    projectList,
    handleCreateNewProject,
    fixingInvalidIdRef,
    setProjectToDelete,
    adminToken,
    isAdminUser,
    setProjectList,
    sampleProjects,
    setSampleProjects,
    canExportData,
    isFeatureEnabled,
    tempName,
    setIsRenaming,
    showConfirmation,
    addLog
  }), [
    stateRef,
    dispatch,
    user,
    viewMode,
    startTransition,
    setIsViewOnly,
    setSharedProjectToken,
    setAutoPilotStatus,
    autoPilotStatusRef,
    isStoppingRef,
    isBatchingRef,
    batchIntervalRef,
    activeTaskControllersRef,
    setGlobalMessages,
    setShowUserLogin,
    projectList,
    handleCreateNewProject,
    fixingInvalidIdRef,
    setProjectToDelete,
    adminToken,
    isAdminUser,
    setProjectList,
    sampleProjects,
    setSampleProjects,
    canExportData,
    isFeatureEnabled,
    tempName,
    setIsRenaming,
    showConfirmation,
    addLog
  ]);


  // --- TASK HANDLERS (Refactored) ---
  const {
    handleDeleteTask,
    confirmDeleteTask,
    handleUpdateTask,
    handleAiModifyTask,
    handleRunAudit,
    executeTask,
    handleApproveTask,
    handleRejectTask
  } = React.useMemo(() => createTaskHandlers({
    stateRef,
    dispatch,
    addLog,
    setTaskToDelete,
    taskToDelete,
    activeTaskControllersRef,
    settingsRef,
    setGlobalMessages: safeSetGlobalMessages
  }), [
    stateRef,
    dispatch,
    addLog,
    setTaskToDelete,
    taskToDelete,
    activeTaskControllersRef,
    settingsRef,
    safeSetGlobalMessages
  ]);

  // Alias for compatibility with existing usage
  const handleLaunchApp = launchApp;
  const handleLoadSharedProject = loadSharedProject;

  // --- AI HANDLERS (Refactored) ---
  const {
    startAutoPilot: aiStartAutoPilot,
    stopAutoPilot: aiStopAutoPilot,
    handleAutoPilotClick,
    handleEnhanceInput,
    handleDeepResearch,
    handleSuggestionClick,
    handleOpenChat,
    handleSendMessage,
    handleGlobalChatSend,
    handleRunAllTasks,
    advancePhase,
    startNextSprint,
    regressPhase,
    handleForceBuild,
    handleGlobalFileSelect
  } = React.useMemo(() => createAiHandlers({
    stateRef, dispatch, addLog, autoPilotStatus, autoPilotStatusRef, setAutoPilotStatus,
    isStoppingRef, isBatchingRef, activeTaskControllersRef,
    setGlobalMessages: safeSetGlobalMessages, globalMessages, setGlobalChatInput, globalChatInput,
    setSetupMessages, setSetupInput, setupInputRef, setupInput,
    setIsEnhancingChat, setIsEnhancingInput, setIsResearchingChat, setIsResearching,
    activeChatAgent, setActiveChatAgent, chatHistory, setChatHistory, setIsChatThinking, isChatThinking,
    user, handleUpgradeClick, pendingActionRef, setShowHITLPrompt, setAppSettings,
    startTransition, setActiveTab, executeTask, settingsRef, batchIntervalRef,
    setIsProcessingFile, globalFileInputRef
  }), [
    stateRef, dispatch, addLog, autoPilotStatus, autoPilotStatusRef, setAutoPilotStatus,
    isStoppingRef, isBatchingRef, activeTaskControllersRef,
    safeSetGlobalMessages, globalMessages, setGlobalChatInput, globalChatInput,
    setSetupMessages, setSetupInput, setupInputRef, setupInput,
    setIsEnhancingChat, setIsEnhancingInput, setIsResearchingChat, setIsResearching,
    activeChatAgent, setActiveChatAgent, chatHistory, setChatHistory, setIsChatThinking, isChatThinking,
    user, handleUpgradeClick, pendingActionRef, setShowHITLPrompt, setAppSettings,
    startTransition, setActiveTab, executeTask, settingsRef, batchIntervalRef,
    setIsProcessingFile, globalFileInputRef
  ]);

  // Update proxy refs
  React.useEffect(() => {
    if (aiStopAutoPilot) {
      stopAutoPilotRef.current = aiStopAutoPilot;
    }
  }, [aiStopAutoPilot]);

  // Debounced save function to prevent rate limiting
  const debouncedSaveProject = useCallback(() => {
    // Clear any pending timeout
    if (saveProjectTimeoutRef.current) {
      clearTimeout(saveProjectTimeoutRef.current);
    }

    // Check if enough time has passed since last save
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTimeRef.current;

    if (timeSinceLastSave < MIN_SAVE_INTERVAL && !pendingSaveRef.current) {
      // Too soon since last save, schedule it
      saveProjectTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = true;
        lastSaveTimeRef.current = Date.now();
        saveProject().finally(() => {
          pendingSaveRef.current = false;
        });
      }, MIN_SAVE_INTERVAL - timeSinceLastSave);
    } else if (!pendingSaveRef.current) {
      // Debounce: wait for DEBOUNCE_DELAY before saving
      saveProjectTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = true;
        lastSaveTimeRef.current = Date.now();
        saveProject().finally(() => {
          pendingSaveRef.current = false;
        });
      }, DEBOUNCE_DELAY);
    }
  }, [saveProject]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveProjectTimeoutRef.current) {
        clearTimeout(saveProjectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Clear debounce timeout and save immediately
      if (saveProjectTimeoutRef.current) {
        clearTimeout(saveProjectTimeoutRef.current);
        saveProjectTimeoutRef.current = null;
      }
      await saveProject();

      // If there are running tasks or auto-pilot, transfer them to background
      const hasRunningTasks = stateRef.current.tasks.some(t => t.status === TaskStatus.IN_PROGRESS);
      const hasAutoPilot = autoPilotStatusRef.current === 'running';

      if (hasRunningTasks || hasAutoPilot) {
        // Transfer running tasks to background service
        try {
          const runningTasks = stateRef.current.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);

          if (runningTasks.length > 0 && user?.id && stateRef.current.id) {
            // Send tasks to background service
            const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
            const API_BASE_URL = getApiBaseUrl();
            // Try to get token from various possible locations
            const token = localStorage.getItem('authToken') ||
              localStorage.getItem('auth_token') ||
              localStorage.getItem('token') ||
              (user as any)?.token;

            for (const task of runningTasks) {
              const agent = stateRef.current.agents.find(a => a.role === task.assignedTo || a.name === task.assignedTo) || stateRef.current.agents[0];

              if (agent) {
                // Use sendBeacon for reliable delivery even if page is closing
                // sendBeacon doesn't support custom headers, so we'll use a different approach
                const data = {
                  projectId: stateRef.current.id,
                  taskId: task.id,
                  agent: agent,
                  task: task,
                  projectContext: stateRef.current.description,
                  artifacts: stateRef.current.artifacts,
                  useInternet: stateRef.current.useInternet,
                  mcpServers: stateRef.current.mcpServers,
                  standards: stateRef.current.selectedStandards,
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
        if (hasAutoPilot && user?.id && stateRef.current.id) {
          try {
            const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
            const API_BASE_URL = getApiBaseUrl();
            const token = localStorage.getItem('authToken') ||
              localStorage.getItem('auth_token') ||
              localStorage.getItem('token') ||
              (user as any)?.token;

            if (token) {
              const data = {
                projectId: stateRef.current.id,
                projectContext: stateRef.current.description,
                artifacts: stateRef.current.artifacts,
                agents: stateRef.current.agents,
                useInternet: stateRef.current.useInternet,
                mcpServers: stateRef.current.mcpServers,
                standards: stateRef.current.selectedStandards,
                currentPhase: stateRef.current.currentPhase,
                currentSprint: stateRef.current.currentSprint,
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
        if (saveProjectTimeoutRef.current) {
          clearTimeout(saveProjectTimeoutRef.current);
          saveProjectTimeoutRef.current = null;
        }

        // Save to localStorage as emergency backup (works even for guests)
        try {
          const currentState = stateRef.current;
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
        saveProject();

        // Similar logic for running tasks
        const hasRunningTasks = stateRef.current.tasks.some(t => t.status === TaskStatus.IN_PROGRESS);
        if (hasRunningTasks && user?.id && stateRef.current.id) {
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
      if (viewMode === 'workspace') {
        // Clear debounce and save immediately on cleanup
        if (saveProjectTimeoutRef.current) {
          clearTimeout(saveProjectTimeoutRef.current);
          saveProjectTimeoutRef.current = null;
        }
        // Only save if project ID is valid (prevents warnings during cleanup)
        const currentState = stateRef.current;
        if (currentState && isValidObjectId(currentState.id)) {
          saveProject();
        }
      }
    };
  }, [saveProject, viewMode, user]);

  // Save currentProjectId whenever project changes in workspace mode
  useEffect(() => {
    if (viewMode === 'workspace' && state.id && user?.token && user?.id) {
      // Update URL with project ID
      const url = new URL(window.location.href);
      url.hash = '#workspace';
      url.searchParams.set('project', state.id);
      window.history.replaceState({}, '', url.toString());

      // Save to database
      const saveCurrentProject = async () => {
        try {
          const { updateUserSettings } = await import('./services/userSettingsApi');
          await updateUserSettings(user.token!, { currentProjectId: state.id });
        } catch (error) {
          console.warn('Failed to save currentProjectId:', error);
        }
      };
      saveCurrentProject();

      // Only save to localStorage for guest users (not logged in)
      // Logged-in users: database-only via UserSettings
      if (!user?.id) {
        try {
          // Only save valid project IDs to localStorage
          if (isValidObjectId(state.id)) {
            localStorage.setItem('orbitai_current_project_id', state.id);
          } else {
            // Clear invalid ID from localStorage if present
            localStorage.removeItem('orbitai_current_project_id');
          }
        } catch (e) {
          // Ignore localStorage errors for guest users
        }
      }
    }
  }, [state.id, viewMode, user?.token, user?.id]);

  useEffect(() => {
    if (!hasLoaded) return;

    // Don't save demo projects
    if (state.id && state.id.startsWith('demo-')) {
      return;
    }

    // Don't save if user is not authenticated
    if (!user?.id) {
      return;
    }


    // Check if tutorial should be shown (only once for new users)
    let tutorialTimeout: NodeJS.Timeout | null = null;
    if (viewMode === 'workspace' && !hasCompletedTutorial() && !showWorkspaceTutorial) {
      // Small delay to ensure workspace is fully rendered
      tutorialTimeout = setTimeout(() => {
        setShowWorkspaceTutorial(true);
      }, 1000);
    }

    const timeoutId = setTimeout(() => {
      debouncedSaveProject();
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (tutorialTimeout) clearTimeout(tutorialTimeout);
    };
  }, [state, hasLoaded, viewMode, user?.id, showWorkspaceTutorial, debouncedSaveProject]);

  // Store current project ID whenever state.id changes in workspace mode
  // Database-only for logged-in users, localStorage only for guest users
  useEffect(() => {
    if (viewMode === 'workspace' && state.id && state.name !== INITIAL_PROJECT_NAME) {
      // Only save to localStorage for guest users (not logged in)
      // Logged-in users: database-only via UserSettings (handled in saveProject)
      if (!user?.id) {
        try {
          // Only save valid project IDs to localStorage
          if (isValidObjectId(state.id)) {
            localStorage.setItem('orbitai_current_project_id', state.id);
          } else {
            // Clear invalid ID from localStorage if present
            localStorage.removeItem('orbitai_current_project_id');
          }
        } catch (e) {
          // Ignore localStorage errors for guest users
        }
      }
    }
  }, [state.id, state.name, viewMode, user?.id]);







  ;



  // HAND-OFF AI should ONLY start on explicit user button click - never auto-start
  // HAND-OFF AI Handlers replaced by aiHandlers.ts



  useEffect(() => { const handleMouseMove = (e: MouseEvent) => { if (isResizingLeft) setLeftWidth(Math.min(Math.max(e.clientX, 220), 500)); if (isResizingLogs) { setIsLogsCollapsed(false); setLogHeight(Math.min(Math.max(document.body.clientHeight - e.clientY, 36), 600)); } }; const handleMouseUp = () => { setIsResizingLeft(false); setIsResizingLogs(false); }; if (isResizingLeft || isResizingLogs) { document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); document.body.style.cursor = isResizingLogs ? 'row-resize' : 'col-resize'; document.body.style.userSelect = 'none'; } else { document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; } return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; }; }, [isResizingLeft, isResizingLogs]);



  const toggleStandard = useCallback((id: string) => { setTempSelectedStandards(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]); }, []);

  // Check if conversation has enough information to proceed to preview
  const canProceedToPreview = useCallback((messages: ChatMessage[]): { canProceed: boolean; reason?: string } => {
    // Filter out system welcome messages and status messages
    const meaningfulMessages = messages.filter(m => {
      const text = m.text.toLowerCase();
      // Exclude welcome messages and status messages
      return !text.includes('welcome to orbitai') &&
        !text.includes('hello, i am') &&
        !text.includes('transcribing') &&
        !text.includes('ai is thinking') &&
        !text.includes('ai is speaking') &&
        !text.includes('listening');
    });

    const userMessages = meaningfulMessages.filter(m => m.sender === 'user');
    const systemMessages = meaningfulMessages.filter(m => m.sender === 'system' || m.sender === 'agent');

    // Check for research findings
    const hasResearch = systemMessages.some(m =>
      m.text.includes('Research Findings') ||
      m.text.includes('technical specification') ||
      (m.text.includes('initialize the project') && m.text.length > 500)
    );

    // Count meaningful exchanges (user message + AI response pairs)
    const exchangeCount = Math.min(userMessages.length, systemMessages.length);

    // Check if user has provided project description
    const userTexts = userMessages.map(m => m.text).join(' ').toLowerCase();
    const hasProjectIdea = userTexts.length > 20 && (
      userTexts.includes('build') ||
      userTexts.includes('create') ||
      userTexts.includes('develop') ||
      userTexts.includes('make') ||
      userTexts.includes('app') ||
      userTexts.includes('website') ||
      userTexts.includes('game') ||
      userTexts.includes('platform') ||
      userTexts.includes('system') ||
      userTexts.includes('project')
    );

    // Criteria for proceeding:
    // 1. Has research findings (automatic proceed), OR
    // 2. At least 2 meaningful exchanges AND has project idea, OR
    // 3. At least 3 user messages with substantial content

    if (hasResearch) {
      return { canProceed: true, reason: 'Research findings available' };
    }

    if (exchangeCount >= 2 && hasProjectIdea) {
      return { canProceed: true, reason: 'Enough exchanges with project idea' };
    }

    if (userMessages.length >= 3) {
      const totalUserContent = userMessages.reduce((sum, m) => sum + m.text.length, 0);
      if (totalUserContent > 50) {
        return { canProceed: true, reason: 'Multiple user messages with content' };
      }
    }

    // Not enough information
    const missingRequirements: string[] = [];
    if (userMessages.length < 2) {
      missingRequirements.push('more user input');
    }
    if (!hasProjectIdea && userMessages.length > 0) {
      missingRequirements.push('project description');
    }
    if (exchangeCount < 2) {
      missingRequirements.push('more conversation exchanges');
    }

    return {
      canProceed: false,
      reason: missingRequirements.length > 0
        ? `Need ${missingRequirements.join(', ')}`
        : 'Need more information about your project'
    };
  }, []);

  // Helper function to infer standards from project description
  const inferStandardsFromDescription = useCallback((description: string, messages: ChatMessage[]): string[] => {
    const text = `${description} ${messages.map(m => m.text).join(' ')}`.toLowerCase();
    const standards: string[] = [];

    // Game projects - typically need web/app security and accessibility
    if (text.includes('game') || text.includes('gaming') || text.includes('mario') || text.includes('player')) {
      if (text.includes('web') || text.includes('browser') || text.includes('html5')) {
        standards.push('owasp', 'wcag');
      } else {
        standards.push('owasp');
      }
    }

    // Web projects - security and accessibility
    if (text.includes('website') || text.includes('web app') || text.includes('web application') ||
      text.includes('react') || text.includes('vue') || text.includes('angular') || text.includes('html')) {
      standards.push('owasp', 'wcag');
      if (text.includes('e-commerce') || text.includes('ecommerce') || text.includes('payment') || text.includes('shop') || text.includes('store')) {
        standards.push('pci-dss');
      }
      if (text.includes('eu') || text.includes('europe') || text.includes('gdpr')) {
        standards.push('gdpr');
      }
    }

    // Mobile apps
    if (text.includes('mobile') || text.includes('ios') || text.includes('android') ||
      text.includes('react native') || text.includes('flutter') || text.includes('swift') || text.includes('kotlin')) {
      standards.push('owasp');
      if (text.includes('health') || text.includes('medical') || text.includes('patient')) {
        standards.push('hipaa', 'iec62304');
      }
    }

    // Healthcare/Medical
    if (text.includes('health') || text.includes('medical') || text.includes('patient') || text.includes('hospital') || text.includes('clinic')) {
      standards.push('hipaa', 'iec62304');
      if (text.includes('device') || text.includes('medical device')) {
        standards.push('fda21cfr', 'iso13485');
      }
    }

    // Financial
    if (text.includes('finance') || text.includes('banking') || text.includes('payment') ||
      text.includes('transaction') || text.includes('money') || text.includes('bank')) {
      standards.push('pci-dss', 'sox');
    }

    // Automotive
    if (text.includes('automotive') || text.includes('vehicle') || text.includes('car') || text.includes('auto')) {
      standards.push('aspice', 'iso26262');
    }

    // Data/Privacy
    if (text.includes('data') || text.includes('privacy') || text.includes('personal information') || text.includes('user data')) {
      if (text.includes('eu') || text.includes('europe')) {
        standards.push('gdpr');
      }
      if (text.includes('california') || text.includes('ca')) {
        standards.push('ccpa');
      }
      standards.push('gdpr'); // Default to GDPR for data projects
    }

    // Security-focused projects
    if (text.includes('security') || text.includes('secure') || text.includes('encryption') ||
      text.includes('authentication') || text.includes('cyber') || text.includes('hack')) {
      standards.push('owasp', 'iso27001');
    }

    // Cloud/SaaS
    if (text.includes('cloud') || text.includes('saas') || text.includes('aws') || text.includes('azure')) {
      standards.push('soc2', 'iso27001');
    }

    // Remove duplicates and limit to 5, ensure all IDs exist in QUALITY_STANDARDS
    const validStandards = Array.from(new Set(standards))
      .filter(id => QUALITY_STANDARDS.some(s => s.id === id))
      .slice(0, 5);

    return validStandards;
  }, []);

  // Handle manual jump to preview with current conversation
  const handleJumpToPreview = useCallback(async () => {
    if (setupStage === 'preview') {
      console.warn('[Jump to Preview] Already in preview stage');
      return;
    }

    // Check if we have enough information
    const checkResult = canProceedToPreview(setupMessages);
    if (!checkResult.canProceed) {
      console.warn('[Jump to Preview] Not enough information:', checkResult.reason);
      return;
    }

    console.log('[Jump to Preview] Generating preview with current conversation...');

    // Extract user input from messages for preview generation
    const userMessages = setupMessages.filter(m => m.sender === 'user');
    const userText = userMessages
      .map(m => m.text)
      .join('\n')
      .substring(0, 500); // Limit length

    // Use first user message or combined text as project goal
    const projectGoal = userMessages[0]?.text || userText || 'Project based on conversation';

    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      setProcessingLabel("Generating Project Preview...");
      setProcessingProgress(10);

      setProcessingProgress(40);
      const preview = await generateProjectPreview(projectGoal, setupMessages, state.useInternet);

      // Check if this is a game project and generate mechanics
      const isGameProject = state.description?.toLowerCase().includes('game') ||
        state.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ||
        preview.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase()));

      if (isGameProject) {
        setProcessingStatusText('Generating game mechanics code...');
        setProcessingProgress(50);

        try {
          // Auto-detect game engine from tech stack
          let gameEngine: 'unity' | 'godot' | 'phaser' | null = null;
          const allTech = [...(state.techStack || []), ...(preview.techStack || [])];

          if (allTech.some(t => t.toLowerCase().includes('unity'))) {
            gameEngine = 'unity';
          } else if (allTech.some(t => t.toLowerCase().includes('godot'))) {
            gameEngine = 'godot';
          } else if (allTech.some(t => t.toLowerCase().includes('phaser'))) {
            gameEngine = 'phaser';
          } else {
            // Default to Unity for any game without specified engine
            gameEngine = 'unity';
          }

          if (gameEngine) {
            // Import game mechanics service
            const { gameMechanicsClientService } = await import('./services/gameMechanicsService');

            // Generate mechanics
            const mechanicsResult = await gameMechanicsClientService.generateMechanics({
              gameDescription: state.description || projectGoal,
              targetEngine: gameEngine
            });

            // Add to preview
            preview.gameMechanics = mechanicsResult;

            if ((import.meta as any).env?.DEV) {
              console.log('[Game Mechanics Generated]:', {
                engine: gameEngine,
                filesCount: mechanicsResult.files.length
              });
            }
          }
        } catch (mechanicsError) {
          // Non-blocking: Log error but continue with preview
          console.error('[Game Mechanics] Generation failed (non-blocking):', mechanicsError);
        }
      }

      setProcessingProgress(90);

      if ((import.meta as any).env?.DEV) {
        console.log('[Jump to Preview] Preview generated:', {
          hasPreview: !!preview,
          projectName: preview?.projectName
        });
      }

      setProjectPreview(preview);
      setSetupStage('preview');

      // Auto-populate project name
      if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
        if (!setupProjectName.trim() || setupProjectName.trim() === '') {
          setSetupProjectName(preview.projectName.trim());
        }
      }

      // Auto-populate standards
      if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
        const validStandards = Array.isArray(preview.recommendedStandards)
          ? preview.recommendedStandards.filter(id => QUALITY_STANDARDS.some(s => s.id === id))
          : [];
        if (validStandards.length > 0) {
          setTempSelectedStandards(validStandards);
        }
      } else {
        // Try to infer standards from conversation
        if (tempSelectedStandards.length === 0 && userText) {
          const inferredStandards = inferStandardsFromDescription(userText, setupMessages);
          if (inferredStandards.length > 0) {
            setTempSelectedStandards(inferredStandards);
          }
        }
      }

      // Add success message
      const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
        ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics.*`
        : '';

      const sprintsText = preview.estimatedSprints
        ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity analysis.*`
        : '';

      const successMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `✅ **Preview Generated!**\n\nI've created your project blueprint based on our conversation.\n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Optimized for your project type.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change.`,
        timestamp: Date.now()
      };

      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(successMessage.id)) {
          return prev;
        }
        return [...prev, successMessage];
      });

      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);
    } catch (error) {
      console.error('[Jump to Preview] Error generating preview:', error);
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: '⚠️ I encountered an issue generating the preview. Please try again or continue the conversation.',
        timestamp: Date.now()
      };
      setSetupMessages(prev => [...prev, errorMessage]);
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);
    }
  }, [setupMessages, setupStage, canProceedToPreview, state.useInternet, hasManuallyEditedProjectName, setupProjectName, tempSelectedStandards, inferStandardsFromDescription, generateMessageId, dispatch]);

  const handleAddStandard = (id: string) => { const current = state.selectedStandards; if (!current.includes(id)) { dispatch({ type: 'SET_STANDARDS', payload: [...current, id] }); const stdName = QUALITY_STANDARDS.find(s => s.id === id)?.name; addLog(`Compliance Protocol Added: ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'action'); } };
  const handleRemoveStandard = (id: string) => { const current = state.selectedStandards; dispatch({ type: 'SET_STANDARDS', payload: current.filter(s => s !== id) }); const stdName = QUALITY_STANDARDS.find(s => s.id === id)?.name; addLog(`Compliance Protocol Removed: ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'info'); };



  const handleSetupDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingSetup(true); };
  const handleSetupDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingSetup(false); };
  const handleSetupDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingSetup(false); const files = Array.from(e.dataTransfer.files); if (files.length > 0) setSetupFiles(prev => [...prev, ...files]); };
  const removeSetupFile = (index: number) => { setSetupFiles(prev => prev.filter((_, i) => i !== index)); };

  const handleAiThemeGen = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!themeInput.trim()) return;
    setIsGeneratingTheme(true);
    try {
      // Build project context from current state for project-type-aware theming
      const projectContext = [
        state.name && state.name !== INITIAL_PROJECT_NAME ? `Project: ${state.name}` : '',
        state.description ? `Description: ${state.description}` : '',
        state.techStack && state.techStack.length > 0 ? `Tech Stack: ${state.techStack.join(', ')}` : '',
        // Include project type hints from description and tech stack
        state.description?.toLowerCase().includes('game') || state.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ? 'Type: Game' : '',
        state.description?.toLowerCase().includes('website') || state.description?.toLowerCase().includes('web app') || state.techStack?.some(tech => ['react', 'vue', 'angular', 'html', 'css'].includes(tech.toLowerCase())) ? 'Type: Website/Web App' : ''
      ].filter(Boolean).join('\n');

      const newTheme = await generateAppTheme(themeInput, projectContext);
      setAvailableThemes(prev => [...prev, newTheme]);
      const themeId = newTheme.id;
      setSelectedTheme(themeId);
      dispatch({ type: 'SET_THEME', payload: themeId });
      setThemeInput('');
    } catch (err) {
      console.error("Theme Gen Failed", err);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleRandomTheme = async () => {
    setIsGeneratingTheme(true);
    try {
      // Generate random theme descriptions - diverse themes including seasonal, aesthetic, era-based, and creative concepts
      const randomDescriptions = [
        // Seasonal/Holiday Themes
        'Halloween theme with spooky dark purples, oranges, and blacks, featuring bat silhouettes, spider webs, and pumpkin patterns with eerie glowing effects',
        'Christmas theme with festive reds, greens, golds, and whites, featuring snowflakes, stars, holly patterns, and warm sparkle effects',
        'Valentine\'s Day theme with romantic pinks, reds, and whites, featuring heart patterns and elegant cursive fonts',
        'Easter theme with pastel colors including soft pinks, blues, yellows, and greens, featuring egg patterns and spring flowers',
        'Thanksgiving theme with warm autumn colors including browns, oranges, and deep reds, featuring fall leaves and harvest decorations',
        'New Year theme with elegant golds, silvers, and blacks, featuring confetti patterns and celebration graphics',
        // Aesthetic Themes
        'Cyberpunk neon cityscape with electric blues and vibrant purples, featuring grid patterns and glowing effects',
        'Minimalist theme with clean whites, subtle grays, and lots of whitespace, featuring simple borders and soft shadows',
        'Retro 1980s theme with vibrant neons, geometric patterns, and bold typography',
        'Vintage Victorian theme with elegant burgundies, golds, and creams, featuring ornate borders and classic serif fonts',
        'Futuristic sci-fi theme with metallic silvers, electric blues, and holographic effects',
        'Art Deco theme with geometric patterns, gold accents, and elegant black and white contrasts',
        // Nature Themes
        'Ocean depths with deep blues and teals, featuring wave patterns and aquatic textures',
        'Forest green with natural earth tones, featuring leaf patterns and organic shapes',
        'Desert sand with warm beiges and terracotta, featuring cactus silhouettes and sun-baked textures',
        'Aurora borealis with greens and magentas, featuring flowing gradients and ethereal glows',
        'Cherry blossom with soft pinks and whites, featuring delicate flower patterns',
        'Tropical paradise with bright yellows and greens, featuring palm trees and vibrant florals',
        'Arctic ice with cool blues and whites, featuring snowflake patterns and frosty textures',
        // Era-Based Themes
        '1950s Diner theme with retro reds, whites, and chrome, featuring checkerboard patterns and neon signs',
        '1920s Jazz Age theme with art deco golds, blacks, and silvers, featuring geometric patterns',
        'Medieval theme with deep burgundies, golds, and stone grays, featuring heraldic patterns and ornate borders',
        'Space Age 1960s theme with bright oranges, silvers, and whites, featuring rocket and star patterns',
        // Creative/Abstract Themes
        'Neon retro with hot pinks and cyans, featuring grid lines and glowing effects',
        'Mystical forest with dark greens and purples, featuring magical sparkles and ethereal glows',
        'Volcanic with deep reds and oranges, featuring lava-like gradients and intense heat effects',
        'Midnight sky with deep purples and starry whites, featuring constellation patterns',
        'Coral reef with tropical pinks and aquas, featuring underwater textures and marine life patterns',
        'Vintage sepia with browns and creams, featuring old photograph textures and nostalgic borders'
      ];

      const randomDescription = randomDescriptions[Math.floor(Math.random() * randomDescriptions.length)];
      const newTheme = await generateAppTheme(randomDescription);

      // Add the new theme to available themes if it doesn't already exist
      setAvailableThemes(prev => {
        const exists = prev.find(t => t.id === newTheme.id);
        if (exists) {
          setSelectedTheme(newTheme.id);
          return prev;
        }
        return [...prev, newTheme];
      });

      const themeId = newTheme.id;
      setSelectedTheme(themeId);
      dispatch({ type: 'SET_THEME', payload: themeId });
    } catch (err) {
      console.error("Random Theme Gen Failed", err);
      // Fallback to random preset if generation fails
      const randomTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
      setSelectedTheme(randomTheme.id);
      dispatch({ type: 'SET_THEME', payload: randomTheme.id });
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleSetupSend = useCallback(async (e: React.SyntheticEvent, stageContext?: string) => {
    e.preventDefault();

    // Prevent concurrent message processing
    if (isProcessingMessageRef.current) {
      console.warn('[Setup Chat] Message already being processed, skipping duplicate');
      return;
    }

    // Get user text from event target value (for voice input) or setupInput (for text input)
    const eventValue = (e.currentTarget as any)?.value || '';
    const inputText = eventValue.trim() || setupInput.trim();

    if ((!inputText && setupFiles.length === 0) || state.isProcessing) {
      console.log('[Setup Chat] Skipping send:', {
        hasInputText: !!inputText,
        inputTextLength: inputText.length,
        hasFiles: setupFiles.length > 0,
        isProcessing: state.isProcessing
      });
      return;
    }

    let userText = inputText || (setupFiles.length > 0 ? "Review attached files for project scope." : "");

    console.log('[Setup Chat] Processing message:', {
      userText: userText.substring(0, 50),
      source: eventValue ? 'event' : 'setupInput',
      hasStageContext: !!stageContext
    });

    // Handle system context updates (stage changes) - these are silent updates
    if (stageContext && stageContext.startsWith('[SYSTEM CONTEXT UPDATE:')) {
      // This is a stage change notification, add it to history but don't show to user
      const systemMessageId = generateMessageId();
      const systemMessage: ChatMessage = {
        id: systemMessageId,
        sender: 'system',
        text: stageContext,
        timestamp: Date.now()
      };

      // Check for duplicate before adding
      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(systemMessageId)) {
          console.warn('[Setup Chat] Duplicate system message ID detected, skipping');
          return prev;
        }
        processedMessageIdsRef.current.add(systemMessageId);
        return [...prev, systemMessage];
      });
      return; // Don't send to API, just update context
    }

    // Include stage context in the message if provided
    if (stageContext && !userText.includes('[Context:')) {
      userText = `${userText}\n\n[Context: ${stageContext}]`;
    }

    setSetupInput("");
    setDynamicSuggestions([]); // Clear suggestions on send

    // Generate unique message ID and check for duplicates
    let messageId = generateMessageId();

    // Check if this message ID was already processed (very unlikely but check anyway)
    if (processedMessageIdsRef.current.has(messageId)) {
      console.warn('[Setup Chat] Duplicate message ID detected, generating new one');
      // Generate a new ID (very unlikely to collide again)
      messageId = generateMessageId();
    }

    const newMessage: ChatMessage = {
      id: messageId,
      sender: 'user',
      text: setupFiles.length > 0 ? `${userText}\n\n**Attached Files:**\n${setupFiles.map(f => `- ${f.name}`).join('\n')}` : userText,
      timestamp: Date.now()
    };

    // Set processing lock
    isProcessingMessageRef.current = true;
    processedMessageIdsRef.current.add(messageId);

    // Add message with duplicate check - use functional update
    // Also check for duplicate text content to prevent exact duplicates
    let hasDuplicate = false;
    setSetupMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      if (existingIds.has(messageId)) {
        console.warn('[Setup Chat] Duplicate message ID in state, skipping');
        hasDuplicate = true;
        isProcessingMessageRef.current = false; // Release lock
        return prev;
      }

      // Also check for duplicate text content (same text, same sender, within last 5 seconds)
      const recentDuplicate = prev.find(m =>
        m.sender === 'user' &&
        m.text.trim() === newMessage.text.trim() &&
        Date.now() - m.timestamp < 5000 // Within last 5 seconds
      );
      if (recentDuplicate) {
        console.warn('[Setup Chat] Duplicate message text detected (likely double-send), skipping');
        hasDuplicate = true;
        isProcessingMessageRef.current = false; // Release lock
        return prev;
      }

      const updated = [...prev, newMessage];

      console.log('[Setup Chat] Adding user message:', {
        userText,
        messageId: newMessage.id,
        currentMessagesCount: prev.length,
        updatedMessagesCount: updated.length,
        messageText: newMessage.text.substring(0, 50),
        stageContext: stageContext || 'none'
      });

      return updated;
    });

    // If duplicate was detected, abort processing
    if (hasDuplicate) {
      return;
    }

    // Get current messages for processing (will use latest state)
    const currentMessages = setupMessages;
    const updatedMessages = [...currentMessages, newMessage];

    // Check if user is confirming after research findings - generate preview directly
    const confirmationPhrases = ['yes', 'proceed', 'initialize', 'ok', 'okay', 'go ahead', 'let\'s do it', 'sounds good', 'continue'];
    const userTextLower = userText.toLowerCase().trim();
    const isConfirmation = confirmationPhrases.some(phrase =>
      userTextLower === phrase ||
      userTextLower === phrase + '.' ||
      userTextLower.startsWith(phrase + ' ')
    );

    // Find the most recent research findings message
    const researchMessage = [...updatedMessages]
      .reverse()
      .find(m => m.sender === 'system' && (
        m.text.includes('Research Findings') ||
        m.text.includes('technical specification') ||
        (m.text.includes('initialize the project') && m.text.length > 500)
      ));

    // If user confirmed after research findings, generate preview directly
    if (isConfirmation && researchMessage && setupStage !== 'preview') {
      console.log('[Setup Chat] User confirmed after research findings, generating preview directly...');

      // Extract research findings text (everything after "Research Findings:")
      let researchText = researchMessage.text;
      const findingsIndex = researchText.indexOf('Research Findings');
      if (findingsIndex >= 0) {
        researchText = researchText.substring(findingsIndex);
      }

      // Combine user's original request with research findings for preview generation
      const originalUserMessages = updatedMessages
        .filter(m => m.sender === 'user')
        .slice(0, -1) // Exclude the current "yes" message
        .map(m => m.text)
        .join('\n');

      // Use the original project idea, and include research context in message history
      const previewInput = originalUserMessages || userText;

      // Generate preview directly from research findings
      dispatch({ type: 'SET_PROCESSING', payload: true });
      setProcessingLabel("Generating Project Preview from Research...");
      setProcessingProgress(10);

      try {
        // Create a comprehensive message history including research
        const previewMessages = [
          ...updatedMessages.slice(0, -1), // All messages except the "yes"
          {
            ...newMessage,
            text: `${previewInput}\n\n[User confirmed proceeding with research findings]`
          }
        ];

        setProcessingProgress(40);
        const preview = await generateProjectPreview(previewInput, previewMessages, state.useInternet);

        // Generate game mechanics if this is a game project
        const isGameProject = state.description?.toLowerCase().includes('game') ||
          state.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ||
          preview.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase()));

        if (isGameProject) {
          setProcessingStatusText('Generating game mechanics code...');
          setProcessingProgress(50);
          try {
            let gameEngine: 'unity' | 'godot' | 'phaser' | null = null;
            const allTech = [...(state.techStack || []), ...(preview.techStack || [])];
            if (allTech.some(t => t.toLowerCase().includes('unity'))) gameEngine = 'unity';
            else if (allTech.some(t => t.toLowerCase().includes('godot'))) gameEngine = 'godot';
            else if (allTech.some(t => t.toLowerCase().includes('phaser'))) gameEngine = 'phaser';
            else gameEngine = 'unity';

            if (gameEngine) {
              const { gameMechanicsClientService } = await import('./services/gameMechanicsService');
              const mechanicsResult = await gameMechanicsClientService.generateMechanics({
                gameDescription: state.description || previewInput,
                targetEngine: gameEngine
              });
              preview.gameMechanics = mechanicsResult;
            }
          } catch (err) {
            console.error('[Game Mechanics] Generation failed (non-blocking):', err);
          }
        }

        setProjectPreview(preview);
        setSetupStage('preview');

        // Auto-populate project name
        if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
          if (!setupProjectName.trim() || setupProjectName.trim() === '') {
            setSetupProjectName(preview.projectName.trim());
          }
        }

        // Auto-populate standards
        if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
          const validStandards = Array.isArray(preview.recommendedStandards)
            ? preview.recommendedStandards.filter(id => QUALITY_STANDARDS.some(s => s.id === id))
            : [];
          if (validStandards.length > 0) {
            setTempSelectedStandards(validStandards);
          }
        }

        // Add success message
        const successMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'system',
          text: `✅ **Project initialized successfully!**\n\nI've generated your project blueprint based on the research findings.\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change.`,
          timestamp: Date.now()
        };

        setSetupMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          if (existingIds.has(successMessage.id)) {
            return prev;
          }
          return [...prev, successMessage];
        });

        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        isProcessingMessageRef.current = false; // Release lock after successful preview generation
        return; // Exit - preview generated, no need for AI response
      } catch (error) {
        console.error('[Setup Chat] Error generating preview from research:', error);
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'system',
          text: '⚠️ I encountered an issue generating the preview. Let me help you through the normal flow instead.',
          timestamp: Date.now()
        };
        setSetupMessages(prev => [...prev, errorMessage]);
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        // Continue with normal AI chat flow below
      }
    }

    // If we are already in preview stage, check for confirmation keywords
    if (setupStage === 'preview') {
      const lowerText = userText.toLowerCase();
      if (lowerText.includes('start') || lowerText.includes('launch') || lowerText.includes('proceed') || lowerText.includes('go')) {
        // Proceed to launch
        proceedToWorkspace(updatedMessages);
        return;
      }
    }

    // Use LLM chat API for conversation instead of immediately generating preview
    // Only generate preview when user explicitly requests it or AI indicates readiness
    // Don't show processing states during conversation - only when generating preview

    let isGeneratingPreview = false; // Track if we're generating preview to avoid clearing states in finally

    try {
      // Build conversation history for LLM
      const history = updatedMessages
        .filter(msg => msg.sender !== 'system' || !msg.text.includes('Hello, I am Raed'))
        .slice(-10) // Last 10 messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Call LLM chat API with wizard context
      console.log('[Setup Chat] Calling LLM API with:', {
        message: userText.substring(0, 100),
        historyLength: history.length,
        projectStateId: state.id
      });

      const { apiRequest } = await import('@src/services/api');
      const response = await apiRequest<{
        success: boolean;
        response: string;
        usage?: any;
        modelUsed?: string;
        provider?: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userText,
          history: history,
          projectState: state.id ? { id: state.id } : null,
          contextType: 'wizard'
        })
      });

      console.log('[Setup Chat] LLM API response:', {
        success: response.success,
        responseLength: response.response?.length || 0,
        modelUsed: response.modelUsed,
        provider: response.provider
      });

      if (response.success && response.response) {
        console.log('[Setup Chat] Received AI response:', response.response.substring(0, 100) + '...');
        const aiResponseId = generateMessageId();
        const aiResponse: ChatMessage = {
          id: aiResponseId,
          sender: 'system',
          text: response.response,
          timestamp: Date.now()
        };
        setSetupMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          if (existingIds.has(aiResponseId)) {
            console.warn('[Setup Chat] Duplicate AI response ID detected, skipping');
            return prev;
          }

          // Also check for duplicate text content (same text, same sender, within last 5 seconds)
          const recentDuplicate = prev.find(m =>
            m.sender === 'system' &&
            m.text.trim() === aiResponse.text.trim() &&
            Date.now() - m.timestamp < 5000 // Within last 5 seconds
          );
          if (recentDuplicate) {
            console.warn('[Setup Chat] Duplicate AI response text detected (likely double-send), skipping');
            return prev;
          }

          const updated = [...prev, aiResponse];
          console.log('[Setup Chat] Updated messages count:', updated.length, 'New AI message ID:', aiResponse.id);
          console.log('[Setup Chat] Last message sender:', updated[updated.length - 1]?.sender, 'text preview:', updated[updated.length - 1]?.text.substring(0, 50));
          return updated;
        });

        // No processing state during conversation - only when generating preview
        // Check if AI indicates it has enough information or user explicitly requests preview
        const responseText = response.response.toLowerCase();
        const userTextLower = userText.toLowerCase();

        const explicitCompletionPhrases = [
          'i have enough information to generate',
          'i can now generate your project',
          'ready to create your project preview',
          'i have everything i need to get started',
          'perfect! i have enough information',
          'i\'m ready to generate your project'
        ];

        const userRequestPhrases = [
          'generate preview',
          'create preview',
          'show preview',
          'generate project',
          'create project',
          'build project',
          'start project',
          'launch project'
        ];

        // Check if user is confirming after research findings
        const confirmationPhrases = ['yes', 'proceed', 'initialize', 'ok', 'okay', 'go ahead', 'let\'s do it', 'sounds good', 'continue'];
        const userConfirmed = confirmationPhrases.some(phrase => userTextLower.trim() === phrase || userTextLower.trim().startsWith(phrase + ' '));

        // Check if previous message was research findings
        const previousSystemMessage = updatedMessages
          .slice()
          .reverse()
          .find(m => m.sender === 'system');
        const hasRecentResearch = previousSystemMessage && (
          previousSystemMessage.text.includes('Research Findings') ||
          previousSystemMessage.text.includes('initialize the project') ||
          previousSystemMessage.text.includes('technical specification')
        );

        const hasEnoughInfo = explicitCompletionPhrases.some(phrase => responseText.includes(phrase));
        const userRequestedPreview = userRequestPhrases.some(phrase => userTextLower.includes(phrase));
        const messageCount = updatedMessages.filter(m => m.sender === 'user').length;

        // Only generate preview if:
        // 1. User explicitly requests it, OR
        // 2. User confirms after research findings, OR
        // 3. AI indicates readiness AND we have at least 4 exchanges
        if (userRequestedPreview || (userConfirmed && hasRecentResearch) || (hasEnoughInfo && messageCount >= 4)) {
          // Generate preview - NOW we show processing states
          isGeneratingPreview = true;
          dispatch({ type: 'SET_PROCESSING', payload: true });
          setProcessingLabel(projectPreview ? "Refining Prototype..." : "Architecting Solution & Generating Prototype...");
          setProcessingProgress(10);

          // Process files if any
          const fileDataPayload: { mimeType: string, data: string }[] = [];

          setProcessingProgress(40);

          const preview = await generateProjectPreview(userText, [...updatedMessages, aiResponse], state.useInternet, projectPreview);
          if ((import.meta as any).env?.DEV) {
            console.log('[Preview] Received preview data:', {
              hasPreview: !!preview,
              hasArchitectureDiagram: !!preview?.architectureDiagram,
              architectureDiagramLength: preview?.architectureDiagram?.length || 0,
              architectureDiagramPreview: preview?.architectureDiagram?.substring(0, 200) || 'N/A',
              allKeys: preview ? Object.keys(preview) : []
            });
          }
          setProjectPreview(preview);
          setSetupStage('preview');

          // Auto-populate project name if user hasn't entered one and AI suggests a name
          // This ensures the system always suggests a name when available
          if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
            // Only auto-populate if field is empty or still has default value
            if (!setupProjectName.trim() || setupProjectName.trim() === '') {
              setSetupProjectName(preview.projectName.trim());
              if ((import.meta as any).env?.DEV) {
                console.log('[Project Name] Auto-populated AI-suggested name:', preview.projectName);
              }
            }
          } else if ((import.meta as any).env?.DEV) {
            console.log('[Project Name] Skipping auto-populate:', {
              hasManuallyEdited: hasManuallyEditedProjectName,
              currentName: setupProjectName,
              suggestedName: preview.projectName,
              isEmpty: !setupProjectName.trim()
            });
          }

          // Auto-populate standards dropdown with recommended standards
          if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
            console.log('[Standards] Received recommended standards from preview:', preview.recommendedStandards);
            // Ensure we're setting an array
            const standardsArray = Array.isArray(preview.recommendedStandards)
              ? preview.recommendedStandards
              : [preview.recommendedStandards];
            console.log('[Standards] Setting tempSelectedStandards to:', standardsArray);
            console.log('[Standards] Available QUALITY_STANDARDS IDs:', QUALITY_STANDARDS.map(s => s.id));
            console.log('[Standards] Matching standards:', standardsArray.filter(id => QUALITY_STANDARDS.some(s => s.id === id)));
            // Filter to only include valid standard IDs that exist in QUALITY_STANDARDS
            const validStandards = standardsArray.filter(id => QUALITY_STANDARDS.some(s => s.id === id));
            if (validStandards.length > 0) {
              console.log('[Standards] Setting valid standards:', validStandards);
              setTempSelectedStandards(validStandards);
            } else {
              console.warn('[Standards] No valid standards found. Received:', standardsArray, 'Available:', QUALITY_STANDARDS.map(s => s.id));
            }
          } else {
            console.warn('[Standards] No recommended standards in preview:', {
              hasPreview: !!preview,
              hasRecommendedStandards: !!preview?.recommendedStandards,
              standardsLength: preview?.recommendedStandards?.length || 0,
              recommendedStandards: preview?.recommendedStandards
            });

            // Fallback: Try to infer standards from project description if backend didn't return any
            if (tempSelectedStandards.length === 0 && userText) {
              const inferredStandards = inferStandardsFromDescription(userText, setupMessages);
              if (inferredStandards.length > 0) {
                console.log('[Standards] Inferred standards from description:', inferredStandards);
                setTempSelectedStandards(inferredStandards);
              }
            }
          }

          const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
            ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics and compliance requirements.*`
            : '';

          const sprintsText = preview.estimatedSprints
            ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity, team size, and requirements analysis.*`
            : '';

          const systemReply: ChatMessage = {
            id: Math.random().toString(),
            sender: 'system',
            text: `I've generated a project blueprint based on your request. \n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Reasoning: Adapted to your project type for optimal results.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change (e.g., "Add dark mode").`,
            timestamp: Date.now()
          };
          setSetupMessages(prev => [...prev, systemReply]);

          // Clear processing states after preview is generated
          dispatch({ type: 'SET_PROCESSING', payload: false });
          setProcessingLabel(null);
          setProcessingProgress(0);
          setIsResearching(false);
          isGeneratingPreview = false; // Reset flag
        } else {
          // AI wants to continue conversation - no preview generation
          // Processing state already cleared above, just return
          return; // Exit early, don't generate preview
        }
      } else {
        // LLM API failed - fallback to direct preview generation only if user explicitly requested
        const userTextLower = userText.toLowerCase();
        const userRequestedPreview = userTextLower.includes('generate') ||
          userTextLower.includes('preview') ||
          userTextLower.includes('create project') ||
          userTextLower.includes('build project');

        if (!userRequestedPreview) {
          // Don't generate preview if user didn't explicitly request it
          // No processing state to clear - we don't show it during conversation

          // Show error message
          const errorMessage: ChatMessage = {
            id: Math.random().toString(),
            sender: 'system',
            text: 'I encountered an issue processing your message. Please try again or type "generate preview" when you\'re ready to create your project.',
            timestamp: Date.now()
          };
          setSetupMessages(prev => [...prev, errorMessage]);
          return;
        }

        // User explicitly requested preview - generate it
        isGeneratingPreview = true;
        dispatch({ type: 'SET_PROCESSING', payload: true });
        setProcessingLabel(projectPreview ? "Refining Prototype..." : "Architecting Solution & Generating Prototype...");
        setProcessingProgress(10);

        // Process files if any
        const fileDataPayload: { mimeType: string, data: string }[] = [];

        setProcessingProgress(40);

        const preview = await generateProjectPreview(userText, updatedMessages, state.useInternet, projectPreview);
        if ((import.meta as any).env?.DEV) {
          console.log('[Preview] Received preview data:', {
            hasPreview: !!preview,
            hasArchitectureDiagram: !!preview?.architectureDiagram,
            architectureDiagramLength: preview?.architectureDiagram?.length || 0,
            architectureDiagramPreview: preview?.architectureDiagram?.substring(0, 200) || 'N/A',
            allKeys: preview ? Object.keys(preview) : []
          });
        }
        setProjectPreview(preview);
        setSetupStage('preview');

        // Auto-populate project name if user hasn't entered one and AI suggests a name
        if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
          if (!setupProjectName.trim() || setupProjectName.trim() === '') {
            setSetupProjectName(preview.projectName.trim());
            if ((import.meta as any).env?.DEV) {
              console.log('[Project Name] Auto-populated AI-suggested name:', preview.projectName);
            }
          }
        } else if ((import.meta as any).env?.DEV) {
          console.log('[Project Name] Skipping auto-populate:', {
            hasManuallyEdited: hasManuallyEditedProjectName,
            currentName: setupProjectName,
            suggestedName: preview.projectName,
            isEmpty: !setupProjectName.trim()
          });
        }

        // Auto-populate standards dropdown with recommended standards
        if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
          console.log('[Standards] Received recommended standards from preview:', preview.recommendedStandards);
          const standardsArray = Array.isArray(preview.recommendedStandards)
            ? preview.recommendedStandards
            : [preview.recommendedStandards];
          const validStandards = standardsArray.filter(id => QUALITY_STANDARDS.some(s => s.id === id));
          if (validStandards.length > 0) {
            setTempSelectedStandards(validStandards);
          }
        } else {
          if (tempSelectedStandards.length === 0 && userText) {
            const inferredStandards = inferStandardsFromDescription(userText, setupMessages);
            if (inferredStandards.length > 0) {
              setTempSelectedStandards(inferredStandards);
            }
          }
        }

        const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
          ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics and compliance requirements.*`
          : '';

        const sprintsText = preview.estimatedSprints
          ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity, team size, and requirements analysis.*`
          : '';

        const systemReply: ChatMessage = {
          id: Math.random().toString(),
          sender: 'system',
          text: `I've generated a project blueprint based on your request. \n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Reasoning: Adapted to your project type for optimal results.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change (e.g., "Add dark mode").`,
          timestamp: Date.now()
        };
        setSetupMessages(prev => [...prev, systemReply]);

        // Clear processing states after preview is generated
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        setIsResearching(false);
        isGeneratingPreview = false; // Reset flag
      }
    } catch (err: any) {
      console.error("❌ Setup chat failed", err);
      console.error("Error details:", {
        message: err?.message,
        error: err?.error,
        response: err?.response,
        stack: err?.stack
      });
      setIsResearching(false);

      // Extract detailed error message
      const errorMessage = err?.message || err?.error?.message || err?.toString() || 'Unknown error';
      const errorDetails = err?.error?.details || err?.response?.data?.error || '';
      const fullError = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;

      // Check if it's a backend connection error
      const isBackendError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED');
      const backendHint = isBackendError ? '\n\n**Tip:** Make sure the backend server is running at http://localhost:3002' : '';

      // Show toast notification for user feedback
      if (toastService) {
        toastService.error(
          `Failed to process message: ${isBackendError
            ? 'Please check your backend connection'
            : 'Please try again or type "generate preview" when you\'re ready to create your project'}`
        );
      }

      const errReply: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `I encountered an error: ${fullError}${backendHint}\n\nPlease try again or type "generate preview" when you're ready to create your project.`,
        timestamp: Date.now()
      };

      // Add error message with duplicate check
      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(errReply.id)) {
          return prev;
        }
        return [...prev, errReply];
      });
    } finally {
      // Always release the processing lock
      isProcessingMessageRef.current = false;

      // Only clear processing states if we're NOT generating preview
      // If we're generating preview, let it continue showing
      if (!isGeneratingPreview) {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        setIsResearching(false);
      }
      setTimeout(() => setupInputRef.current?.focus(), 100);
    }
  }, [setupInput, setupFiles, state, setupMessages, projectPreview, dispatch, setSetupInput, setSetupMessages, setProjectPreview, setProcessingLabel, setProcessingProgress, setIsResearching, setTempSelectedStandards, setSetupStage, toastService, setupProjectName, hasManuallyEditedProjectName, setSetupProjectName, inferStandardsFromDescription]);

  const proceedToWorkspace = async (history: ChatMessage[]) => {
    let savedProject: any = null;
    // Validate transition prerequisites
    if (!history || history.length === 0) {
      console.error('[Transition] No chat history provided');
      if (toastService) {
        toastService.error('Transition Failed: No chat history available. Please restart the setup process.', 5000);
      }
      return;
    }

    // Warn if no project preview exists (but allow transition)
    if (!projectPreview) {
      console.warn('[Transition] No project preview available, proceeding with conversation history only');
      if (toastService) {
        toastService.warning(
          'No Preview Available: Proceeding to workspace with conversation history. You can generate artifacts manually.',
          5000
        );
      }
    }

    // Validate project name
    const finalProjectName = setupProjectName.trim() || projectPreview?.projectName || '';
    if (!finalProjectName) {
      console.error('[Transition] No project name available');
      if (toastService) {
        toastService.error('Transition Failed: Please provide a project name before launching.', 5000);
      }
      dispatch({ type: 'SET_PROCESSING', payload: false });
      return;
    }

    dispatch({ type: 'SET_PROCESSING', payload: true });
    setProcessingLabel("Initializing Project Environment...");
    setProcessingProgress(0);

    const themeLabel = availableThemes.find(t => t.id === selectedTheme)?.label || 'Standard';

    // Wrap entire transition in try-catch for error recovery
    try {

      // Construct a clean, structured project description
      let structuredDescription = `# PROJECT: ${setupProjectName}\n\n`;

      if (projectPreview) {
        structuredDescription += `## EXECUTIVE SUMMARY\n${projectPreview.summary}\n\n`;
        structuredDescription += `## TECH STACK\n${projectPreview.techStack.map(t => `- ${t}`).join('\n')}\n\n`;
        structuredDescription += `## DESIGN THEME\n${themeLabel} (Theme ID: ${selectedTheme})\n\n`;

        // Embed the architecture diagram directly
        const cleanArch = cleanMermaidCode(projectPreview.architectureDiagram);
        structuredDescription += `## ARCHITECTURE DIAGRAM\n\`\`\`mermaid\n${cleanArch}\n\`\`\`\n\n`;

        // Reference the UI Prototype
        structuredDescription += `## UI PROTOTYPE\n(See 'Wireframe Prototype.html' artifact for the visual mockups. Agents should refer to this artifact for UI tasks.)\n\n`;

        structuredDescription += `## IDENTIFIED RISKS\n${projectPreview.risks.map(r => `- ${r}`).join('\n')}\n\n`;
      }

      structuredDescription += `## INITIAL REQUIREMENTS CONVERSATION\n`;
      structuredDescription += history.map(m => `**${m.sender.toUpperCase()}**: ${m.text}`).join('\n\n');

      // Initialize Project State with automatically determined methodology and estimated sprints
      // Use AI-suggested project name from preview if user hasn't provided one
      const finalProjectName = setupProjectName.trim() || projectPreview?.projectName || '';

      dispatch({
        type: 'SET_PROJECT_DETAILS',
        payload: {
          name: finalProjectName,
          description: structuredDescription,
          methodology: (projectPreview?.recommendedMethodology as Methodology) || 'V-Model',
          estimatedSprints: projectPreview?.estimatedSprints
        }
      });
      // Use recommended standards from preview if available, otherwise use tempSelectedStandards
      const standardsToUse = projectPreview?.recommendedStandards && projectPreview.recommendedStandards.length > 0
        ? projectPreview.recommendedStandards
        : (tempSelectedStandards || []);

      if ((import.meta as any).env?.DEV) {
        console.log('[Standards] Assigning standards to project:', {
          fromPreview: projectPreview?.recommendedStandards,
          fromTemp: tempSelectedStandards,
          final: standardsToUse,
          count: standardsToUse.length
        });
      }

      dispatch({ type: 'SET_STANDARDS', payload: standardsToUse });

      // INTELLIGENT AGENT ASSIGNMENT: Assign existing custom agents or create new ones based on project needs
      // This analyzes project requirements and either assigns existing custom agents or creates new ones
      setProcessingLabel("Intelligently assigning agents to project...");
      try {
        // First, try intelligent assignment (assigns existing custom agents or creates new ones)
        if (user?.id && savedProject?._id) {
          try {
            const intelligentResult = await agentAssignmentService.intelligentlyAssignCustomAgents(
              savedProject._id || savedProject.id,
              structuredDescription,
              Phase.INITIATION
            );

            addLog(
              `Intelligent assignment: ${intelligentResult.assignedExistingAgents} existing agent(s) assigned, ${intelligentResult.createdAgents} new agent(s) created. ${intelligentResult.reasoning}`,
              AgentRole.ORCHESTRATOR,
              'success'
            );

            if ((import.meta as any).env?.DEV) {
              console.log('[Intelligent Assignment]', intelligentResult);
            }
          } catch (intelligentError) {
            console.warn('[Intelligent Assignment] Failed, falling back to system agents:', intelligentError);
            // Fall through to system agent assignment
          }
        }

        // Also assign system agents using AI reasoning (for system agents like Orchestrator, etc.)
        setProcessingLabel("Orchestrator analyzing project requirements...");
        const agentAssignment = await agentAssignmentService.analyzeProjectForAgents(
          finalProjectName,
          structuredDescription,
          Phase.INITIATION
        );

        // Add the assigned system agents to the project
        dispatch({ type: 'ADD_AGENTS', payload: agentAssignment.agents });
        addLog(`Orchestrator assigned ${agentAssignment.agents.length} system agents based on AI analysis: ${agentAssignment.reasoning}`, AgentRole.ORCHESTRATOR, 'action');

        if ((import.meta as any).env?.DEV) {
          console.log('[Agent Assignment]', {
            agents: agentAssignment.agents.map(a => a.role),
            reasoning: agentAssignment.reasoning,
            justifications: agentAssignment.agentJustifications
          });
        }
      } catch (agentError) {
        console.warn('[Agent Assignment] Failed, using fallback:', agentError);
        // Fallback: Add basic team if AI fails
        const fallbackAgents = [AgentRole.REQUIREMENTS_AGENT, AgentRole.UX_DESIGNER, AgentRole.IMPLEMENTATION_AGENT];
        fallbackAgents.forEach(role => {
          const agent = AGENTS.find(a => a.role === role);
          if (agent) dispatch({ type: 'ADD_AGENT', payload: agent });
        });
        addLog('Orchestrator assigned default team (AI analysis unavailable).', AgentRole.ORCHESTRATOR, 'info');
      }
      // MIGRATION: Convert uploaded files to artifacts
      if (setupFiles.length > 0) {
        setProcessingLabel("Processing uploaded files...");
        setProcessingProgress(20);

        for (const file of setupFiles) {
          try {
            // Read file content (limit to 1MB for text files to prevent memory issues)
            let fileContent = '';
            if (file.size < 1024 * 1024 && (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|xml|html|css|js|ts|py|java|cpp|c)$/i))) {
              const reader = new FileReader();
              fileContent = await new Promise<string>((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
              });
            } else {
              fileContent = `[Binary file: ${file.name}]\nSize: ${(file.size / 1024).toFixed(2)} KB\nType: ${file.type || 'unknown'}\n\nThis file was uploaded during project setup but content could not be extracted as text.`;
            }

            // Determine artifact type based on file extension
            let artifactType: 'requirement' | 'design' | 'code' | 'documentation' | 'build' = 'requirement';
            const extension = file.name.split('.').pop()?.toLowerCase();
            if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension || '')) {
              artifactType = 'requirement';
            } else if (['png', 'jpg', 'jpeg', 'svg', 'fig', 'sketch'].includes(extension || '')) {
              artifactType = 'design';
            } else if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c'].includes(extension || '')) {
              artifactType = 'code';
            } else if (['html', 'css', 'json', 'xml'].includes(extension || '')) {
              artifactType = 'build';
            }

            dispatch({
              type: 'ADD_ARTIFACT', payload: {
                id: Math.random().toString(36).substring(7),
                title: file.name,
                content: fileContent,
                type: artifactType,
                phase: Phase.INITIATION,
                createdBy: AgentRole.ORCHESTRATOR,
                timestamp: Date.now(),
                tags: ['Uploaded', 'Wizard']
              }
            });
          } catch (error) {
            console.error(`Failed to process file ${file.name}:`, error);
            // Still create artifact entry even if reading fails
            dispatch({
              type: 'ADD_ARTIFACT', payload: {
                id: Math.random().toString(36).substring(7),
                title: file.name,
                content: `[File upload failed: ${error}]\n\nFile: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB\nType: ${file.type || 'unknown'}`,
                type: 'requirement',
                phase: Phase.INITIATION,
                createdBy: AgentRole.ORCHESTRATOR,
                timestamp: Date.now(),
                tags: ['Uploaded', 'Wizard', 'Error']
              }
            });
          }
        }
      }

      // Add initial artifacts from preview
      if (projectPreview) {
        const cleanArch = cleanMermaidCode(projectPreview.architectureDiagram);

        dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'Executive Summary.md',
            content: projectPreview.summary,
            type: 'requirement',
            phase: Phase.INITIATION,
            createdBy: AgentRole.ORCHESTRATOR,
            timestamp: Date.now(),
            tags: ['Brief']
          }
        });
        dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'System Architecture.mermaid',
            content: `\`\`\`mermaid\n${cleanArch}\n\`\`\``,
            type: 'design',
            phase: Phase.INITIATION,
            createdBy: AgentRole.DESIGN_ARCH_AGENT,
            timestamp: Date.now(),
            tags: ['Architecture']
          }
        });
        dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'Wireframe Prototype.html',
            content: projectPreview.wireframeCode,
            type: 'build',
            phase: Phase.INITIATION,
            createdBy: AgentRole.UX_DESIGNER,
            timestamp: Date.now(),
            tags: ['Prototype']
          }
        });
      }

      // MIGRATION: Extract research findings as knowledge artifacts
      const researchMessages = history.filter(msg =>
        msg.sender === 'system' &&
        (msg.text.includes('Research Findings') || msg.text.includes('Deep Research'))
      );

      if (researchMessages.length > 0) {
        researchMessages.forEach((msg, index) => {
          dispatch({
            type: 'ADD_ARTIFACT', payload: {
              id: Math.random().toString(36).substring(7),
              title: `Research Findings ${index + 1}.md`,
              content: msg.text,
              type: 'requirement',
              phase: Phase.INITIATION,
              createdBy: AgentRole.ORCHESTRATOR,
              timestamp: msg.timestamp,
              tags: ['Research', 'Knowledge', 'Wizard']
            }
          });
        });
      }

      // MIGRATION: Store wizard metadata in project state
      // Get custom themes (themes not in default PROJECT_THEMES)
      const defaultThemeIds = PROJECT_THEMES.map(t => t.id);
      const customThemes = availableThemes
        .filter(t => !defaultThemeIds.includes(t.id))
        .map(t => ({
          id: t.id,
          label: t.label,
          primary: t.primary,
          secondary: (t as any).secondary,
          accent: (t as any).accent
        }));

      // Prepare uploaded files metadata
      const uploadedFilesMetadata = setupFiles.map(file => ({
        name: file.name,
        type: file.type || 'unknown',
        size: file.size
      }));

      // Store wizard metadata via direct state update (since we don't have a reducer action for this)
      const currentState = stateRef.current;
      if (currentState) {
        const updatedState: ProjectState = {
          ...currentState,
          wizardMetadata: {
            templateId: selectedTemplateId || undefined,
            templateName: selectedTemplateName || undefined,
            projectPreview: projectPreview ? {
              summary: projectPreview.summary,
              techStack: projectPreview.techStack,
              risks: projectPreview.risks,
              recommendedMethodology: projectPreview.recommendedMethodology as Methodology,
              recommendedStandards: projectPreview.recommendedStandards,
              estimatedSprints: projectPreview.estimatedSprints,
              projectName: projectPreview.projectName
            } : undefined,
            customThemes: customThemes.length > 0 ? customThemes : undefined,
            uploadedFiles: uploadedFilesMetadata.length > 0 ? uploadedFilesMetadata : undefined
          }
        };
        dispatch({ type: 'RESET_PROJECT', payload: updatedState });
      }

      addLog(`Project initialized based on interactive brief.`, AgentRole.ORCHESTRATOR, 'success');
      if (state.useInternet) addLog(`External Knowledge Access: ENABLED`, AgentRole.ORCHESTRATOR, 'info');
      if ((standardsToUse?.length || 0) > 0) {
        const stdNames = (standardsToUse || []).map(id => (QUALITY_STANDARDS || []).find(s => s.id === id)?.name).filter(Boolean).join(', ');
        addLog(`Compliance Protocols Activated: ${stdNames}`, AgentRole.QA_AUDIT_AGENT, 'action');
      }

      // Transfer setup chat messages to global chat for continuity
      // Filter out the initial welcome message from setup if it exists, and keep the global welcome message
      const setupMessagesToTransfer = history.filter(msg =>
        !(msg.sender === 'system' && msg.text.includes('Hello, I am Raed'))
      );

      // Get the orchestrator agent for proper message formatting
      const orchestrator = stateRef.current.agents.find(a => a.role === AgentRole.ORCHESTRATOR) || AGENTS[0];

      // Transfer messages, converting system messages to agent messages for continuity
      const transferredMessages: ChatMessage[] = setupMessagesToTransfer.map(msg => {
        if (msg.sender === 'system') {
          // Convert system messages to agent messages for continuity in global chat
          return {
            ...msg,
            sender: 'agent' as const,
            agentId: orchestrator.id,
            isLogEvent: false
          };
        }
        return msg;
      });

      // Append transferred messages to global messages (keeping the welcome message)
      setGlobalMessages(prev => {
        // Check if messages are already transferred to avoid duplicates
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = transferredMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMessages];
      });

      setSetupFiles([]);

      // CRITICAL: Save project immediately after adding wizard-created artifacts
      // This ensures all items created in wizard are persisted before transitioning to workspace
      // Wait a brief moment for state updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      await saveProject();

      setViewMode('workspace');
      window.location.hash = '#workspace';
      setProcessingProgress(50);

      // Orchestrate phase will create tasks - save again after it completes
      await orchestratePhase(Phase.INITIATION, structuredDescription);

      // CRITICAL: Save project again after orchestratePhase completes
      // This ensures all tasks and artifacts created during orchestration are persisted
      await new Promise(resolve => setTimeout(resolve, 100));
      await saveProject();

      // Update URL with project ID for proper restoration
      const currentProjectId = stateRef.current?.id;
      if (currentProjectId) {
        const url = new URL(window.location.href);
        url.hash = '#workspace';
        url.searchParams.set('project', currentProjectId);
        window.history.replaceState({}, '', url.toString());
        projectStorage.setCurrentProjectId(currentProjectId);
      }

      setProcessingProgress(100);
      setProcessingLabel("Project initialized successfully!");

      // Clear processing state after a brief delay
      setTimeout(() => {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
      }, 1000);

    } catch (error: any) {
      // Error recovery for transition failures
      console.error('[Transition] Failed to initialize workspace:', error);

      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';

      // Show user-friendly error with recovery options
      if (toastService) {
        toastService.error(
          `Workspace Initialization Failed: ${errorMessage}. You can try again or continue with manual setup.`,
          8000
        );
      }

      // Add error message to chat history
      const errorMsg: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `⚠️ **Transition Error:** ${errorMessage}\n\nYour project data has been saved. You can:\n1. Try launching again\n2. Continue in workspace with manual setup\n3. Contact support if the issue persists.`,
        timestamp: Date.now()
      };

      // Ensure chat history is preserved even on error
      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(errorMsg.id)) {
          return prev;
        }
        return [...prev, errorMsg];
      });

      // Reset processing state
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);

      // Optionally, still transition to workspace but show error
      // Or stay in setup view - for now, we'll stay in setup
      // setViewMode('workspace'); // Uncomment to allow transition despite error
    }
  };

  const handleManualLaunch = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log("Manual Launch Triggered");

    const userText = "Start Project";
    const newMessage: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now()
    };
    const updatedMessages = [...setupMessages, newMessage];
    setSetupMessages(updatedMessages);
    proceedToWorkspace(updatedMessages);
  };

  // Handle launching project from brainstorming view
  const handleLaunchFromBrainstorming = async (brainstormingData: {
    topic: string;
    ideas: any[];
    keyInsights: string[];
    nextSteps: string[];
    projectPreview: ProjectPreview | null;
    selectedStandards: string[];
    messages: ChatMessage[];
    useInternet: boolean;
    conversationId: string | null;
    buildPlatform?: string;
    buildFeatures?: string[];
    workspaceId?: string;
  }) => {
    try {
      const { topic, ideas, keyInsights, nextSteps, projectPreview, selectedStandards, messages, useInternet, conversationId, buildPlatform, buildFeatures, workspaceId } = brainstormingData;

      if (!projectPreview) {
        if (toastService) {
          toastService.error('Launch Failed: Project preview is required to launch. Please generate a prototype first.');
        }
        return;
      }

      dispatch({ type: 'SET_PROCESSING', payload: true });
      setProcessingLabel("Initializing Project from Brainstorming...");
      setProcessingProgress(0);

      // Construct structured description from brainstorming data
      let structuredDescription = `# PROJECT: ${projectPreview.projectName || topic || 'New Project'}\n\n`;

      if (topic) {
        structuredDescription += `## PROJECT TOPIC\n${topic}\n\n`;
      }

      // Add Build Configuration from User Selection
      if (buildPlatform || (buildFeatures && buildFeatures.length > 0)) {
        structuredDescription += `## BUILD CONFIGURATION\n`;
        if (buildPlatform) {
          // Map platform codenames to display names
          const platformName = buildPlatform === 'mobile' ? 'Mobile App (React Native)' :
            buildPlatform === 'web' ? 'Web Application (React/Next.js)' :
              buildPlatform === 'desktop' ? 'Desktop App (Electron/Tauri)' :
                buildPlatform === 'api' ? 'Backend API' :
                  buildPlatform === 'fullstack' ? 'Full Stack Application' : buildPlatform;
          structuredDescription += `- **Target Platform**: ${platformName}\n`;
        }
        if (buildFeatures && buildFeatures.length > 0) {
          structuredDescription += `- **Prioritized Features**: ${buildFeatures.join(', ')}\n`;
        }
        structuredDescription += `\n`;
      }

      if (projectPreview) {
        structuredDescription += `## EXECUTIVE SUMMARY\n${projectPreview.summary}\n\n`;
        structuredDescription += `## TECH STACK\n${projectPreview.techStack.map(t => `- ${t}`).join('\n')}\n\n`;

        // Embed the architecture diagram
        const cleanArch = cleanMermaidCode(projectPreview.architectureDiagram);
        structuredDescription += `## ARCHITECTURE DIAGRAM\n\`\`\`mermaid\n${cleanArch}\n\`\`\`\n\n`;
        structuredDescription += `## UI PROTOTYPE\n(See 'Wireframe Prototype.html' artifact for the visual mockups. Agents should refer to this artifact for UI tasks.)\n\n`;
        structuredDescription += `## IDENTIFIED RISKS\n${projectPreview.risks.map(r => `- ${r}`).join('\n')}\n\n`;

        // Add Full Architecture Analysis if available
        if (projectPreview.backendArchitecture || projectPreview.adminConsole || projectPreview.infrastructure ||
          projectPreview.securityArchitecture || projectPreview.databaseArchitecture || projectPreview.apiDesign) {
          structuredDescription += `## COMPLETE PROJECT ARCHITECTURE\n\n`;
          structuredDescription += `**This section contains the complete architecture breakdown for all project components. Agents MUST reference this when implementing backend, admin, infrastructure, security, database, and API components.**\n\n`;

          // Backend Architecture
          if (projectPreview.backendArchitecture) {
            structuredDescription += `### Backend Architecture\n`;
            structuredDescription += `- **API Server**: ${projectPreview.backendArchitecture.apiServer}\n`;
            structuredDescription += `- **Architecture Pattern**: ${projectPreview.backendArchitecture.architecture}\n`;
            structuredDescription += `- **Framework**: ${projectPreview.backendArchitecture.framework}\n`;
            structuredDescription += `- **Business Logic**: ${projectPreview.backendArchitecture.businessLogic}\n`;
            structuredDescription += `- **Data Access**: ${projectPreview.backendArchitecture.dataAccess}\n`;
            structuredDescription += `- **Background Jobs**: ${projectPreview.backendArchitecture.backgroundJobs}\n`;
            if (projectPreview.backendArchitecture.realTimeServices) {
              structuredDescription += `- **Real-time Services**: ${projectPreview.backendArchitecture.realTimeServices}\n`;
            }
            structuredDescription += `- **Description**: ${projectPreview.backendArchitecture.description}\n\n`;
          }

          // Admin Console
          if (projectPreview.adminConsole && projectPreview.adminConsole.required) {
            structuredDescription += `### Admin Console (REQUIRED)\n`;
            structuredDescription += `- **Required**: Yes\n`;
            structuredDescription += `- **Features**: ${projectPreview.adminConsole.features.join(', ')}\n`;
            structuredDescription += `- **User Management**: ${projectPreview.adminConsole.userManagement ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Content Management**: ${projectPreview.adminConsole.contentManagement ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Analytics**: ${projectPreview.adminConsole.analytics ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **System Configuration**: ${projectPreview.adminConsole.systemConfiguration ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Monitoring**: ${projectPreview.adminConsole.monitoring ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Description**: ${projectPreview.adminConsole.description}\n\n`;
          }

          // Infrastructure
          if (projectPreview.infrastructure) {
            structuredDescription += `### Infrastructure\n`;
            structuredDescription += `- **Application Servers**: ${projectPreview.infrastructure.applicationServers}\n`;
            structuredDescription += `- **Database Servers**: ${projectPreview.infrastructure.databaseServers}\n`;
            structuredDescription += `- **Caching**: ${projectPreview.infrastructure.caching}\n`;
            structuredDescription += `- **Message Queues**: ${projectPreview.infrastructure.messageQueues}\n`;
            structuredDescription += `- **CDN**: ${projectPreview.infrastructure.cdn}\n`;
            structuredDescription += `- **Monitoring**: ${projectPreview.infrastructure.monitoring}\n`;
            structuredDescription += `- **Logging**: ${projectPreview.infrastructure.logging}\n`;
            structuredDescription += `- **Deployment**: ${projectPreview.infrastructure.deployment}\n`;
            structuredDescription += `- **Description**: ${projectPreview.infrastructure.description}\n\n`;
          }

          // Security Architecture
          if (projectPreview.securityArchitecture) {
            structuredDescription += `### Security Architecture\n`;
            structuredDescription += `- **Authentication**: ${projectPreview.securityArchitecture.authentication}\n`;
            structuredDescription += `- **Authorization**: ${projectPreview.securityArchitecture.authorization}\n`;
            structuredDescription += `- **Data Encryption**: ${projectPreview.securityArchitecture.dataEncryption}\n`;
            structuredDescription += `- **API Security**: ${projectPreview.securityArchitecture.apiSecurity}\n`;
            structuredDescription += `- **Rate Limiting**: ${projectPreview.securityArchitecture.rateLimiting ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Security Monitoring**: ${projectPreview.securityArchitecture.securityMonitoring ? 'Yes' : 'No'}\n`;
            if (projectPreview.securityArchitecture.compliance.length > 0) {
              structuredDescription += `- **Compliance Requirements**: ${projectPreview.securityArchitecture.compliance.join(', ')}\n`;
            }
            structuredDescription += `- **Description**: ${projectPreview.securityArchitecture.description}\n\n`;
          }

          // Database Architecture
          if (projectPreview.databaseArchitecture) {
            structuredDescription += `### Database Architecture\n`;
            structuredDescription += `- **Primary Database**: ${projectPreview.databaseArchitecture.primaryDatabase}\n`;
            structuredDescription += `- **Database Type**: ${projectPreview.databaseArchitecture.databaseType.toUpperCase()}\n`;
            structuredDescription += `- **Schema Design**: ${projectPreview.databaseArchitecture.schemaDesign}\n`;
            structuredDescription += `- **Caching Strategy**: ${projectPreview.databaseArchitecture.cachingStrategy}\n`;
            structuredDescription += `- **Backup & Recovery**: ${projectPreview.databaseArchitecture.backupRecovery}\n`;
            structuredDescription += `- **Migrations**: ${projectPreview.databaseArchitecture.migrations}\n`;
            structuredDescription += `- **Description**: ${projectPreview.databaseArchitecture.description}\n\n`;
          }

          // API Design
          if (projectPreview.apiDesign) {
            structuredDescription += `### API Design\n`;
            structuredDescription += `- **API Style**: ${projectPreview.apiDesign.apiStyle}\n`;
            if (projectPreview.apiDesign.endpoints.length > 0) {
              structuredDescription += `- **Key Endpoints**:\n${projectPreview.apiDesign.endpoints.map(e => `  - ${e}`).join('\n')}\n`;
            }
            if (projectPreview.apiDesign.externalIntegrations.length > 0) {
              structuredDescription += `- **External Integrations**: ${projectPreview.apiDesign.externalIntegrations.join(', ')}\n`;
            }
            if (projectPreview.apiDesign.thirdPartyServices.length > 0) {
              structuredDescription += `- **Third-party Services**: ${projectPreview.apiDesign.thirdPartyServices.join(', ')}\n`;
            }
            if (projectPreview.apiDesign.webhooks.length > 0) {
              structuredDescription += `- **Webhooks**: ${projectPreview.apiDesign.webhooks.join(', ')}\n`;
            }
            structuredDescription += `- **Documentation**: ${projectPreview.apiDesign.documentation}\n`;
            structuredDescription += `- **Description**: ${projectPreview.apiDesign.description}\n\n`;
          }

          structuredDescription += `**IMPORTANT FOR AGENTS**: When implementing tasks, refer to the appropriate architecture section above. For example:\n`;
          structuredDescription += `- Backend tasks → Reference "Backend Architecture" section\n`;
          structuredDescription += `- Admin panel tasks → Reference "Admin Console" section\n`;
          structuredDescription += `- Database tasks → Reference "Database Architecture" section\n`;
          structuredDescription += `- API tasks → Reference "API Design" section\n`;
          structuredDescription += `- Security tasks → Reference "Security Architecture" section\n`;
          structuredDescription += `- Infrastructure/deployment tasks → Reference "Infrastructure" section\n\n`;
        }
      }

      // Add ideas as requirements
      if (ideas && ideas.length > 0) {
        structuredDescription += `## KEY IDEAS & REQUIREMENTS\n`;
        ideas.forEach(idea => {
          structuredDescription += `### ${idea.label}\n`;
          if (idea.description) structuredDescription += `${idea.description}\n`;
          if (idea.notes) structuredDescription += `\n**Notes:** ${idea.notes}\n`;
          structuredDescription += `\n`;
        });
      }

      // Add key insights
      if (keyInsights && keyInsights.length > 0) {
        structuredDescription += `## KEY INSIGHTS\n${keyInsights.map(insight => `- ${insight}`).join('\n')}\n\n`;
      }

      // Add next steps
      if (nextSteps && nextSteps.length > 0) {
        structuredDescription += `## RECOMMENDED NEXT STEPS\n${nextSteps.map(step => `- ${step}`).join('\n')}\n\n`;
      }

      // Add conversation history
      if (messages && messages.length > 0) {
        structuredDescription += `## BRAINSTORMING CONVERSATION\n`;
        structuredDescription += messages.map(m => `**${m.sender.toUpperCase()}**: ${m.text}`).join('\n\n');
      }

      const finalProjectName = projectPreview.projectName || topic || 'New Project';

      // Initialize project state
      dispatch({
        type: 'SET_PROJECT_DETAILS',
        payload: {
          name: finalProjectName,
          description: structuredDescription,
          methodology: (projectPreview.recommendedMethodology as Methodology) || 'V-Model',
          estimatedSprints: projectPreview.estimatedSprints
        }
      });

      // Set standards
      const standardsToUse = projectPreview.recommendedStandards && projectPreview.recommendedStandards.length > 0
        ? projectPreview.recommendedStandards
        : (selectedStandards || []);
      dispatch({ type: 'SET_STANDARDS', payload: standardsToUse });

      // Set internet usage
      dispatch({ type: 'TOGGLE_INTERNET', payload: useInternet });

      setProcessingLabel("Creating project artifacts...");
      setProcessingProgress(20);

      // Create artifacts from project preview
      if (projectPreview.wireframeCode) {
        dispatch({
          type: 'ADD_ARTIFACT',
          payload: {
            id: `wireframe-${Date.now()}`,
            title: 'Wireframe Prototype.html',
            content: projectPreview.wireframeCode,
            type: 'build',
            phase: Phase.ARCHITECTURE,
            timestamp: Date.now(),
            createdBy: 'Project Manager',
            tags: ['prototype', 'wireframe']
          }
        });
      }

      if (projectPreview.architectureDiagram) {
        dispatch({
          type: 'ADD_ARTIFACT',
          payload: {
            id: `architecture-${Date.now()}`,
            title: 'Architecture Diagram.mmd',
            content: projectPreview.architectureDiagram,
            type: 'design',
            phase: Phase.ARCHITECTURE,
            timestamp: Date.now(),
            createdBy: 'Architect',
            tags: ['architecture', 'diagram']
          }
        });
      }

      // NEW: Create Project Brief artifact
      dispatch({
        type: 'ADD_ARTIFACT',
        payload: {
          id: `project-brief-${Date.now()}`,
          title: 'Project Brief.md',
          content: structuredDescription,
          type: 'requirement', // Using 'requirement' as it is a valid ArtifactType
          phase: Phase.INITIATION,
          timestamp: Date.now(),
          createdBy: 'Project Manager',
          tags: ['brief', 'requirements']
        }
      });

      setProcessingProgress(40);
      setProcessingLabel("Saving project...");

      // Store full project preview (including architecture analysis) in wizardMetadata
      // This ensures agents can access the complete architecture analysis during execution
      // Also store conversationId to link the project back to its conversation
      const currentState = stateRef.current;
      if (currentState) {
        const updatedState: ProjectState = {
          ...currentState,
          wizardMetadata: {
            ...currentState.wizardMetadata,
            projectPreview: projectPreview, // Store complete project preview with architecture analysis
            conversationId: conversationId || undefined, // Link project to conversation
            data: {
              ...(currentState.wizardMetadata?.data || {}),
              brainstormingContext: {
                concept: topic,
                ideas: ideas,
                keyInsights: keyInsights,
                audience: 'General', // Default/Placeholder
                style: 'Standard', // Default/Placeholder
                coreLoop: 'Standard gameplay' // Default/Placeholder
              }
            }
          },
          folderId: workspaceId || currentState.folderId
        };
        dispatch({ type: 'RESET_PROJECT', payload: updatedState });
      }

      // Save project first to get the project ID
      await saveProject();

      // Link conversation to project after project is saved (so we have the project ID)
      if (conversationId && user) {
        try {
          const { chatApi } = await import('@src/services/chatApi');
          const projectId = stateRef.current?.id;
          if (projectId) {
            await chatApi.updateNeuralChat(conversationId, {
              projectId: projectId
            });
            if (import.meta.env.DEV) {
              console.log('[Launch Project] Linked conversation to project:', { conversationId, projectId });
            }
          }
        } catch (linkError) {
          console.warn('[Launch Project] Failed to link conversation to project:', linkError);
          // Don't fail the launch if linking fails
        }
      }

      setProcessingProgress(60);
      setProcessingLabel("Initializing workspace...");

      // Navigate to workspace
      setViewMode('workspace');
      window.location.hash = '#workspace';

      setProcessingProgress(80);

      // Orchestrate initiation phase
      await orchestratePhase(Phase.INITIATION, structuredDescription);

      setProcessingProgress(100);

      // Save again after orchestration
      await saveProject();

      // Update URL with project ID
      const currentProjectId = state.id;
      if (currentProjectId) {
        const url = new URL(window.location.href);
        url.searchParams.set('project', currentProjectId);
        window.history.replaceState({}, '', url.toString());
      }

      if (toastService) {
        toastService.success('Project Launched: Your project has been created and is ready to start!', 3000);
      }

      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingProgress(0);
      setProcessingLabel(null);

    } catch (error: any) {
      console.error('[Launch from Brainstorming] Failed:', error);
      if (toastService) {
        toastService.error('Launch Failed: ' + (error.message || 'Failed to launch project. Please try again.'));
      }
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingProgress(0);
      setProcessingLabel(null);
    }
  };

  const handleResetProject = () => { setViewMode('setup'); };
  const orchestratePhase = async (phase: Phase, description: string) => {
    // Track start time for accurate time estimation
    const startTime = Date.now();
    processingStartTimeRef.current = startTime;

    // Helper function to calculate and update estimated time based on actual elapsed time
    const updateEstimatedTime = (currentProgress: number) => {
      if (!processingStartTimeRef.current) return;
      const elapsedMs = Date.now() - processingStartTimeRef.current;
      const elapsedSeconds = elapsedMs / 1000;

      // Calculate estimated remaining time based on progress and elapsed time
      // Progress is not linear - most time is spent on LLM call (typically 2-8 seconds)
      if (currentProgress < 50) {
        // Before LLM call completes: estimate conservatively
        // Most orchestration time (70-80%) is spent waiting for LLM response
        // Typical LLM call: 3-6 seconds, but can be up to 8-10 seconds
        const typicalLLMDuration = 6; // Conservative estimate: 6 seconds for LLM
        const remainingForLLM = Math.max(3, typicalLLMDuration - elapsedSeconds);
        const remainingForProcessing = 3; // Task processing after LLM (conservative)
        const estimatedRemaining = remainingForLLM + remainingForProcessing;
        // Always show at least 5 seconds if early in process
        setProcessingEstimatedTime(Math.ceil(Math.max(5, estimatedRemaining)));
      } else if (currentProgress >= 50 && currentProgress < 90) {
        // After LLM call: estimate based on remaining task processing
        // Use actual elapsed time to predict remaining, but be conservative
        const progressRatio = Math.max(0.1, currentProgress / 100);
        const estimatedTotalSeconds = elapsedSeconds / progressRatio;
        const estimatedRemaining = estimatedTotalSeconds - elapsedSeconds;
        // Add 50% buffer for safety (was 20%, now more conservative)
        const bufferedRemaining = estimatedRemaining * 1.5;
        setProcessingEstimatedTime(Math.ceil(Math.max(2, bufferedRemaining)));
      } else {
        // Almost done (90%+)
        setProcessingEstimatedTime(1);
      }
    };

    // Initialize processing state
    setProcessingLabel(`Orchestrating Strategy for ${phase}...`);
    setProcessingProgress(10);
    setProcessingStatusText('Analyzing project requirements...');
    updateEstimatedTime(10);
    setProcessingTaskCount(0);
    dispatch({ type: 'SET_PROCESSING', payload: true });
    addLog(`Orchestrating tasks for ${phase} (Sprint ${stateRef.current.currentSprint})...`, AgentRole.ORCHESTRATOR, 'action');

    const currentState = stateRef.current;
    const allCompleted = currentState.tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const localAgents = [...currentState.agents];

    // Stage 1: Connect to AI orchestrator
    setProcessingLabel(`Orchestrating Strategy for ${phase}...`);
    setProcessingStatusText('Connecting to AI orchestrator...');
    setProcessingProgress(20);
    updateEstimatedTime(20);

    // Stage 2: Generate task breakdown
    setProcessingStatusText('Generating task breakdown...');
    setProcessingProgress(30);
    updateEstimatedTime(30);

    let result;
    try {
      result = await orchestrateNextSteps(phase, description, allCompleted, currentState.useInternet, currentState.mcpServers, settingsRef.current.maxTasksPerPhase, localAgents);
    } catch (error: any) {
      // Check if it's a connection error (backend not running)
      if (error?.isConnectionError || error?.message?.includes('Backend server is not running') || error?.message?.includes('Failed to fetch')) {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        setProcessingStatusText(undefined);
        toast.error(
          `Backend server is not running. Please start it:\n\n1. Open a terminal\n2. cd server\n3. npm run dev\n\nThe server should run on http://localhost:3002`,
          10000
        );
        addLog(
          `❌ Backend server is not running. Please start it:\n\n` +
          `1. Open a terminal\n` +
          `2. cd server\n` +
          `3. npm run dev\n\n` +
          `The server should run on http://localhost:3002`,
          AgentRole.ORCHESTRATOR,
          'error'
        );
        alert(
          'Backend Server Not Running\n\n' +
          'Please start the backend server:\n\n' +
          '1. Open a terminal\n' +
          '2. cd server\n' +
          '3. npm run dev\n\n' +
          'The server should run on http://localhost:3002\n\n' +
          'Check the console for more details.'
        );
        return;
      }
      // Re-throw other errors
      throw error;
    }

    // Stage 3: Assign agents to tasks
    setProcessingProgress(50);
    setProcessingStatusText('Assigning agents to tasks...');
    updateEstimatedTime(50);

    if (result && result.tasks && result.tasks.length > 0) {
      setProcessingLabel("Provisioning Agents & Generating Tasks...");
      setProcessingTaskCount(result.tasks.length);

      const titleToIdMap = new Map<string, string>();
      currentState.tasks.forEach(t => titleToIdMap.set(t.title, t.id));

      const tasksWithIds = result.tasks.map(t => {
        const newId = Math.random().toString(36).substring(7);
        if (t.title) titleToIdMap.set(t.title, newId);
        return { ...t, id: newId };
      });

      // OPTIMIZATION: Process tasks in batches with async breaks to keep UI responsive
      const processTask = async (t: any, index: number) => {
        if (!t.title) return;

        let safeAssignedTo = String(t.assignedTo || AgentRole.ORCHESTRATOR).trim();
        const targetRoleLower = safeAssignedTo.toLowerCase();

        // OPTIMIZATION: Faster agent lookup - simplified matching
        let existingAgent = localAgents.find(a => {
          const roleLower = a.role.toLowerCase();
          const nameLower = a.name.toLowerCase();
          return roleLower === targetRoleLower ||
            nameLower === targetRoleLower ||
            (roleLower.includes(targetRoleLower) && targetRoleLower.length > 3) ||
            (targetRoleLower.includes(roleLower) && roleLower.length > 3);
        });

        // OPTIMIZATION: Skip agent creation if not found - assign to Orchestrator immediately
        // Agent creation can be done later if needed, don't block task generation
        if (!existingAgent) {
          const isGeneric = ['undefined', 'unknown', 'unassigned', 'orchestrator'].includes(targetRoleLower);
          if (!isGeneric && targetRoleLower.length > 3) {
            // Try to create agent but with timeout to avoid blocking
            try {
              setProcessingStatusText(`Assigning agent for task ${index + 1}...`);
              const agentPromise = generateAgentProfile(safeAssignedTo, currentState.description);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Agent creation timeout')), 20000) // Increased to 20s to allow LLM API calls to complete
              );

              const newAgent = await Promise.race([agentPromise, timeoutPromise]) as Agent;
              const duplicate = localAgents.find(a =>
                a.role.toLowerCase() === newAgent.role.toLowerCase() ||
                a.name.toLowerCase() === newAgent.name.toLowerCase()
              );
              if (!duplicate) {
                dispatch({ type: 'ADD_AGENT', payload: newAgent });
                localAgents.push(newAgent);
                safeAssignedTo = newAgent.role;
              } else {
                safeAssignedTo = duplicate.role;
              }
            } catch (e) {
              // Timeout or error - just use Orchestrator, don't block
              console.warn("Agent creation skipped, using Orchestrator", e);
              safeAssignedTo = AgentRole.ORCHESTRATOR;
            }
          } else {
            safeAssignedTo = AgentRole.ORCHESTRATOR;
          }
        } else {
          safeAssignedTo = existingAgent.role;
        }

        // Resolve dependencies quickly
        const resolvedDeps: string[] = [];
        if (t.dependencies && Array.isArray(t.dependencies)) {
          t.dependencies.forEach(depTitle => {
            const depId = titleToIdMap.get(depTitle);
            if (depId) {
              resolvedDeps.push(depId);
            } else {
              const match = Array.from(titleToIdMap.keys()).find(k => k.toLowerCase() === depTitle.toLowerCase());
              if (match) {
                resolvedDeps.push(titleToIdMap.get(match)!);
              }
            }
          });
        }

        // OPTIMIZATION: Add task immediately (optimistic UI update)
        dispatch({
          type: 'ADD_TASK',
          payload: {
            id: t.id,
            title: t.title,
            description: t.description || "Task generated by Orchestrator",
            assignedTo: safeAssignedTo,
            phase: phase,
            status: TaskStatus.PENDING,
            dependencies: resolvedDeps,
            logs: [],
            progress: 0,
            traceRefs: t.traceRefs || [],
            sprint: currentState.currentSprint,
            // Initialize evaluation with pending status (will be calculated when task is executed)
            evaluation: {
              score: 0,
              reasoning: 'Quality score will be calculated when task is executed.',
              criteria: [],
              timestamp: Date.now()
            }
          }
        });
        addLog(`Created task: ${t.title} -> ${safeAssignedTo}`, AgentRole.ORCHESTRATOR);

        // Update progress
        const p = 50 + Math.round(((index + 1) / tasksWithIds.length) * 50);
        setProcessingProgress(Math.min(99, p));
      };
      // Process tasks with async breaks to keep UI responsive
      for (let i = 0; i < tasksWithIds.length; i++) {
        await processTask(tasksWithIds[i], i);
        // Yield to browser every 2 tasks to keep UI responsive
        if ((i + 1) % 2 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    } else {
      addLog(`No new tasks generated. Phase might be complete.`, AgentRole.ORCHESTRATOR, 'info');
    }

    // Complete
    setProcessingProgress(100);
    setProcessingStatusText('Complete!');
    setProcessingEstimatedTime(0);

    setTimeout(() => {
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);
      setProcessingStatusText(undefined);
      setProcessingEstimatedTime(undefined);
      setProcessingTaskCount(undefined);
      processingStartTimeRef.current = null;
    }, 500);
  };



  // ... helpers ...
  const determineArtifactType = (phase: Phase): Artifact['type'] => { if (phase === Phase.REQUIREMENTS) return 'requirement'; if (phase === Phase.ARCHITECTURE) return 'design'; if (phase === Phase.IMPLEMENTATION) return 'code'; if (phase === Phase.TEST_PLANNING) return 'test-plan'; return 'audit-report'; };
  const handleSaveArtifact = (id: string, content: string) => { dispatch({ type: 'UPDATE_ARTIFACT', payload: { id, content } }); addLog(`Artifact manually updated via IDE`, AgentRole.IMPLEMENTATION_AGENT, 'info'); };
  const handleArtifactUpload = (file: File, content: string | ArrayBuffer) => { let type: Artifact['type'] = 'code'; const ext = (file.name.split('.').pop() || "").toLowerCase(); if (file.type.startsWith('image/')) type = 'image'; else if (file.type.startsWith('audio/')) type = 'audio'; else if (ext === 'md' || ext === 'txt') type = 'requirement'; else if (ext === 'json') type = 'design'; else if (ext === 'html') type = 'build'; const newArtifact: Artifact = { id: Math.random().toString(36).substring(7), title: file.name, content: content as string, type: type, phase: stateRef.current.currentPhase, createdBy: AgentRole.IMPLEMENTATION_AGENT, timestamp: Date.now(), tags: ['uploaded', stateRef.current.currentPhase] }; dispatch({ type: 'ADD_ARTIFACT', payload: newArtifact }); addLog(`File uploaded: ${file.name}`, AgentRole.ORCHESTRATOR, 'info'); };


  const TabButton = ({ id, label, icon: Icon, active, onClick, count, className = '' }: { id: string, label: string, icon: any, active: boolean, onClick: () => void, count?: number, className?: string }) => (
    <button onClick={onClick} className={`relative px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-1 shrink-0 ${active ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'} ${className}`}>
      <Icon size={12} /> <span className="whitespace-nowrap">{label}</span> {count !== undefined && count > 0 && <span className={`ml-1 px-1 py-0.5 rounded-full text-[8px] font-mono ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
    </button>
  );

  const hasFrontend = useMemo(() => {
    if (!projectPreview?.techStack) return true; // Default to true if unsure
    return projectPreview.techStack.some(t => /react|vue|angular|svelte|html|css|web|ui|frontend|mobile|app/i.test(t));
  }, [projectPreview]);

  // Memoize preview artifacts to prevent unnecessary re-renders
  // Use a stable reference to prevent the artifact from being recreated unnecessarily
  // Store the last valid artifact to prevent it from disappearing
  const architectureDiagramContent = projectPreview?.architectureDiagram;
  const lastValidArtifactRef = useRef<{
    id: string;
    title: string;
    type: 'design';
    content: string;
    phase: Phase;
    createdBy: typeof AgentRole[keyof typeof AgentRole];
    timestamp: number;
    tags: string[];
  } | null>(null);

  const architectureArtifact = useMemo(() => {
    if (!architectureDiagramContent) {
      // If we have a previous valid artifact, keep it to prevent disappearing
      if (lastValidArtifactRef.current) {
        // Debug: Flow tab (reduced console noise)
        // if ((import.meta as any).env?.DEV) {
        //   console.log('[Flow Tab] No architectureDiagram in preview, using cached artifact');
        // }
        return lastValidArtifactRef.current;
      }
      // Silently handle missing architecture diagram - not an error
      // Debug: Flow tab (reduced console noise)
      // if ((import.meta as any).env?.DEV) {
      //   console.debug('[Flow Tab] No architectureDiagram in preview');
      // }
      return null;
    }
    const cleaned = cleanMermaidCode(architectureDiagramContent);
    // Check if cleaned diagram is empty or just whitespace
    if (!cleaned || cleaned.trim().length === 0) {
      // If we have a previous valid artifact, keep it
      if (lastValidArtifactRef.current) {
        // Debug: Flow tab (reduced console noise)
        // if ((import.meta as any).env?.DEV) {
        //   console.log('[Flow Tab] Architecture diagram is empty after cleaning, using cached artifact');
        // }
        return lastValidArtifactRef.current;
      }
      // Debug: Flow tab (reduced console noise)
      // if ((import.meta as any).env?.DEV) {
      //   console.log('[Flow Tab] Architecture diagram is empty after cleaning:', {
      //     original: architectureDiagramContent?.substring(0, 100),
      //     cleaned: cleaned
      //   });
      // }
      return null;
    }
    // Debug: Flow tab (reduced console noise)
    // if ((import.meta as any).env?.DEV) {
    //   console.log('[Flow Tab] Architecture diagram is valid, length:', cleaned.length);
    // }
    // Create new artifact and cache it
    const newArtifact = {
      id: 'preview-arch',
      title: 'Architecture.mermaid',
      type: 'design' as const,
      content: cleaned,
      phase: Phase.INITIATION,
      createdBy: AgentRole.DESIGN_ARCH_AGENT,
      timestamp: Date.now(),
      tags: ['preview']
    };
    lastValidArtifactRef.current = newArtifact;
    return newArtifact;
  }, [architectureDiagramContent]); // Only depend on the diagram content, not the entire preview object

  const wireframeArtifact = useMemo(() => {
    if (!projectPreview?.wireframeCode) return null;
    return {
      id: 'preview-wireframe',
      title: 'Prototype.html',
      type: 'build' as const,
      content: projectPreview.wireframeCode,
      phase: Phase.INITIATION,
      createdBy: AgentRole.UX_DESIGNER,
      timestamp: Date.now(),
      tags: ['preview']
    };
  }, [projectPreview?.wireframeCode]);

  // Demo mode check for non-authenticated users
  const isDemoMode = !user && !isViewOnly && viewMode === 'workspace';

  // --- RENDER ---
  if (isAuthCallback) {
    if (!OAuthCallbackComponent) return <div className="fixed inset-0 flex items-center justify-center bg-slate-900 text-white">Loading Auth...</div>;
    return <OAuthCallbackComponent />;
  }

  return (
    <div className={`flex flex-col font-sans selection:bg-primary selection:text-white relative ${isModernView && viewMode === 'workspace' ? 'bg-slate-900 text-slate-50' : 'bg-slate-50 text-slate-900'} ${viewMode === 'landing' ? '' : 'h-screen overflow-hidden'}`}>

      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[300] bg-red-600 text-white px-4 py-3 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300 shadow-lg">
          <WifiOff size={20} />
          <p className="text-sm font-bold">
            Platform cannot be used offline. Please connect to the internet.
          </p>
        </div>
      )}

      {/* App Router - Handles all view routing */}




      <AppShell
        viewMode={viewMode}
        isModernView={isModernView}
        isOffline={isOffline}
        state={state}
        user={user}
        toasts={appState.toasts}

        // Modals
        showSubscription={appState.showSubscription}
        setShowSubscription={appState.setShowSubscription}
        subscriptionMode={appState.subscriptionMode}
        setSubscriptionMode={appState.setSubscriptionMode}
        showThemeStudio={appState.showThemeStudio}
        setShowThemeStudio={appState.setShowThemeStudio}
        showUserProfile={appState.showUserProfile}
        setShowUserProfile={appState.setShowUserProfile}
        showUserLogin={appState.showUserLogin}
        setShowUserLogin={appState.setShowUserLogin}
        showUserSignup={appState.showUserSignup}
        setShowUserSignup={appState.setShowUserSignup}
        handleUserLoginSuccess={handleUserLoginSuccess}
        handleUserSignupSuccess={handleUserSignupSuccess}
        showHITLPrompt={appState.showHITLPrompt}
        setShowHITLPrompt={appState.setShowHITLPrompt}
        showSettings={appState.showSettings}
        setShowSettings={appState.setShowSettings}
        showTemplateSelector={appState.showTemplateSelector}
        setShowTemplateSelector={appState.setShowTemplateSelector}

        // Modal Data
        editingTask={appState.editingTask}
        setEditingTask={appState.setEditingTask}
        selectedAgentDetail={appState.selectedAgentDetail}
        setSelectedAgentDetail={appState.setSelectedAgentDetail}
        editingAgent={appState.editingAgent}
        setEditingAgent={appState.setEditingAgent}
        isCreatingNewAgent={appState.isCreatingNewAgent}
        setIsCreatingNewAgent={appState.setIsCreatingNewAgent}

        projectToDelete={appState.projectToDelete}
        setProjectToDelete={appState.setProjectToDelete}
        taskToDelete={appState.taskToDelete}
        setTaskToDelete={appState.setTaskToDelete}

        confirmationModal={appState.confirmationModal}
        setConfirmationModal={appState.setConfirmationModal}

        currentError={currentError}
        setCurrentError={setCurrentError}

        // Processing
        processingLabel={appState.processingLabel}
        processingProgress={appState.processingProgress}
        processingStatusText={appState.processingStatusText}
        processingEstimatedTime={appState.processingEstimatedTime}
        processingTaskCount={appState.processingTaskCount}

        // Chat
        activeChatAgent={appState.activeChatAgent}
        setActiveChatAgent={appState.setActiveChatAgent}
        chatHistory={appState.chatHistory}
        isChatThinking={appState.isChatThinking}

        // Handlers
        handleLogin={handleLogin}
        handleUserLogout={handleUserLogout}
        toggleModernView={toggleModernView}
        handleUpdateTask={handleUpdateTask}
        handleAiModifyTask={handleAiModifyTask}
        setHITLPreference={setHITLPreference}
        pendingActionRef={pendingActionRef}
        handleResetProject={handleResetProject}
        userRole={userRole}
        dispatch={dispatch}
        addLog={addLog}
        handleSelectTemplate={handleSelectTemplate}
        handleSaveAsTemplate={handleSaveAsTemplate}
        canCustomizeAgents={canCustomizeAgents}
        isFeatureEnabled={isFeatureEnabled}
        handleSendMessage={handleSendMessage}
        confirmDeleteTask={confirmDeleteTask}
        deleteProject={handleDeleteProject}

        // Theme Studio
        themeInput={appState.themeInput}
        setThemeInput={appState.setThemeInput}
        handleAiThemeGen={handleAiThemeGen}
        handleRandomTheme={handleRandomTheme}
        isGeneratingTheme={appState.isGeneratingTheme}
        availableThemes={appState.availableThemes}
        selectedTheme={appState.selectedTheme}
        setSelectedTheme={appState.setSelectedTheme}

        apiHealth={appState.apiHealth}
      >
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
            <AppRouter
              isModernView={isModernView}
              viewMode={viewMode}
              // Landing view props
              onLaunch={handleLaunchApp}
              onLaunchDemo={handleLaunchDemo}
              onSignup={handleSignup}
              // Core state
              state={state}
              dispatch={dispatch}
              // User & Auth
              user={user}
              isViewOnly={isViewOnly}
              dismissedGuestBanner={appState.dismissedGuestBanner}
              setDismissedGuestBanner={appState.setDismissedGuestBanner}
              isRestoring={appState.isRestoring as any} // Cast if type mismatch from isRestoring definition? (boolean vs helper?) It's boolean now.
              showWorkspaceTutorial={appState.showWorkspaceTutorial}
              // Hub view props
              projectList={projectList}
              sampleProjects={sampleProjects}
              loadingSamples={loadingSamples}
              projectToDelete={appState.projectToDelete} // AppRouter uses this? No, AppShell uses DeleteModal. But HubView might use it to show modal? HubView calls setProjectToDelete.
              // HubView props: projectToDelete={projectToDelete} (to disable buttons or show?)
              // Let's pass it anyway if it expects it.
              canViewSamples={canViewSamples}
              canCreateProjects={canCreateProjects}
              canDeleteProjects={canDeleteProjects}
              canViewAllProjects={canViewAllProjects}
              canUseTemplates={canUseTemplates}
              canImportProjects={canImportProjects}
              handleAdminClick={handleAdminClick}
              handleProfileClick={handleProfileClick}
              handleUserLogout={handleUserLogout}
              handleToggleSampleProject={handleToggleSampleProject}
              handleCreateNewProject={handleCreateNewProject}
              handleLoadProject={handleLoadProject}
              handleLoadDemoProject={handleLoadDemoProject}
              handleDeleteProject={handleDeleteProject}
              setShowUserSignup={setShowUserSignup}
              setShowUserLogin={setShowUserLogin}
              setShowTemplateSelector={appState.setShowTemplateSelector}
              setShowProjectImport={appState.setShowProjectImport}
              isFeatureEnabled={isFeatureEnabled}
              isButtonDisabled={isButtonDisabled}
              shouldShowFeature={shouldShowFeature}
              // Setup view props
              setupMessages={setupMessages}
              setSetupMessages={setSetupMessages}
              setupInput={setupInput}
              setSetupInput={setSetupInput}
              setupFiles={setupFiles}
              setSetupFiles={setSetupFiles}
              setupProjectName={setupProjectName}
              setSetupProjectName={setSetupProjectName}
              hasManuallyEditedProjectName={hasManuallyEditedProjectName}
              setHasManuallyEditedProjectName={setHasManuallyEditedProjectName}
              setupStage={setupStage}
              setSetupStage={setSetupStage}
              projectPreview={projectPreview} // Need to pass projectPreview from pm.state? No, it's local in App or from pm?
              // Wait, setup state is in App.tsx locally (lines 2800+)?
              // I haven't extracted SetupHandlers or SetupState yet?
              // SetupState is in useAppState!
              setProjectPreview={pm.setProjectPreview} // Wait, useProjectManagement has setProjectPreview? Or useAppState?
              // useAppState has projectPreview and setProjectPreview
              previewTab={appState.previewTab}
              setPreviewTab={appState.setPreviewTab}
              tempSelectedStandards={appState.tempSelectedStandards}
              setTempSelectedStandards={appState.setTempSelectedStandards}
              showStandards={appState.showStandards}
              setShowStandards={appState.setShowStandards}
              isDraggingSetup={appState.isDraggingSetup}
              setIsDraggingSetup={appState.setIsDraggingSetup}
              isResearching={appState.isResearching}
              setIsResearching={appState.setIsResearching}
              isEnhancingInput={appState.isEnhancingInput}
              setIsEnhancingInput={appState.setIsEnhancingInput}
              isGeneratingSuggestions={appState.isGeneratingSuggestions} // Boolean? or array? useAppState had array?
              // useAppState: isGeneratingSuggestions is array?
              // const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<any[]>([]); // I pasted this in Step 1140
              // Wait, isGeneratingSuggestions usually boolean. displayedSuggestions is array.
              // Let's check my paste in Step 1140.
              // "const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<any[]>([]);"
              // This looks like a mistake in my paste?
              // Line 171 of App.tsx (original): "const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);" (implied)
              // I should check useAppState.ts again.
              setIsGeneratingSuggestions={appState.setIsGeneratingSuggestions as any}
              displayedSuggestions={appState.displayedSuggestions}
              setDisplayedSuggestions={appState.setDisplayedSuggestions}
              selectedTheme={appState.selectedTheme}
              setSelectedTheme={appState.setSelectedTheme}
              availableThemes={appState.availableThemes}
              setAvailableThemes={appState.setAvailableThemes}
              themeInput={appState.themeInput}
              setThemeInput={appState.setThemeInput}
              isGeneratingTheme={appState.isGeneratingTheme}
              setIsGeneratingTheme={appState.setIsGeneratingTheme}
              setupInputRef={setupInputRef}
              setupEndRef={setupEndRef}
              // Workspace view props
              isRenaming={appState.isRenaming}
              tempName={appState.tempName}
              activeTab={appState.activeTab}
              leftTab={appState.leftTab}
              leftWidth={appState.leftWidth}
              logHeight={appState.logHeight}
              isResizingLeft={appState.isResizingLeft}
              isResizingLogs={appState.isResizingLogs}
              isLogsCollapsed={appState.isLogsCollapsed}
              globalMessages={appState.globalMessages}
              globalChatInput={appState.globalChatInput}
              isChatThinking={appState.isChatThinking}
              isProcessingFile={appState.isProcessingFile}
              isEnhancingChat={appState.isEnhancingChat}
              isResearchingChat={appState.isResearchingChat}
              autoPilotStatus={appState.autoPilotStatus}
              apiHealth={appState.apiHealth}
              appSettings={appState.appSettings}
              showExportDataMenu={appState.showExportDataMenu}
              showShareProject={appState.showShareProject}
              showReportExport={appState.showReportExport}
              showTerminal={appState.showTerminal}
              showSettings={appState.showSettings}
              showThemeStudio={appState.showThemeStudio}
              showUserSignup={showUserSignup} // uiHandlers overrides? No, State.
              showUserLogin={showUserLogin}
              handleUserLoginSuccess={handleUserLoginSuccess}
              handleUserSignupSuccess={handleUserSignupSuccess}
              showMobileDeploymentWizard={appState.showMobileDeploymentWizard}
              editingTask={appState.editingTask}
              selectedAgentDetail={appState.selectedAgentDetail}
              globalChatEndRef={globalChatEndRef}
              globalFileInputRef={globalFileInputRef}
              globalChatInputRef={globalChatInputRef}
              isProgrammaticHashChangeRef={isProgrammaticHashChangeRef}
              // State setters
              setIsRenaming={appState.setIsRenaming}
              setTempName={appState.setTempName}
              setActiveTab={appState.setActiveTab}
              setLeftTab={appState.setLeftTab}
              setIsResizingLeft={appState.setIsResizingLeft}
              setIsResizingLogs={appState.setIsResizingLogs}
              setIsLogsCollapsed={appState.setIsLogsCollapsed}
              setGlobalMessages={appState.setGlobalMessages}
              setGlobalChatInput={appState.setGlobalChatInput}
              setIsChatThinking={appState.setIsChatThinking}
              setIsProcessingFile={appState.setIsProcessingFile}
              setIsEnhancingChat={appState.setIsEnhancingChat}
              setIsResearchingChat={appState.setIsResearchingChat}
              setShowExportDataMenu={appState.setShowExportDataMenu}
              setShowShareProject={appState.setShowShareProject}
              setShowReportExport={appState.setShowReportExport}
              setShowTerminal={appState.setShowTerminal}
              setShowSettings={appState.setShowSettings}
              setShowThemeStudio={appState.setShowThemeStudio}
              setShowWorkspaceTutorial={appState.setShowWorkspaceTutorial}
              setShowMobileDeploymentWizard={appState.setShowMobileDeploymentWizard}
              setEditingTask={appState.setEditingTask}
              setSelectedAgentDetail={appState.setSelectedAgentDetail}
              setViewMode={setViewMode}
              // Handlers
              handleUndo={handleUndo}
              handleRedo={handleRedo}
              handleRenameProject={handleRenameProject}
              handleAutoPilotClick={handleAutoPilotClick}
              stopExecution={stopExecution}
              handleOpenChat={handleOpenChat}
              handleGlobalChatSend={handleGlobalChatSend}
              handleGlobalFileSelect={handleGlobalFileSelect}
              handleDeepResearch={handleDeepResearch}
              handleEnhanceInput={handleEnhanceInput}
              handleExportProjectData={handleExportProjectData}
              regressPhase={regressPhase}
              advancePhase={advancePhase}
              startNextSprint={startNextSprint}
              orchestratePhase={orchestratePhase}
              executeTask={executeTask}
              handleRunAllTasks={handleRunAllTasks}
              handleDeleteTask={handleDeleteTask}
              handleApproveTask={handleApproveTask}
              handleRejectTask={handleRejectTask}
              handleSaveArtifact={handleSaveArtifact}
              handleArtifactUpload={handleArtifactUpload}
              handleForceBuild={handleForceBuild}
              handleAddStandard={handleAddStandard}
              handleRemoveStandard={handleRemoveStandard}
              handleRunAudit={handleRunAudit}
              handleToggleLogsCollapse={handleToggleLogsCollapse}
              addLog={addLog}
              handleSetupSend={handleSetupSend}
              handleManualLaunch={handleManualLaunch}
              handleLaunchFromBrainstorming={handleLaunchFromBrainstorming}
              handleSuggestionClick={handleSuggestionClick}
              toggleStandard={toggleStandard}
              handleRandomTheme={handleRandomTheme}
              handleAiThemeGen={handleAiThemeGen}
              removeSetupFile={removeSetupFile}
              handleSetupDragOver={handleSetupDragOver}
              handleSetupDragLeave={handleSetupDragLeave}
              handleSetupDrop={handleSetupDrop}
              canProceedToPreview={canProceedToPreview}
              handleJumpToPreview={handleJumpToPreview}
              // Feature flags
              canSwitchEnvironment={canSwitchEnvironment}
              canShareProjects={canShareProjects}
              canExportReports={canExportReports}
              canExportData={canExportData}
              canAccessTerminal={canAccessTerminal}
              canUseAICodeGeneration={canUseAICodeGeneration}
              canUseAITaskAutomation={canUseAITaskAutomation}
              canUseAIChat={canUseAIChat}
              canUseCodeEditor={canUseCodeEditor}
              canUseArtifactViewer={canUseArtifactViewer}
              canDeleteAgents={canDeleteAgents}
              canCustomizeAgents={canCustomizeAgents}
              // Demo mode
              isDemoMode={isDemoMode}
              // Admin props
              adminToken={adminToken}
              adminUser={adminUser}
              isAdminUser={isAdminUser}
              handleAdminLoginSuccess={handleAdminLoginSuccess}
              handleAdminLogout={handleAdminLogout}
            />
          </Suspense>
        </ErrorBoundary>
      </AppShell>
    </div>
  );
};

/**
 * App - Wrapper component that provides FeatureAccessProvider
 * This ensures useFeatureFlag hooks in AppContent have access to the context
 */
const App: React.FC = () => {
  const { user } = useAuth();

  // Compute userRole for FeatureAccessProvider
  const userRole = useMemo(() => {
    return user?.role ? user.role.toLowerCase().trim() : 'public';
  }, [user?.role]);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <FeatureAccessProvider userRole={userRole}>
        <AppContent />
      </FeatureAccessProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
