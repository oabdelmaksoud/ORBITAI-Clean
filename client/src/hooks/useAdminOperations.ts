/**
 * useAdminOperations Hook
 * 
 * Handles admin authentication and operations.
 * Extracted from App.tsx for better maintainability.
 */

import { useState, useCallback, useRef } from 'react';

interface UseAdminOperationsOptions {
    onAdminLoginSuccess?: () => void;
    onAdminLogoutSuccess?: () => void;
}

export function useAdminOperations(options: UseAdminOperationsOptions = {}) {
    const { onAdminLoginSuccess, onAdminLogoutSuccess } = options;

    // Admin state
    const [adminToken, setAdminToken] = useState<string | null>(() =>
        localStorage.getItem('admin_token')
    );
    const [adminUser, setAdminUser] = useState<any>(null);

    // Ref to track programmatic hash changes
    const isProgrammaticHashChangeRef = useRef(false);

    /**
     * Handle admin login success
     */
    const handleAdminLoginSuccess = useCallback((token: string, adminUserData: any) => {
        localStorage.setItem('admin_token', token);
        setAdminToken(token);
        setAdminUser(adminUserData);
        onAdminLoginSuccess?.();
    }, [onAdminLoginSuccess]);

    /**
     * Handle admin logout
     */
    const handleAdminLogout = useCallback(() => {
        localStorage.removeItem('admin_token');
        setAdminToken(null);
        setAdminUser(null);

        // Update hash programmatically
        isProgrammaticHashChangeRef.current = true;
        window.location.hash = '#setup';

        onAdminLogoutSuccess?.();
    }, [onAdminLogoutSuccess]);

    /**
     * Handle admin click (navigate to admin)
     */
    const handleAdminClick = useCallback(() => {
        window.location.hash = '#admin';
    }, []);

    /**
     * Check if admin is authenticated
     */
    const isAdminAuthenticated = useCallback((): boolean => {
        return !!adminToken;
    }, [adminToken]);

    /**
     * Get admin token for API calls
     */
    const getAdminToken = useCallback((): string | null => {
        return adminToken;
    }, [adminToken]);

    return {
        // State
        adminToken,
        setAdminToken,
        adminUser,
        setAdminUser,
        isProgrammaticHashChangeRef,

        // Computed
        isAdminAuthenticated: !!adminToken,

        // Methods
        handleAdminLoginSuccess,
        handleAdminLogout,
        handleAdminClick,
        getAdminToken,
    };
}

export default useAdminOperations;
