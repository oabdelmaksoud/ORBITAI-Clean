/**
 * Setup Handlers - File drag/drop and setup stage handling
 * 
 * Extracted from App.tsx to reduce component size and improve maintainability.
 * 
 * @module handlers/setupHandlers
 */

import type React from 'react';

/**
 * Dependencies required for setup handlers
 */
export interface SetupHandlerDeps {
    // Setters
    setIsDraggingSetup: (value: boolean) => void;
    setSetupFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

/**
 * Returns setup handler functions for drag and drop
 */
export function createSetupHandlers(deps: SetupHandlerDeps) {
    const { setIsDraggingSetup, setSetupFiles } = deps;

    /**
     * Handle drag over event in setup area
     */
    const handleSetupDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingSetup(true);
    };

    /**
     * Handle drag leave event in setup area
     */
    const handleSetupDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingSetup(false);
    };

    /**
     * Handle file drop in setup area
     */
    const handleSetupDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingSetup(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setSetupFiles(prev => [...prev, ...files]);
        }
    };

    /**
     * Remove a file from the setup files list
     */
    const removeSetupFile = (index: number) => {
        setSetupFiles(prev => prev.filter((_, i) => i !== index));
    };

    return {
        handleSetupDragOver,
        handleSetupDragLeave,
        handleSetupDrop,
        removeSetupFile
    };
}
