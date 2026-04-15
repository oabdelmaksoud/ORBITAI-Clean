import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches React errors and module import failures
 * Prevents blank page on import errors and displays user-friendly message
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details to console for debugging
    console.error('[ErrorBoundary] Caught error:', error);

    // Check if it's a module import error
    const isImportError = error.message.includes('does not provide an export') ||
      error.message.includes('Cannot find module') ||
      error.message.includes('Failed to fetch dynamically imported module');

    // Check if it's a network/backend error
    const isNetworkError = error.message.includes('Failed to fetch') ||
      error.message.includes('ERR_CONNECTION_REFUSED') ||
      error.message.includes('NetworkError') ||
      error.name === 'TypeError' && error.message === 'Failed to fetch';

    if (isImportError) {
      console.error('[ErrorBoundary] Module import error detected.');
    } else if (isNetworkError) {
      // Don't clutter console with network errors if possible
    } else {
      console.error('[ErrorBoundary] Error info:', errorInfo);
    }

    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error;
      const isImportError = error?.message.includes('does not provide an export') ||
        error?.message.includes('Cannot find module') ||
        error?.message.includes('Failed to fetch dynamically imported module');

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 border-2 border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isImportError ? 'Module Import Error' : 'Application Error'}
              </h1>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                {isImportError ? (
                  <>
                    A module import error occurred. This usually means a component or constant is being imported
                    but doesn't exist in the source file. This is often caused by:
                  </>
                ) : (
                  'An unexpected error occurred. Please try reloading the page.'
                )}
              </p>

              {isImportError && (
                <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                  <li>Missing export in a constants or component file</li>
                  <li>Incorrect import path</li>
                  <li>Circular dependency between modules</li>
                </ul>
              )}

              {error && (
                <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                  <p className="text-sm font-mono text-red-600 break-all">
                    {error.message}
                  </p>
                </div>
              )}

              {this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 mb-2">
                    Technical Details
                  </summary>
                  <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-auto max-h-64">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Try Again
              </button>
            </div>

            {import.meta.env.DEV && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  This error boundary is only visible in development. In production, users will see a generic error message.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
