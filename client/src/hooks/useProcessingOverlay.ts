/**
 * useProcessingOverlay Hook
 * 
 * Manages processing overlay state for async operations.
 * Extracted from App.tsx for better maintainability.
 */

import { useState, useRef, useCallback } from 'react';

interface ProcessingState {
    label: string | null;
    progress: number;
    statusText?: string;
    estimatedTime?: number;
    taskCount?: number;
}

export function useProcessingOverlay() {
    const [processingLabel, setProcessingLabel] = useState<string | null>(null);
    const [processingProgress, setProcessingProgress] = useState<number>(0);
    const [processingStatusText, setProcessingStatusText] = useState<string | undefined>(undefined);
    const [processingEstimatedTime, setProcessingEstimatedTime] = useState<number | undefined>(undefined);
    const [processingTaskCount, setProcessingTaskCount] = useState<number | undefined>(undefined);

    const processingStartTimeRef = useRef<number | null>(null);

    /**
     * Show processing overlay
     */
    const showProcessing = useCallback((label: string, initialProgress = 0) => {
        processingStartTimeRef.current = Date.now();
        setProcessingLabel(label);
        setProcessingProgress(initialProgress);
        setProcessingStatusText(undefined);
        setProcessingEstimatedTime(undefined);
        setProcessingTaskCount(undefined);
    }, []);

    /**
     * Update processing progress
     */
    const updateProgress = useCallback((progress: number, statusText?: string) => {
        setProcessingProgress(progress);
        if (statusText !== undefined) {
            setProcessingStatusText(statusText);
        }

        // Calculate estimated time based on progress and elapsed time
        if (processingStartTimeRef.current && progress > 0 && progress < 100) {
            const elapsed = (Date.now() - processingStartTimeRef.current) / 1000;
            const estimated = Math.round((elapsed / progress) * (100 - progress));
            setProcessingEstimatedTime(estimated);
        }
    }, []);

    /**
     * Update status text only
     */
    const updateStatus = useCallback((statusText: string) => {
        setProcessingStatusText(statusText);
    }, []);

    /**
     * Update task count
     */
    const updateTaskCount = useCallback((count: number) => {
        setProcessingTaskCount(count);
    }, []);

    /**
     * Update estimated time
     */
    const updateEstimatedTime = useCallback((seconds: number) => {
        setProcessingEstimatedTime(seconds);
    }, []);

    /**
     * Hide processing overlay
     */
    const hideProcessing = useCallback(() => {
        setProcessingLabel(null);
        setProcessingProgress(0);
        setProcessingStatusText(undefined);
        setProcessingEstimatedTime(undefined);
        setProcessingTaskCount(undefined);
        processingStartTimeRef.current = null;
    }, []);

    /**
     * Get elapsed time since processing started
     */
    const getElapsedTime = useCallback((): number => {
        if (!processingStartTimeRef.current) return 0;
        return Math.round((Date.now() - processingStartTimeRef.current) / 1000);
    }, []);

    return {
        // State
        isProcessing: processingLabel !== null,
        processingLabel,
        processingProgress,
        processingStatusText,
        processingEstimatedTime,
        processingTaskCount,

        // Methods
        showProcessing,
        updateProgress,
        updateStatus,
        updateTaskCount,
        updateEstimatedTime,
        hideProcessing,
        getElapsedTime,

        // For direct state access if needed
        setProcessingLabel,
        setProcessingProgress,
        setProcessingStatusText,
        setProcessingEstimatedTime,
        setProcessingTaskCount,
    };
}

export default useProcessingOverlay;
