/**
 * Zustand Store Scaffolding
 * Preparation for migrating from useReducer to Zustand
 * 
 * Benefits of migration:
 * - No context provider nesting needed
 * - Built-in devtools support
 * - Simpler API (no dispatch)
 * - Better TypeScript inference
 * - Automatic memoization
 * - Persist middleware built-in
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ============================================
// UI Store - Global UI state
// ============================================

interface UIState {
    // Sidebar state
    sidebarOpen: boolean;
    sidebarWidth: number;

    // Modal state
    activeModal: string | null;
    modalProps: Record<string, unknown>;

    // Theme
    theme: 'light' | 'dark' | 'system';

    // Loading states
    globalLoading: boolean;
    loadingMessage: string | null;

    // Actions
    toggleSidebar: () => void;
    setSidebarWidth: (width: number) => void;
    openModal: (name: string, props?: Record<string, unknown>) => void;
    closeModal: () => void;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setLoading: (loading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>()(
    devtools(
        persist(
            (set) => ({
                // Initial state
                sidebarOpen: true,
                sidebarWidth: 280,
                activeModal: null,
                modalProps: {},
                theme: 'system',
                globalLoading: false,
                loadingMessage: null,

                // Actions
                toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
                setSidebarWidth: (width) => set({ sidebarWidth: width }),
                openModal: (name, props = {}) => set({ activeModal: name, modalProps: props }),
                closeModal: () => set({ activeModal: null, modalProps: {} }),
                setTheme: (theme) => set({ theme }),
                setLoading: (loading, message) => set({
                    globalLoading: loading,
                    loadingMessage: message ?? null
                }),
            }),
            {
                name: 'orbitai-ui',
                partialize: (state) => ({
                    sidebarOpen: state.sidebarOpen,
                    sidebarWidth: state.sidebarWidth,
                    theme: state.theme,
                }),
            }
        ),
        { name: 'UIStore' }
    )
);

// ============================================
// Settings Store - User preferences
// ============================================

interface SettingsState {
    // AI Settings
    preferredModel: string | null;
    temperature: number;
    maxTokens: number;
    useInternet: boolean;

    // Editor Settings
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;

    // Notification Settings
    emailNotifications: boolean;
    soundEnabled: boolean;

    // Actions
    updateAISettings: (settings: Partial<Pick<SettingsState, 'preferredModel' | 'temperature' | 'maxTokens' | 'useInternet'>>) => void;
    updateEditorSettings: (settings: Partial<Pick<SettingsState, 'fontSize' | 'tabSize' | 'wordWrap'>>) => void;
    resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
    preferredModel: null,
    temperature: 0.7,
    maxTokens: 4096,
    useInternet: false,
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    emailNotifications: true,
    soundEnabled: true,
};

export const useSettingsStore = create<SettingsState>()(
    devtools(
        persist(
            (set) => ({
                ...DEFAULT_SETTINGS,

                updateAISettings: (settings) => set((state) => ({ ...state, ...settings })),
                updateEditorSettings: (settings) => set((state) => ({ ...state, ...settings })),
                resetToDefaults: () => set(DEFAULT_SETTINGS),
            }),
            {
                name: 'orbitai-settings',
            }
        ),
        { name: 'SettingsStore' }
    )
);

// ============================================
// Toast/Notification Store
// ============================================

interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

interface ToastState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

export const useToastStore = create<ToastState>()(
    devtools(
        (set, get) => ({
            toasts: [],

            addToast: (toast) => {
                const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                set((state) => ({
                    toasts: [...state.toasts, { ...toast, id }]
                }));

                // Auto-remove after duration
                if (toast.duration !== 0) {
                    setTimeout(() => {
                        get().removeToast(id);
                    }, toast.duration || 5000);
                }

                return id;
            },

            removeToast: (id) => set((state) => ({
                toasts: state.toasts.filter(t => t.id !== id)
            })),

            clearAll: () => set({ toasts: [] }),
        }),
        { name: 'ToastStore' }
    )
);

// ============================================
// Export convenience hooks
// ============================================

// Selector hooks for common patterns
export const useSidebarOpen = () => useUIStore((s) => s.sidebarOpen);
export const useTheme = () => useUIStore((s) => s.theme);
export const useGlobalLoading = () => useUIStore((s) => ({
    loading: s.globalLoading,
    message: s.loadingMessage
}));
