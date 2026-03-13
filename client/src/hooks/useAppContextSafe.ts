/**
 * useAppContextSafe - Safe hook to access AppStateContext
 * 
 * This hook provides access to the centralized app state while
 * gracefully handling cases where it's called outside the provider.
 * 
 * Use this hook in child components that want to access centralized state
 * without prop drilling, while maintaining backward compatibility.
 * 
 * @module hooks/useAppContextSafe
 */

import { useContext } from 'react';
import { AppStateContext, AppContextValue } from '../contexts/AppStateContext';

/**
 * Safe hook to access app context
 * Returns null if called outside AppStateProvider
 */
export function useAppContextSafe(): AppContextValue | null {
    return useContext(AppStateContext);
}

/**
 * Check if we're inside AppStateProvider
 */
export function useIsInsideAppProvider(): boolean {
    const ctx = useContext(AppStateContext);
    return ctx !== null;
}

/**
 * Get specific pieces of context with defaults
 * Useful for gradual migration
 */
export function useAppUser() {
    const ctx = useContext(AppStateContext);
    return ctx?.user ?? null;
}

export function useAppUserRole(): string {
    const ctx = useContext(AppStateContext);
    return ctx?.userRole ?? 'public';
}

export function useAppFeatureFlags() {
    const ctx = useContext(AppStateContext);
    return ctx?.featureFlags ?? null;
}

export function useAppViewMode() {
    const ctx = useContext(AppStateContext);
    return {
        viewMode: ctx?.appState?.viewMode ?? 'landing',
        setViewMode: ctx?.appState?.setViewMode ?? (() => { }),
    };
}

export function useAppOfflineStatus(): boolean {
    const ctx = useContext(AppStateContext);
    return ctx?.isOffline ?? false;
}

export function useAppLogging() {
    const ctx = useContext(AppStateContext);
    return ctx?.addLog ?? (() => { });
}

/**
 * Feature access helpers - safe versions
 */
export function useIsFeatureEnabled() {
    const ctx = useContext(AppStateContext);
    return ctx?.isFeatureEnabled ?? (() => false);
}

export function useShouldShowFeature() {
    const ctx = useContext(AppStateContext);
    return ctx?.shouldShowFeature ?? (() => false);
}

export function useIsButtonDisabled() {
    const ctx = useContext(AppStateContext);
    return ctx?.isButtonDisabled ?? (() => true);
}
