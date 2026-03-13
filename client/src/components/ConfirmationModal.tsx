import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type ConfirmationType = 'confirm' | 'alert' | 'success' | 'error' | 'info';

interface ConfirmationModalProps {
  isOpen: boolean;
  type?: ConfirmationType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  type = 'confirm',
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  onClose
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} className="text-green-600" />;
      case 'error':
        return <AlertCircle size={24} className="text-red-600" />;
      case 'info':
        return <Info size={24} className="text-blue-600" />;
      case 'alert':
        return <AlertTriangle size={24} className="text-yellow-600" />;
      default:
        return <AlertCircle size={24} className="text-primary" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100';
      case 'error':
        return 'bg-red-100';
      case 'info':
        return 'bg-blue-100';
      case 'alert':
        return 'bg-yellow-100';
      default:
        return 'bg-primary/10';
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700';
      case 'alert':
        return 'bg-yellow-600 hover:bg-yellow-700';
      default:
        return 'bg-primary hover:bg-blue-600';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4 border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full ${getIconBg()} flex items-center justify-center shrink-0`}>
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors shrink-0 ml-2"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-line">{message}</p>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          {type === 'confirm' && (
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-bold text-sm"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2 ${getConfirmButtonColor()} text-white rounded-lg transition-colors font-bold text-sm`}
          >
            {type === 'confirm' ? confirmText : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
















