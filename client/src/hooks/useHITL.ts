/**
 * useHITL Hook (Human-In-The-Loop)
 * 
 * Manages HITL preference state for controlling AI autonomy.
 * Extracted from App.tsx for better maintainability.
 */

import { useState, useCallback } from 'react';
import { AppSettings } from '@orbitai/shared';

interface UseHITLOptions {
    initialSettings?: Partial<AppSettings>;
}

export function useHITL(options: UseHITLOptions = {}) {
    const { initialSettings } = options;

    // App settings state (for HITL preference)
    const [appSettings, setAppSettings] = useState<AppSettings>({
        executionSpeed: 'normal',
        maxRetries: 2,
        autoScrollLogs: true,
        maxTasksPerPhase: 20,
        maxParallelTasks: 5,
        enableHumanInTheLoop: false,
        ...initialSettings,
    });

    // Modal state
    const [showHITLPrompt, setShowHITLPrompt] = useState(false);

    /**
     * Check if HITL preference has been set this session
     */
    const hasHITLPreferenceSet = useCallback((): boolean => {
        return sessionStorage.getItem('hitl_preference_set') === 'true';
    }, []);

    /**
     * Set HITL preference for this session
     */
    const setHITLPreference = useCallback((enableHITL: boolean) => {
        sessionStorage.setItem('hitl_preference_set', 'true');
        sessionStorage.setItem('hitl_enabled', enableHITL.toString());
        setAppSettings(prev => ({ ...prev, enableHumanInTheLoop: enableHITL }));
    }, []);

    /**
     * Get HITL preference from session storage or settings
     */
    const getHITLPreference = useCallback((): boolean => {
        const sessionPref = sessionStorage.getItem('hitl_enabled');
        if (sessionPref !== null) {
            return sessionPref === 'true';
        }
        return appSettings.enableHumanInTheLoop;
    }, [appSettings.enableHumanInTheLoop]);

    /**
     * Clear HITL preference (for new session)
     */
    const clearHITLPreference = useCallback(() => {
        sessionStorage.removeItem('hitl_preference_set');
        sessionStorage.removeItem('hitl_enabled');
    }, []);

    /**
     * Show HITL prompt modal if preference not set
     * Returns true if prompt was shown, false if already set
     */
    const promptIfNeeded = useCallback((): boolean => {
        if (!hasHITLPreferenceSet()) {
            setShowHITLPrompt(true);
            return true;
        }
        return false;
    }, [hasHITLPreferenceSet]);

    /**
     * Handle HITL prompt response
     */
    const handleHITLResponse = useCallback((enableHITL: boolean) => {
        setHITLPreference(enableHITL);
        setShowHITLPrompt(false);
    }, [setHITLPreference]);

    return {
        // State
        appSettings,
        setAppSettings,
        showHITLPrompt,
        setShowHITLPrompt,

        // Computed
        isHITLEnabled: getHITLPreference(),

        // Methods
        hasHITLPreferenceSet,
        setHITLPreference,
        getHITLPreference,
        clearHITLPreference,
        promptIfNeeded,
        handleHITLResponse,
    };
}

export default useHITL;
