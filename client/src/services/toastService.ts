/**
 * Toast Notification Service
 * Manages toast notifications for user-facing messages
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface ToastAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  actions?: ToastAction[]; // For confirmation toasts
}

type ToastListener = (toasts: Toast[]) => void;

class ToastService {
  private toasts: Toast[] = [];
  private listeners: ToastListener[] = [];

  /**
   * Subscribe to toast updates
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.push(listener);
    // Immediately notify with current toasts
    listener([...this.toasts]);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notify() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  /**
   * Show a toast notification
   */
  show(message: string, type: ToastType = 'info', duration?: number): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const toast: Toast = { id, message, type, duration };

    this.toasts.push(toast);
    this.notify();

    return id;
  }

  /**
   * Show success message
   */
  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  /**
   * Show error message
   */
  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration);
  }

  /**
   * Show warning message
   */
  warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration);
  }

  /**
   * Show info message
   */
  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }

  /**
   * Show confirmation toast with action buttons
   */
  confirm(
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmLabel: string = 'Confirm',
    cancelLabel: string = 'Cancel'
  ): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const actions: ToastAction[] = [
      {
        label: cancelLabel,
        action: () => {
          this.dismiss(id);
          if (onCancel) onCancel();
        },
        style: 'secondary'
      },
      {
        label: confirmLabel,
        action: () => {
          this.dismiss(id);
          onConfirm();
        },
        style: 'danger'
      }
    ];

    const toast: Toast = {
      id,
      message,
      type: 'confirm',
      duration: 0, // Don't auto-dismiss confirmation toasts
      actions
    };

    this.toasts.push(toast);
    this.notify();

    return id;
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toasts = [];
    this.notify();
  }

  /**
   * Get current toasts
   */
  getToasts(): Toast[] {
    return [...this.toasts];
  }
}

// Export singleton instance
export const toastService = new ToastService();

// Convenience functions for direct use
export const toast = {
  success: (message: string, duration?: number) => toastService.success(message, duration),
  error: (message: string, duration?: number) => toastService.error(message, duration),
  warning: (message: string, duration?: number) => toastService.warning(message, duration),
  info: (message: string, duration?: number) => toastService.info(message, duration),
  loading: (message: string, duration?: number) => toastService.info(message, duration),
  confirm: (
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmLabel?: string,
    cancelLabel?: string
  ) => toastService.confirm(message, onConfirm, onCancel, confirmLabel, cancelLabel),
  dismiss: (id: string) => toastService.dismiss(id),
  dismissAll: () => toastService.dismissAll(),
};


