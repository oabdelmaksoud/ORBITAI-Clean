import { useState, useEffect, useRef } from 'react';
import { ViewMode } from '@orbitai/shared';
import { UserProfile } from '@orbitai/shared';

/**
 * Hook to manage view mode with URL hash synchronization
 * Extracted from App.tsx to centralize view mode logic
 */
export const useViewMode = (user: UserProfile | null) => {
  const isProgrammaticHashChangeRef = useRef(false);

  // Initialize viewMode from URL hash if present
  const getInitialViewMode = (): ViewMode => {
    const hash = window.location.hash;
    // Check if hash starts with #admin (supports #admin?tab=finance format)
    if (hash.startsWith('#admin')) {
      return 'admin';
    }
    // Hub removed
    if (hash === '#setup') {
      return 'setup';
    }
    if (hash === '#workspace') {
      return 'workspace';
    }
    return 'landing';
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode());

  // Update URL hash when viewMode changes (for browser history support)
  useEffect(() => {
    // Don't update hash if we're viewing a shared project
    const urlParams = new URLSearchParams(window.location.search);
    const isViewOnly = urlParams.has('token') || window.location.pathname.includes('/share/');
    if (isViewOnly) return;

    const currentHash = window.location.hash;
    const expectedHash =
      viewMode === 'admin' ? '#admin' :
        // Hub removed
        viewMode === 'setup' ? '#setup' :
          viewMode === 'workspace' ? '#workspace' :
            viewMode === 'landing' ? '' : null;

    // Only update hash if it doesn't match expected value
    // For admin mode, check if hash starts with #admin (to preserve tab parameters)
    const hashMatches = expectedHash === null ? false :
      viewMode === 'admin' ? currentHash.startsWith('#admin') :
        currentHash === expectedHash;

    if (expectedHash !== null && !hashMatches) {
      // Skip update if hash is already being changed programmatically
      if (isProgrammaticHashChangeRef.current) {
        isProgrammaticHashChangeRef.current = false;
        return;
      }

      // Set flag before changing hash
      isProgrammaticHashChangeRef.current = true;

      if (viewMode === 'admin') {
        // Only update hash if it doesn't already start with #admin (preserve tab parameters)
        const currentHashInEffect = window.location.hash;
        if (!currentHashInEffect.startsWith('#admin')) {
          window.location.hash = '#admin';
        }
      } else if (viewMode === 'setup') {
        window.location.hash = '#setup';
      } else if (viewMode === 'workspace') {
        window.location.hash = '#workspace';
      } else if (viewMode === 'landing' && !user) {
        // Clear hash when going to landing without user (but not if it's a share link)
        if (!window.location.pathname.includes('/share/')) {
          window.location.hash = '';
        }
      }
    }
  }, [viewMode, user]);

  // Listen for hash changes from browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      // Skip if we just changed it programmatically
      if (isProgrammaticHashChangeRef.current) {
        isProgrammaticHashChangeRef.current = false;
        return;
      }

      const hash = window.location.hash;
      let newViewMode: ViewMode = 'landing';

      if (hash.startsWith('#admin')) {
        newViewMode = 'admin';
      } else if (hash === '#setup') {
        newViewMode = 'setup';
      } else if (hash === '#workspace') {
        newViewMode = 'workspace';
      } else if (hash === '' || hash === '#') {
        newViewMode = 'landing';
      }

      if (newViewMode !== viewMode) {
        setViewMode(newViewMode);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [viewMode]);

  return {
    viewMode,
    setViewMode: (mode: ViewMode) => {
      isProgrammaticHashChangeRef.current = true;
      setViewMode(mode);
    },
    isProgrammaticHashChangeRef
  };
};






