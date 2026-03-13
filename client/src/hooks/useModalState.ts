import { useState, useCallback } from 'react';

/**
 * Hook for managing modal state
 * Consolidates multiple useState calls for modals into a single hook
 * Extracted from App.tsx to reduce state management complexity
 */
export const useModalState = () => {
  const [showSubscription, setShowSubscription] = useState(false);
  const [subscriptionMode, setSubscriptionMode] = useState<'login' | 'pricing'>('login');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [showUserSignup, setShowUserSignup] = useState(false);
  const [showPackageSelection, setShowPackageSelection] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showShareProject, setShowShareProject] = useState(false);
  const [showProjectImport, setShowProjectImport] = useState(false);
  const [showReportExport, setShowReportExport] = useState(false);
  const [showExportDataMenu, setShowExportDataMenu] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHITLPrompt, setShowHITLPrompt] = useState(false);
  const [showThemeStudio, setShowThemeStudio] = useState(false);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type?: 'confirm' | 'alert' | 'success' | 'error' | 'info';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  // Helper function to show confirmation modal
  const showConfirmation = useCallback((
    title: string,
    message: string,
    type: 'confirm' | 'alert' | 'success' | 'error' | 'info' = 'confirm',
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmationModal({
        isOpen: true,
        type,
        title,
        message,
        confirmText: confirmText || 'Confirm',
        cancelText: cancelText || 'Cancel',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
          onConfirm?.();
          resolve(true);
        },
        onCancel: () => {
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
          onCancel?.();
          resolve(false);
        }
      });
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setShowSubscription(false);
    setShowUserProfile(false);
    setShowUserLogin(false);
    setShowUserSignup(false);
    setShowPackageSelection(false);
    setShowPayment(false);
    setShowShareProject(false);
    setShowProjectImport(false);
    setShowReportExport(false);
    setShowExportDataMenu(false);
    setShowTerminal(false);
    setShowSettings(false);
    setShowHITLPrompt(false);
    setShowThemeStudio(false);
    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    // Modal states
    showSubscription,
    setShowSubscription,
    subscriptionMode,
    setSubscriptionMode,
    showUserProfile,
    setShowUserProfile,
    showUserLogin,
    setShowUserLogin,
    showUserSignup,
    setShowUserSignup,
    showPackageSelection,
    setShowPackageSelection,
    showPayment,
    setShowPayment,
    showShareProject,
    setShowShareProject,
    showProjectImport,
    setShowProjectImport,
    showReportExport,
    setShowReportExport,
    showExportDataMenu,
    setShowExportDataMenu,
    showTerminal,
    setShowTerminal,
    showSettings,
    setShowSettings,
    showHITLPrompt,
    setShowHITLPrompt,
    showThemeStudio,
    setShowThemeStudio,
    
    // Confirmation modal
    confirmationModal,
    setConfirmationModal,
    showConfirmation,
    closeAllModals
  };
};






