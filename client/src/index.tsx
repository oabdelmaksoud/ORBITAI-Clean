import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
// import App from './App';
const App = React.lazy(() => import('./App'));

import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import './index.css';
// Import browserUtils init function
import { initializeBrowserUtils } from './utils/browserUtils';

console.log('Starting app initialization...');

// Initialize error tracking (non-blocking, optional)
if (typeof window !== 'undefined') {
  import('./services/errorTracking').then(({ initErrorTracking }) => {
    initErrorTracking().catch((err: any) => {
      // Silently fail - error tracking is optional
      if (process.env.NODE_ENV === 'development') {
        console.log('[Error Tracking] Not configured or failed to initialize');
      }
    });
  }).catch(() => { });
}

console.log('Checking for root element...');
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  throw new Error("Could not find root element to mount to");
}

console.log('Root element found, creating React root...');

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('✅ React root created, calling render...');

  // Initialize browser overrides asynchronously to prevent blocking render
  setTimeout(() => {
    initializeBrowserUtils();
  }, 100);

  root.render(
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <ThemeProvider>
            <Suspense fallback={<div style={{ padding: 20, color: '#666' }}>Initializing Application Logic...</div>}>
              <App />
            </Suspense>
          </ThemeProvider>
        </AuthProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );

  console.log('⏳ root.render() called');
} catch (error) {
  console.error('❌ Error during app initialization:', error);
}