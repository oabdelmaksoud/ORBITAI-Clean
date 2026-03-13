/**
 * AppStateContext - Centralized state management for OrbitAI
 * 
 * This context consolidates all state previously scattered in App.tsx,
 * providing a single source of truth for:
 * - Project state (useProjectState)
 * - App UI state (useAppState)
 * - History management (useHistory)
 * - Authentication (useAuth)
 * - Feature access (useFeatureAccess)
 * - User settings (useUserSettings)
 * 
 * @module contexts/AppStateContext
 */

import React, { createContext, useContext } from 'react';
import {
    ProjectState,
    UserProfile,
    AppSettings,
    Task,
    Agent,
    ChatMessage,
    LogEntry,
    AgentRole
} from '@orbitai/shared';
import { Toast } from '../services/toastService';
import { APIHealth } from '../services/geminiService';

// Re-export ViewMode type for convenience
export type { ViewMode } from '../hooks/useAppState';

/**
 * Full context value shape
 * Contains all state, setters, refs, and helper functions needed by the app
 */
export interface AppContextValue {
    // === PROJECT STATE ===
    state: ProjectState;
    dispatch: React.Dispatch<any>;
    actions: {
        updateProject: (updates: Partial<ProjectState>) => void;
        addTask: (task: Task) => void;
        updateTask: (id: string, updates: Partial<Task>) => void;
        deleteTask: (id: string) => void;
        addAgent: (agent: Agent) => void;
        updateAgent: (id: string, updates: Partial<Agent>) => void;
        deleteAgent: (id: string) => void;
        addLog: (log: LogEntry) => void;
        setPhase: (phase: string) => void;
        reset: () => void;
    };
    stateRef: React.MutableRefObject<ProjectState>;

    // === APP UI STATE ===
    appState: {
        viewMode: string;
        setViewMode: (mode: string) => void;
        isModernView: boolean;
        toggleModernView: () => void;
        activeTab: string;
        setActiveTab: (tab: string) => void;
        isRestoring: boolean;
        setIsRestoring: (val: boolean) => void;
        isViewOnly: boolean;
        setIsViewOnly: (val: boolean) => void;
        // ... all other appState properties
        [key: string]: any;
    };

    // === HISTORY MANAGEMENT ===
    history: {
        state: ProjectState;
        setState: (state: ProjectState) => void;
        undo: () => void;
        redo: () => void;
        canUndo: boolean;
        canRedo: boolean;
        clearHistory: () => void;
        historySize: number;
    };
    historyRef: React.MutableRefObject<any>;

    // === AUTHENTICATION ===
    user: UserProfile | null;
    authLoading: boolean;
    updateUser: (user: UserProfile) => void;
    logout: () => void;

    // === USER SETTINGS ===
    userSettings: any;
    updateSettings: (settings: any) => void;
    updatePreference: (key: string, value: any) => void;
    settingsLoading: boolean;

    // === FEATURE ACCESS ===
    userRole: string;
    featureFlags: {
        canViewSamples: { enabled: boolean; loading: boolean };
        canCreateProjects: { enabled: boolean; loading: boolean };
        canDeleteProjects: { enabled: boolean; loading: boolean };
        canSwitchEnvironment: { enabled: boolean; loading: boolean };
        canExportProjects: { enabled: boolean; loading: boolean };
        canShareProjects: { enabled: boolean; loading: boolean };
        canImportProjects: { enabled: boolean; loading: boolean };
        canExportReports: { enabled: boolean; loading: boolean };
        canExportData: { enabled: boolean; loading: boolean };
        canAccessTerminal: { enabled: boolean; loading: boolean };
        canUseTemplates: { enabled: boolean; loading: boolean };
        canViewAllProjects: { enabled: boolean; loading: boolean };
        canUseCodeEditor: { enabled: boolean; loading: boolean };
        canUseArtifactViewer: { enabled: boolean; loading: boolean };
        canUsePreviewMode: { enabled: boolean; loading: boolean };
        canUseAIChat: { enabled: boolean; loading: boolean };
        canUseAICodeGeneration: { enabled: boolean; loading: boolean };
        canUseAITaskAutomation: { enabled: boolean; loading: boolean };
        canUseAISuggestions: { enabled: boolean; loading: boolean };
        canCustomizeAgents: { enabled: boolean; loading: boolean };
        canDeleteAgents: { enabled: boolean; loading: boolean };
        canAutomateAgents: { enabled: boolean; loading: boolean };
    };

    // === REFS ===
    confirmationResolverRef: React.MutableRefObject<((value: boolean) => void) | null>;
    isProgrammaticHashChangeRef: React.MutableRefObject<boolean>;
    pendingActionRef: React.MutableRefObject<(() => void) | null>;

    // === HELPER FUNCTIONS ===
    isAdminUser: (user: UserProfile | null) => boolean;
    isFeatureEnabled: (feature: { enabled: boolean; loading: boolean } | undefined) => boolean;
    shouldShowFeature: (feature: { enabled: boolean; loading: boolean } | undefined) => boolean;
    isButtonDisabled: (feature: { enabled: boolean; loading: boolean } | undefined) => boolean;

    // === CONNECTION STATE ===
    isOffline: boolean;
    isDemoMode: boolean;

    // === TOAST NOTIFICATIONS ===
    toasts: Toast[];
    setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;

    // === API HEALTH ===
    apiHealth: { status: APIHealth; metrics: any };

    // === LOGGING ===
    addLog: (message: string, agentRole?: string | AgentRole, type?: LogEntry['type'], taskId?: string) => void;
}

/**
 * Create the context with null default (must be used within Provider)
 */
export const AppStateContext = createContext<AppContextValue | null>(null);

/**
 * Custom hook to access the app state context
 * Throws error if used outside of AppStateProvider
 */
export function useAppContext(): AppContextValue {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppStateProvider');
    }
    return context;
}

/**
 * Optional hook that returns null if outside provider (for optional usage)
 */
export function useAppContextOptional(): AppContextValue | null {
    return useContext(AppStateContext);
}
