/**
 * UI Interaction Handlers
 * Extracted from App.tsx to reduce component size
 * 
 * @module handlers/uiHandlers
 */

import { ViewMode } from '@orbitai/shared';

/**
 * Dependencies required by UI handlers
 */
export interface UIHandlerDeps {
    // State setters
    setShowConfirmation: (show: boolean) => void;
    setConfirmationConfig: (config: any) => void;
    setRightSidebarView: (view: 'chat' | 'graph' | 'mcp' | 'terminal' | 'agents') => void;
    setIsRightSidebarOpen: (isOpen: boolean) => void;
    setShowSettings: (show: boolean) => void;

    // Refs
    confirmationResolverRef: React.MutableRefObject<((value: boolean) => void) | null>;
    historyRef: React.MutableRefObject<any>; // useHistory hook ref
}

/**
 * Create UI handlers with provided dependencies
 */
export const createUIHandlers = (deps: UIHandlerDeps) => {
    const {
        setShowConfirmation,
        setConfirmationConfig,
        setRightSidebarView,
        setIsRightSidebarOpen,
        setShowSettings,
        confirmationResolverRef,
        historyRef
    } = deps;

    /**
     * Show a confirmation modal and await user response
     */
    const showConfirmation = (
        title: string,
        message: string,
        type: 'confirm' | 'alert' | 'success' | 'error' | 'info' = 'confirm',
        onConfirm?: () => void,
        onCancel?: () => void,
        confirmText?: string,
        cancelText?: string
    ): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            confirmationResolverRef.current = resolve;
            setConfirmationConfig({
                title,
                message,
                type,
                onConfirm: () => {
                    if (onConfirm) onConfirm();
                    resolve(true);
                    setShowConfirmation(false);
                    confirmationResolverRef.current = null;
                },
                onCancel: () => {
                    if (onCancel) onCancel();
                    resolve(false);
                    setShowConfirmation(false);
                    confirmationResolverRef.current = null;
                },
                confirmText,
                cancelText
            });
            setShowConfirmation(true);
        });
    };

    /**
     * Handle undo action
     */
    const handleUndo = () => {
        if (historyRef.current && typeof historyRef.current.undo === 'function') {
            historyRef.current.undo();
        }
    };

    /**
     * Handle redo action
     */
    const handleRedo = () => {
        if (historyRef.current && typeof historyRef.current.redo === 'function') {
            historyRef.current.redo();
        }
    };

    /**
     * Toggle right sidebar visibility
     */
    const toggleRightSidebar = (view?: 'chat' | 'graph' | 'mcp' | 'terminal' | 'agents') => {
        if (view) {
            setRightSidebarView(view);
            setIsRightSidebarOpen(true);
        } else {
            setIsRightSidebarOpen(prev => !prev);
        }
    };

    /**
     * Open settings modal
     */
    const handleOpenSettings = () => {
        setShowSettings(true);
    };

    return {
        showConfirmation,
        handleUndo,
        handleRedo,
        toggleRightSidebar,
        handleOpenSettings
    };
};

export type UIHandlers = ReturnType<typeof createUIHandlers>;
