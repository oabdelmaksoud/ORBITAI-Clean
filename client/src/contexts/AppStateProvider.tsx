/**
 * AppStateProvider - Centralized state provider for OrbitAI
 * 
 * This provider consolidates all state initialization previously in App.tsx,
 * including:
 * - Project state (useProjectState)
 * - App UI state (useAppState)
 * - History management (useHistory)
 * - Authentication (useAuth)
 * - Feature access hooks
 * - User settings
 * - WebSocket setup
 * - Helper functions
 * 
 * @module contexts/AppStateProvider
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
    ProjectState,
    UserProfile,
    AgentRole,
    LogEntry
} from '@orbitai/shared';
import { AGENTS } from '@orbitai/shared';

// Hooks
import { useProjectState } from '../hooks/useProjectState';
import { useAppState } from '../hooks/useAppState';
import { useHistory } from '../hooks/useHistory';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../hooks/useUserSettings';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

// Services
import { projectsApi } from '../services/api';
import { cleanupInvalidProjectIds, cleanupProjectIdFromAllSources, isValidObjectId } from '../services/projectStorage';

// Context
import { AppStateContext, AppContextValue } from './AppStateContext';

interface AppStateProviderProps {
    children: React.ReactNode;
}

/**
 * AppStateProvider Component
 * 
 * Wraps the entire application and provides centralized state management
 */
export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
    // ============================================
    // PROJECT STATE
    // ============================================
    const { state, dispatch, actions } = useProjectState();
    const stateRef = useRef<ProjectState>(state);
    // Update ref in render phase (no useEffect needed)
    stateRef.current = state;

    // ============================================
    // APP UI STATE
    // ============================================
    const appState = useAppState();
    const { setGlobalMessages, setAutoPilotStatus, autoPilotStatusRef } = appState;

    // ============================================
    // HISTORY MANAGEMENT
    // ============================================
    const history = useHistory(state);
    const historyRef = useRef(history);
    useEffect(() => { historyRef.current = history; }, [history]);

    // ============================================
    // AUTHENTICATION
    // ============================================
    const { user, loading: authLoading, updateUser, logout: authLogout } = useAuth();

    // ============================================
    // USER SETTINGS
    // ============================================
    const {
        settings: userSettings,
        updateSettings,
        updatePreference,
        loading: settingsLoading
    } = useUserSettings(user?.token || null);

    // ============================================
    // REFS
    // ============================================
    const confirmationResolverRef = useRef<((value: boolean) => void) | null>(null);
    const isProgrammaticHashChangeRef = useRef<boolean>(false);
    const pendingActionRef = useRef<(() => void) | null>(null);
    const userEmailRef = useRef<string | undefined>(user?.email);
    const hasRefreshedRoleRef = useRef(false);
    const previousUserRoleRef = useRef<string>('public');
    const hasClearedCacheRef = useRef<boolean>(false);

    // Update user email ref
    useEffect(() => {
        userEmailRef.current = user?.email;
    }, [user?.email]);

    // ============================================
    // USER ROLE & FEATURE FLAGS
    // ============================================
    const userRole = useMemo(() => {
        return user?.role ? user.role.toLowerCase().trim() : 'public';
    }, [user?.role]);

    // Feature access checks
    const canViewSamples = useFeatureAccess('viewing_sample_projects', userRole);
    const canCreateProjects = useFeatureAccess('project_creation', userRole);
    const canDeleteProjects = useFeatureAccess('project_deletion', userRole);
    const canSwitchEnvironment = useFeatureAccess('environment_switching', userRole);
    const canExportProjects = useFeatureAccess('project_export', userRole);
    const canShareProjects = useFeatureAccess('project_sharing', userRole);
    const canImportProjects = useFeatureAccess('project_import', userRole);
    const canExportReports = useFeatureAccess('export_reports', userRole);
    const canExportData = useFeatureAccess('export_data', userRole);
    const canAccessTerminal = useFeatureAccess('terminal_access', userRole);
    const canUseTemplates = useFeatureAccess('template_use', userRole);
    const canViewAllProjects = useFeatureAccess('view_all_projects', userRole);
    const canUseCodeEditor = useFeatureAccess('code_editor', userRole);
    const canUseArtifactViewer = useFeatureAccess('artifact_viewer', userRole);
    const canUsePreviewMode = useFeatureAccess('preview_mode', userRole);
    const canUseAIChat = useFeatureAccess('ai_chat', userRole);
    const canUseAICodeGeneration = useFeatureAccess('ai_code_generation', userRole);
    const canUseAITaskAutomation = useFeatureAccess('ai_task_automation', userRole);
    const canUseAISuggestions = useFeatureAccess('ai_suggestions', userRole);
    const canCustomizeAgents = useFeatureAccess('agent_customization', userRole);
    const canDeleteAgents = useFeatureAccess('agent_deletion', userRole);
    const canAutomateAgents = useFeatureAccess('agent_automation', userRole);

    const featureFlags = useMemo(() => ({
        canViewSamples,
        canCreateProjects,
        canDeleteProjects,
        canSwitchEnvironment,
        canExportProjects,
        canShareProjects,
        canImportProjects,
        canExportReports,
        canExportData,
        canAccessTerminal,
        canUseTemplates,
        canViewAllProjects,
        canUseCodeEditor,
        canUseArtifactViewer,
        canUsePreviewMode,
        canUseAIChat,
        canUseAICodeGeneration,
        canUseAITaskAutomation,
        canUseAISuggestions,
        canCustomizeAgents,
        canDeleteAgents,
        canAutomateAgents
    }), [
        canViewSamples, canCreateProjects, canDeleteProjects, canSwitchEnvironment,
        canExportProjects, canShareProjects, canImportProjects, canExportReports,
        canExportData, canAccessTerminal, canUseTemplates, canViewAllProjects,
        canUseCodeEditor, canUseArtifactViewer, canUsePreviewMode, canUseAIChat,
        canUseAICodeGeneration, canUseAITaskAutomation, canUseAISuggestions,
        canCustomizeAgents, canDeleteAgents, canAutomateAgents
    ]);

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    // Check if user is admin
    const isAdminUser = useCallback((user: UserProfile | null): boolean => {
        if (!user) return false;
        let role = user.role?.toLowerCase()?.trim();

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

        return role === 'admin' || role === 'superadmin';
    }, []);

    // Feature enabled check
    const isFeatureEnabled = useCallback((feature: { enabled: boolean; loading: boolean } | undefined) => {
        if (!feature) return false;
        if (feature.loading) return false;
        return feature.enabled;
    }, []);

    // Should show feature (optimistic)
    const shouldShowFeature = useCallback((feature: { enabled: boolean; loading: boolean } | undefined) => {
        if (!feature) return false;
        if (feature.loading) return true; // Optimistic
        return feature.enabled;
    }, []);

    // Button disabled check
    const isButtonDisabled = useCallback((feature: { enabled: boolean; loading: boolean } | undefined) => {
        if (!feature) return true;
        if (feature.loading) return false; // Optimistic
        return !feature.enabled;
    }, []);

    // ============================================
    // OFFLINE DETECTION
    // ============================================
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

    // ============================================
    // DEMO MODE
    // ============================================
    const isDemoMode = useMemo(() => {
        return !user && appState.viewMode === 'workspace';
    }, [user, appState.viewMode]);

    // ============================================
    // LOGGING
    // ============================================
    const safeDispatch = dispatch || (() => { });
    const safeSetGlobalMessages = setGlobalMessages || (() => { });

    const addLog = useCallback((
        message: string,
        agentRole: string | AgentRole = AgentRole.ORCHESTRATOR,
        type: LogEntry['type'] = 'info',
        taskId?: string
    ) => {
        if (!dispatch) return;

        dispatch({
            type: 'ADD_LOG',
            payload: {
                id: Math.random().toString(36).substring(7),
                timestamp: Date.now(),
                agent: agentRole,
                message,
                type
            }
        });

        if (taskId) {
            const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            dispatch({ type: 'ADD_TASK_LOG', payload: { id: taskId, message: `[${timestamp}] ${message}` } });
        }

        if (type === 'action' || type === 'error' || type === 'success' || (agentRole === AgentRole.ORCHESTRATOR && type === 'info')) {
            const agentObj = (stateRef.current?.agents || []).find(a => a.role === agentRole) || AGENTS.find(a => a.role === agentRole);
            if (agentObj && setGlobalMessages) {
                setGlobalMessages(prev => [...prev, {
                    id: Math.random().toString(36),
                    sender: 'agent',
                    text: message,
                    timestamp: Date.now(),
                    agentId: agentObj.id,
                    isLogEvent: true
                }]);
            }
        }
    }, [safeDispatch, safeSetGlobalMessages]);

    // ============================================
    // CLEANUP EFFECT
    // ============================================
    useEffect(() => {
        const performCleanup = async () => {
            try {
                await cleanupInvalidProjectIds();

                const urlParams = new URLSearchParams(window.location.search);
                const urlProjectId = urlParams.get('project');
                if (urlProjectId && isValidObjectId(urlProjectId)) {
                    try {
                        const dbProject = await projectsApi.getById(urlProjectId);
                        if (!dbProject) {
                            await cleanupProjectIdFromAllSources(urlProjectId);
                        }
                    } catch (error) {
                        // Silently ignore
                    }
                }
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.debug('[AppStateProvider] Cleanup error (non-critical):', error);
                }
            }
        };

        performCleanup();
    }, [user?.id]);

    // ============================================
    // FEATURE CACHE CLEAR EFFECT
    // ============================================
    useEffect(() => {
        const shouldClearCache =
            (user && user.role && userRole !== 'public' && previousUserRoleRef.current !== userRole) ||
            (user && user.role && userRole !== 'public' && !hasClearedCacheRef.current);

        if (shouldClearCache) {
            previousUserRoleRef.current = userRole;
            hasClearedCacheRef.current = true;
            import('../services/featureAccess').then(({ clearFeatureCache }) => {
                clearFeatureCache();
                if (import.meta.env.DEV) {
                    console.log('[AppStateProvider] Cleared feature cache - user role:', userRole);
                }
            });
        }

        if (!user || !user.role) {
            hasClearedCacheRef.current = false;
        }
    }, [userRole, user?.role, user?.id]);

    // ============================================
    // WEBSOCKET SETUP EFFECT
    // ============================================
    useEffect(() => {
        let socket: any = null;

        const setupWebSocket = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const { io } = await import('socket.io-client');
                const { getApiBaseUrl } = await import('../utils/apiUrlNormalizer');
                let API_BASE_URL = getApiBaseUrl();

                API_BASE_URL = API_BASE_URL.trim().replace(/\/$/, '');
                if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
                    API_BASE_URL = 'http://' + API_BASE_URL;
                }

                socket = io(API_BASE_URL, {
                    transports: ['polling', 'websocket'],
                    reconnection: false,
                    reconnectionDelay: 5000,
                    reconnectionDelayMax: 10000,
                    reconnectionAttempts: 1,
                    timeout: 5000,
                    forceNew: false,
                    upgrade: false,
                    autoConnect: false
                });

                socket.connect();

                socket.on('connect', () => {
                    if (import.meta.env.DEV) {
                        console.log('[WebSocket] Connected for feature flag updates');
                    }
                });

                socket.on('connect_error', (error: any) => {
                    if (error.message) {
                        error.preventDefault = () => { };
                    }
                });

                socket.on('broadcast', (message: { type: string; featureKey?: string; message?: string }) => {
                    if (import.meta.env.DEV) {
                        console.log('[WebSocket] Received broadcast:', message);
                    }
                    if (message.type === 'feature_flag_updated') {
                        import('../services/featureAccess').then(({ clearFeatureCache, clearFeatureCacheForKey }) => {
                            if (message.featureKey) {
                                clearFeatureCacheForKey(message.featureKey);
                            } else {
                                clearFeatureCache();
                            }
                            const lastRefresh = sessionStorage.getItem('last_feature_refresh') || '0';
                            const now = Date.now();
                            if ((now - parseInt(lastRefresh)) > 500) {
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
    }, []);

    // ============================================
    // FEATURE FLAG INITIALIZATION
    // ============================================
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
            } catch (error) {
                console.warn('[Feature Flags] Failed to initialize adapter:', error);
            }
        };
        initFeatureFlags();
    }, []);

    // ============================================
    // CONTEXT VALUE
    // ============================================
    const contextValue: AppContextValue = useMemo(() => ({
        // Project State
        state,
        dispatch,
        actions,
        stateRef,

        // App State
        appState,

        // History
        history,
        historyRef,

        // Auth
        user,
        authLoading,
        updateUser,
        logout: authLogout,

        // User Settings
        userSettings,
        updateSettings,
        updatePreference,
        settingsLoading,

        // Feature Access
        userRole,
        featureFlags,

        // Refs
        confirmationResolverRef,
        isProgrammaticHashChangeRef,
        pendingActionRef,

        // Helpers
        isAdminUser,
        isFeatureEnabled,
        shouldShowFeature,
        isButtonDisabled,

        // Connection
        isOffline,
        isDemoMode,

        // Toasts
        toasts: appState.toasts,
        setToasts: appState.setToasts,

        // API Health
        apiHealth: appState.apiHealth,

        // Logging
        addLog
    }), [
        state, dispatch, actions,
        appState,
        history,
        user, authLoading, updateUser, authLogout,
        userSettings, updateSettings, updatePreference, settingsLoading,
        userRole, featureFlags,
        isAdminUser, isFeatureEnabled, shouldShowFeature, isButtonDisabled,
        isOffline, isDemoMode,
        addLog
    ]);

    return (
        <AppStateContext.Provider value={contextValue}>
            {children}
        </AppStateContext.Provider>
    );
};

export default AppStateProvider;
