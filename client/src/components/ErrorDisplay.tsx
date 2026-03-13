import React from 'react';
import { AlertCircle, X, RefreshCw, ExternalLink, HelpCircle } from 'lucide-react';

export interface ErrorInfo {
  message: string;
  suggestions?: string[];
  actionLabel?: string;
  onAction?: () => void;
  helpLink?: string;
  retryable?: boolean;
  onRetry?: () => void;
}

interface ErrorDisplayProps {
  error: ErrorInfo | string;
  onDismiss?: () => void;
  className?: string;
}

const ERROR_SUGGESTIONS: Record<string, string[]> = {
  'network': [
    'Check your internet connection',
    'Verify the API endpoint is accessible',
    'Try refreshing the page',
    'Check if the backend server is running'
  ],
  'authentication': [
    'Verify your API keys are configured correctly',
    'Check if your session has expired',
    'Try logging out and back in',
    'Clear browser cache and cookies'
  ],
  'validation': [
    'Check that all required fields are filled',
    'Verify the data format is correct',
    'Review the input constraints',
    'Check for special characters or invalid values'
  ],
  'permission': [
    'Verify you have the necessary permissions',
    'Check your user role and access level',
    'Contact an administrator if needed',
    'Review the project access settings'
  ],
  'timeout': [
    'The operation took too long to complete',
    'Try again with a simpler request',
    'Check your network connection speed',
    'Reduce the scope of the operation'
  ],
  'quota': [
    'You have reached your usage limit',
    'Upgrade your plan for higher limits',
    'Wait for the quota to reset',
    'Contact support for assistance'
  ]
};

const getErrorSuggestions = (errorMessage: string): string[] => {
  const lowerMessage = errorMessage.toLowerCase();
  
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
    return ERROR_SUGGESTIONS.network;
  }
  if (lowerMessage.includes('auth') || lowerMessage.includes('token') || lowerMessage.includes('unauthorized')) {
    return ERROR_SUGGESTIONS.authentication;
  }
  if (lowerMessage.includes('valid') || lowerMessage.includes('invalid') || lowerMessage.includes('format')) {
    return ERROR_SUGGESTIONS.validation;
  }
  if (lowerMessage.includes('permission') || lowerMessage.includes('forbidden') || lowerMessage.includes('access')) {
    return ERROR_SUGGESTIONS.permission;
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return ERROR_SUGGESTIONS.timeout;
  }
  if (lowerMessage.includes('quota') || lowerMessage.includes('limit') || lowerMessage.includes('exceeded')) {
    return ERROR_SUGGESTIONS.quota;
  }
  
  return [];
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss, className = '' }) => {
  const errorInfo: ErrorInfo = typeof error === 'string' 
    ? { 
        message: error,
        suggestions: getErrorSuggestions(error),
        retryable: error.toLowerCase().includes('network') || error.toLowerCase().includes('timeout')
      }
    : error;

  const suggestions = errorInfo.suggestions || getErrorSuggestions(errorInfo.message);

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold text-red-800">Error</h3>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-red-400 hover:text-red-600 transition-colors p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p className="text-sm text-red-700 mb-3">{errorInfo.message}</p>
          
          {suggestions.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                <HelpCircle size={12} /> Suggested Actions
              </div>
              <ul className="space-y-1.5">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="text-xs text-red-600 flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {errorInfo.retryable && errorInfo.onRetry && (
              <button
                onClick={errorInfo.onRetry}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Retry
              </button>
            )}
            {errorInfo.actionLabel && errorInfo.onAction && (
              <button
                onClick={errorInfo.onAction}
                className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {errorInfo.actionLabel}
              </button>
            )}
            {errorInfo.helpLink && (
              <a
                href={errorInfo.helpLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <ExternalLink size={12} /> Help
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;

