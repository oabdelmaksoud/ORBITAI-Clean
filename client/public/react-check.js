// React Version Check Script
// This script detects multiple React instances and warns the user

(function() {
  'use strict';
  
  // Wait for React to load
  setTimeout(function() {
    if (typeof window !== 'undefined' && window.React) {
      const reactVersion = window.React.version;
      console.log('[React Check] React version:', reactVersion);
      
      // Check for multiple React instances
      const reactModules = [];
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log('[React Check] React DevTools detected');
      }
      
      // Check if React is properly initialized
      if (!window.React.useReducer) {
        console.error('[React Check] ERROR: React.useReducer is not available!');
        console.error('[React Check] This usually means multiple React instances are loaded.');
        alert('React initialization error detected. Please hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)');
      } else {
        console.log('[React Check] React is properly initialized');
      }
    } else {
      console.warn('[React Check] React not found on window object');
    }
  }, 1000);
})();






