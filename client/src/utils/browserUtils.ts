/**
 * Browser Utilities - Replace browser alerts/confirms with toast notifications
 * This module provides drop-in replacements for window.alert() and window.confirm()
 * Also overrides global window.alert() and window.confirm() to use toasts automatically
 */

import { toast } from '../services/toastService';

/**
 * Replace window.alert() with toast notifications
 * Usage: Replace alert('message') with showAlert('message')
 */
export function showAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
  toast[type](message, type === 'error' ? 8000 : 5000);
}

/**
 * Replace window.confirm() with centered confirmation toast
 * Returns a Promise that resolves to true if confirmed, false if cancelled
 * Usage: Replace if (confirm('message')) with if (await showConfirm('message'))
 * For synchronous code, you can use: showConfirm('message').then(result => { if (result) { ... } })
 */
export function showConfirm(
  message: string,
  confirmLabel: string = 'Confirm',
  cancelLabel: string = 'Cancel'
): Promise<boolean> {
  return new Promise((resolve) => {
    toast.confirm(
      message,
      () => resolve(true),
      () => resolve(false),
      confirmLabel,
      cancelLabel
    );
  });
}

/**
 * Synchronous wrapper for confirm (for legacy code compatibility)
 * Note: This uses a timeout-based approach which is not ideal
 * Prefer using showConfirm() with async/await for new code
 */
export function showConfirmSync(message: string): boolean {
  // For synchronous confirm, we MUST use the native confirm because we can't block execution
  // to wait for user input in a non-blocking UI environment like a browser main thread.
  // We can't use the toast notification approach here because it requires async/await.

  if ((window as any).__originalConfirm) {
    return (window as any).__originalConfirm(message);
  }

  // Fallback if original confirm is lost (shouldn't happen)
  // We can't really do anything else here other than return false or throw
  console.warn('[browserUtils] Native confirm() lost, returning false.');
  return false;
}

// Override global window.alert() to use toasts
let initialized = false;

export function initializeBrowserUtils() {
  if (typeof window === 'undefined' || initialized) return;

  const originalAlert = window.alert;
  window.alert = function (message: string): void {
    // Use info toast for alerts (neutral messages)
    toast.info(String(message), 5000);
    // Also log to console for debugging
    if (import.meta.env.DEV) {
      console.log('[Alert]', message);
    }
  };

  // Override global window.confirm() to use toast confirmations
  const originalConfirm = window.confirm;
  window.confirm = function (message: string): boolean {
    // For synchronous confirm, we need to use the sync wrapper
    return showConfirmSync(String(message));
  };

  // Store originals in case we need them
  (window as any).__originalAlert = originalAlert;
  (window as any).__originalConfirm = originalConfirm;

  initialized = true;
  console.log('✅ [browserUtils] Initialized global overrides');
}

