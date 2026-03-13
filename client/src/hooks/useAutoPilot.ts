/**
 * useAutoPilot Hook
 * 
 * Manages HAND-OFF AI execution state and controls.
 * Extracted from App.tsx for better maintainability.
 * 
 * Note: This is a simplified extraction that handles state management.
 * The actual execution logic (runAutoPilot, executeTask, etc.) remains
 * in App.tsx due to its complex dependencies on other state.
 */

import { useState, useRef, useCallback } from 'react';

export type AutoPilotStatus = 'idle' | 'running' | 'paused';

interface UseAutoPilotOptions {
    onStart?: () => void;
    onStop?: () => void;
    onPause?: () => void;
}

export function useAutoPilot(options: UseAutoPilotOptions = {}) {
    const { onStart, onStop, onPause } = options;

    const [status, setStatus] = useState<AutoPilotStatus>('idle');

    // Refs for immediate state access in async loops
    const statusRef = useRef<AutoPilotStatus>('idle');
    const isStoppingRef = useRef(false);
    const isBatchingRef = useRef(false);
    const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const activeTaskControllersRef = useRef<Map<string, AbortController>>(new Map());
    const pendingActionRef = useRef<(() => void) | null>(null);

    /**
     * Update status (keeps ref and state in sync)
     */
    const updateStatus = useCallback((newStatus: AutoPilotStatus) => {
        statusRef.current = newStatus;
        setStatus(newStatus);
    }, []);

    /**
     * Start HAND-OFF AI
     */
    const start = useCallback(() => {
        if (statusRef.current === 'running') {
            console.warn('HAND-OFF AI already running - ignoring duplicate start request');
            return false;
        }

        isStoppingRef.current = false;
        updateStatus('running');
        onStart?.();
        return true;
    }, [updateStatus, onStart]);

    /**
     * Stop HAND-OFF AI
     */
    const stop = useCallback(() => {
        isStoppingRef.current = true;
        isBatchingRef.current = false;
        updateStatus('idle');

        // Clear batch interval
        if (batchIntervalRef.current) {
            clearInterval(batchIntervalRef.current);
            batchIntervalRef.current = null;
        }

        // Abort all active task controllers
        activeTaskControllersRef.current.forEach(controller => controller.abort());
        activeTaskControllersRef.current.clear();

        onStop?.();
    }, [updateStatus, onStop]);

    /**
     * Pause HAND-OFF AI
     */
    const pause = useCallback(() => {
        if (statusRef.current !== 'running') return;

        activeTaskControllersRef.current.forEach(controller => controller.abort());
        activeTaskControllersRef.current.clear();
        updateStatus('paused');
        onPause?.();
    }, [updateStatus, onPause]);

    /**
     * Resume HAND-OFF AI from paused state
     */
    const resume = useCallback(() => {
        if (statusRef.current !== 'paused') return;
        updateStatus('running');
        onStart?.();
    }, [updateStatus, onStart]);

    /**
     * Create an abort controller for a task
     */
    const createTaskController = useCallback((taskId: string): AbortController => {
        const controller = new AbortController();
        activeTaskControllersRef.current.set(taskId, controller);
        return controller;
    }, []);

    /**
     * Remove a task controller
     */
    const removeTaskController = useCallback((taskId: string) => {
        activeTaskControllersRef.current.delete(taskId);
    }, []);

    /**
     * Check if we should continue execution
     */
    const shouldContinue = useCallback((): boolean => {
        return statusRef.current === 'running' && !isStoppingRef.current;
    }, []);

    /**
     * Set batch interval
     */
    const setBatchInterval = useCallback((interval: NodeJS.Timeout | null) => {
        if (batchIntervalRef.current) {
            clearInterval(batchIntervalRef.current);
        }
        batchIntervalRef.current = interval;
    }, []);

    /**
     * Set pending action for after HITL prompt
     */
    const setPendingAction = useCallback((action: (() => void) | null) => {
        pendingActionRef.current = action;
    }, []);

    /**
     * Execute pending action
     */
    const executePendingAction = useCallback(() => {
        if (pendingActionRef.current) {
            pendingActionRef.current();
            pendingActionRef.current = null;
        }
    }, []);

    /**
     * Clear pending action
     */
    const clearPendingAction = useCallback(() => {
        pendingActionRef.current = null;
    }, []);

    return {
        // State
        status,

        // Refs (for direct access in execution loops)
        statusRef,
        isStoppingRef,
        isBatchingRef,
        batchIntervalRef,
        activeTaskControllersRef,
        pendingActionRef,

        // Computed
        isRunning: status === 'running',
        isPaused: status === 'paused',
        isIdle: status === 'idle',

        // Methods
        updateStatus,
        start,
        stop,
        pause,
        resume,
        createTaskController,
        removeTaskController,
        shouldContinue,
        setBatchInterval,
        setPendingAction,
        executePendingAction,
        clearPendingAction,
    };
}

export default useAutoPilot;
