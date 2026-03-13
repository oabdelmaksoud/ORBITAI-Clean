/**
 * useAuthentication Hook
 * 
 * Handles user authentication, login, logout, signup, and profile management.
 * Extracted from App.tsx for better maintainability.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { UserProfile } from '@orbitai/shared';
import { setAuthToken } from '@src/services/api';

interface AuthState {
    user: UserProfile | null;
    showUserLogin: boolean;
    showUserSignup: boolean;
    showUserProfile: boolean;
    showPackageSelection: boolean;
    showPayment: boolean;
    showSubscription: boolean;
    subscriptionMode: 'login' | 'pricing';
    pendingUser: any;
    selectedPackage: any;
}

interface UseAuthenticationOptions {
    onLoginSuccess?: (user: UserProfile) => void;
    onLogoutSuccess?: () => void;
    projectListLength?: number;
    updatePreference?: (key: string, value: any) => Promise<void>;
}

export function useAuthentication(options: UseAuthenticationOptions = {}) {
    const { onLoginSuccess, onLogoutSuccess, projectListLength = 0, updatePreference } = options;

    // Auth state
    const [user, setUser] = useState<UserProfile | null>(() => {
        try {
            const stored = localStorage.getItem('orbitai_user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    // Modal visibility state
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [showUserSignup, setShowUserSignup] = useState(false);
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [showPackageSelection, setShowPackageSelection] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [showSubscription, setShowSubscription] = useState(false);
    const [subscriptionMode, setSubscriptionMode] = useState<'login' | 'pricing'>('login');

    // Pending signup state
    const [pendingUser, setPendingUser] = useState<any>(null);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);

    // Refs for role refresh tracking
    const userEmailRef = useRef<string | undefined>(user?.email);
    const hasRefreshedRoleRef = useRef(false);

    useEffect(() => {
        userEmailRef.current = user?.email;
    }, [user?.email]);

    // Reset refresh flag when email changes
    useEffect(() => {
        hasRefreshedRoleRef.current = false;
    }, [user?.email]);

    /**
     * Check if user has admin role
     */
    const isAdminUser = useCallback((userToCheck: UserProfile | null): boolean => {
        if (!userToCheck) return false;

        let role = userToCheck.role?.toLowerCase()?.trim();

        // Fallback: Check localStorage directly if role is missing
        if (!role) {
            try {
                const storedUserStr = localStorage.getItem('orbitai_user');
                if (storedUserStr) {
                    const storedUser = JSON.parse(storedUserStr);
                    role = storedUser?.role?.toLowerCase()?.trim();
                }
            } catch (e) {
                console.error('Failed to check localStorage for role', e);
            }
        }

        return role === 'admin' || role === 'superadmin';
    }, []);

    /**
     * Handle user login
     */
    const handleLogin = useCallback(async (u: UserProfile) => {
        setUser(u);
        localStorage.setItem('orbitai_user', JSON.stringify(u));

        // Persist auth token
        if (u.token) {
            setAuthToken(u.token);
        }

        // Migrate localStorage data to database on login
        if (u.token) {
            try {
                const { migrateLocalStorageToDatabase, extractLocalStorageData } = await import('../services/userSettingsApi');
                const localStorageData = extractLocalStorageData();
                if (localStorageData.currentProjectId || Object.keys(localStorageData.preferences).length > 0 || Object.keys(localStorageData.shareLinks).length > 0) {
                    await migrateLocalStorageToDatabase(u.token, localStorageData);
                    console.log('LocalStorage data migrated to database');
                }
            } catch (migrationError) {
                console.warn('Failed to migrate localStorage data on login:', migrationError);
            }
        }

        setShowSubscription(false);
        setShowUserLogin(false);
        setShowUserSignup(false);

        onLoginSuccess?.(u);
    }, [onLoginSuccess]);

    /**
     * Handle signup button click
     */
    const handleSignup = useCallback((preSelectedPackage?: any) => {
        console.log('handleSignup called with package:', preSelectedPackage);
        if (preSelectedPackage) {
            console.log('Setting selected package:', preSelectedPackage);
            setSelectedPackage(preSelectedPackage);
        }
        console.log('Opening signup modal');
        setShowUserSignup(true);
    }, []);

    /**
     * Handle successful login from API
     */
    const handleUserLoginSuccess = useCallback(async (userData: any) => {
        const userProfile: UserProfile = {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=2563eb&color=fff`,
            plan: userData.plan || 'Starter',
            role: (userData.role?.toLowerCase()?.trim() || 'user') as 'admin' | 'user' | 'editor' | 'superadmin',
            subscriptionStatus: userData.subscriptionStatus || 'active',
            memberSince: userData.memberSince || Date.now(),
            token: userData.token
        };

        console.log('[Login] User data received:', {
            hasRole: !!userData.role,
            role: userData.role,
            userProfileRole: userProfile.role,
        });

        await handleLogin(userProfile);
    }, [handleLogin]);

    /**
     * Handle successful signup from API
     */
    const handleUserSignupSuccess = useCallback((userData: any) => {
        setPendingUser(userData);
        setShowUserSignup(false);
        setShowPackageSelection(true);
    }, []);

    /**
     * Handle package selection during signup
     */
    const handlePackageSelect = useCallback((pkg: any) => {
        setSelectedPackage(pkg);
        setShowPackageSelection(false);

        if (pkg.price === 0) {
            // Complete signup immediately for free packages
            completeSignupInternal(pkg);
        } else {
            setShowPayment(true);
        }
    }, []);

    /**
     * Handle payment success
     */
    const handlePaymentSuccess = useCallback((paymentData: any) => {
        completeSignupInternal(selectedPackage, paymentData);
    }, [selectedPackage]);

    /**
     * Complete signup process (internal)
     */
    const completeSignupInternal = async (pkg: any, paymentData?: any) => {
        if (!pendingUser) return;

        const userProfile: UserProfile = {
            id: pendingUser.id,
            name: pendingUser.name,
            email: pendingUser.email,
            avatar: pendingUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(pendingUser.name)}&background=2563eb&color=fff`,
            plan: pkg.name === 'Starter' || pkg.name === 'Free' ? 'Starter' :
                pkg.name === 'Pro' ? 'Pro' : 'Enterprise',
            role: pendingUser.role?.toLowerCase() || 'user',
            subscriptionStatus: 'active',
            memberSince: Date.now(),
            token: pendingUser.token
        };

        await handleLogin(userProfile);
        setShowPayment(false);
        setShowPackageSelection(false);
        setPendingUser(null);
        setSelectedPackage(null);
    };

    /**
     * Complete signup (public API)
     */
    const completeSignup = useCallback((pkg: any, paymentData?: any) => {
        completeSignupInternal(pkg, paymentData);
    }, [pendingUser, handleLogin]);

    /**
     * Handle upgrade button click
     */
    const handleUpgradeClick = useCallback(() => {
        setSubscriptionMode('pricing');
        setShowSubscription(true);
    }, []);

    /**
     * Handle profile button click
     */
    const handleProfileClick = useCallback(() => {
        if (user) {
            setShowUserProfile(true);
        } else {
            setShowUserLogin(true);
        }
    }, [user]);

    /**
     * Handle user logout
     */
    const handleUserLogout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('orbitai_user');
        onLogoutSuccess?.();
    }, [onLogoutSuccess]);

    /**
     * Refresh user role from backend
     */
    const refreshUserRole = useCallback(async () => {
        if (!user || user.role || hasRefreshedRoleRef.current || userEmailRef.current !== user?.email) {
            return;
        }

        hasRefreshedRoleRef.current = true;

        try {
            const adminToken = localStorage.getItem('admin_token');
            if (adminToken && user.email) {
                const { getUsers } = await import('../services/adminApi');
                const response = await getUsers(adminToken);
                const adminUser = response.users.find((u: any) => u.email === user.email);
                if (adminUser && adminUser.role) {
                    const roleStr = adminUser.role.toLowerCase().trim();
                    const role = (['user', 'admin', 'editor', 'superadmin'].includes(roleStr) ? roleStr : 'user') as 'user' | 'admin' | 'editor' | 'superadmin';
                    const updatedUser = { ...user, role };
                    setUser(updatedUser);

                    // Save preferences to database
                    if (user?.token && updatePreference) {
                        try {
                            await updatePreference('selectedTheme', updatedUser.selectedTheme);
                            if (updatedUser.theme) {
                                await updatePreference('theme', updatedUser.theme);
                            }
                        } catch (dbError) {
                            console.warn('Failed to save preferences to database:', dbError);
                        }
                    }

                    localStorage.setItem('orbitai_user', JSON.stringify(updatedUser));
                    console.log('[Refresh Role] User role updated from admin API:', adminUser.role);
                }
            }
        } catch (e) {
            console.warn('Failed to refresh user role from admin API', e);
            hasRefreshedRoleRef.current = false;
        }
    }, [user, updatePreference]);

    // Auto-refresh role on mount if needed
    useEffect(() => {
        refreshUserRole();
    }, [user?.email]);

    return {
        // State
        user,
        setUser,
        showUserLogin,
        setShowUserLogin,
        showUserSignup,
        setShowUserSignup,
        showUserProfile,
        setShowUserProfile,
        showPackageSelection,
        setShowPackageSelection,
        showPayment,
        setShowPayment,
        showSubscription,
        setShowSubscription,
        subscriptionMode,
        setSubscriptionMode,
        pendingUser,
        setPendingUser,
        selectedPackage,
        setSelectedPackage,

        // Computed
        isAuthenticated: !!user,
        userRole: user?.role ? user.role.toLowerCase().trim() : 'public',

        // Methods
        isAdminUser,
        handleLogin,
        handleSignup,
        handleUserLoginSuccess,
        handleUserSignupSuccess,
        handlePackageSelect,
        handlePaymentSuccess,
        completeSignup,
        handleUpgradeClick,
        handleProfileClick,
        handleUserLogout,
        refreshUserRole,
    };
}

export default useAuthentication;
