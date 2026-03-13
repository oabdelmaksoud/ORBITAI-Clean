import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Toast as ToastServiceType, ToastAction } from '../services/toastService';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface ToastProps {
  toast: ToastServiceType;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after duration (skip for confirm toasts - they need user action)
    if (toast.type !== 'confirm') {
      const duration = toast.duration || (toast.type === 'error' ? 8000 : 5000);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(toast.id), 300); // Wait for fade-out animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, toast.type, onDismiss]);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    confirm: AlertCircle,
  };

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    confirm: 'bg-orange-50 border-orange-200 text-orange-800',
  };

  const Icon = icons[toast.type];
  const styleClass = styles[toast.type];

  const isConfirm = toast.type === 'confirm';
  
  return (
    <div
      className={`
        ${styleClass}
        border rounded-lg p-4 shadow-lg ${isConfirm ? 'min-w-[320px] max-w-[500px] w-full' : 'min-w-[300px] max-w-[500px]'}
        transition-all duration-300 ease-in-out
        ${isVisible 
          ? (isConfirm ? 'opacity-100 scale-100' : 'opacity-100 translate-x-0') 
          : (isConfirm ? 'opacity-0 scale-95' : 'opacity-0 translate-x-full')
        }
        flex items-start gap-3
      `}
    >
      <Icon size={20} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{toast.message}</p>
        {toast.type === 'confirm' && toast.actions && toast.actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {toast.actions.map((action: ToastAction, index: number) => (
              <button
                key={index}
                onClick={() => {
                  setIsVisible(false);
                  setTimeout(() => {
                    action.action();
                    onDismiss(toast.id);
                  }, 100);
                }}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded transition-colors
                  ${action.style === 'danger' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : action.style === 'primary'
                    ? 'bg-primary hover:bg-primary/90 text-white'
                    : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {toast.type !== 'confirm' && (
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(toast.id), 300);
          }}
          className={`
            shrink-0 p-1 rounded hover:bg-black/10 transition-colors
            ${toast.type === 'error' ? 'text-red-600' : ''}
            ${toast.type === 'success' ? 'text-green-600' : ''}
            ${toast.type === 'warning' ? 'text-yellow-600' : ''}
            ${toast.type === 'info' ? 'text-blue-600' : ''}
          `}
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastServiceType[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  // Separate confirmation toasts from regular toasts
  const confirmToasts = toasts.filter(t => t.type === 'confirm');
  const regularToasts = toasts.filter(t => t.type !== 'confirm');

  return (
    <>
      {/* Regular toasts - top right */}
      {regularToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          {regularToasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={onDismiss} />
            </div>
          ))}
        </div>
      )}
      
      {/* Confirmation toasts - center of screen with backdrop */}
      {confirmToasts.length > 0 && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col gap-3 max-w-md w-full">
            {confirmToasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      )}
    </>
  );
};


