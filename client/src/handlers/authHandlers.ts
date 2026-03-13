/**
 * Authentication Handlers
 * Extracted from App.tsx to reduce component size
 * Uses factory pattern to receive state dependencies
 * 
 * @module handlers/authHandlers
 */

import { UserProfile, ViewMode } from '@orbitai/shared';
import { setAuthToken } from '../services/api';

/**
 * Dependencies required by auth handlers
 */
export interface AuthHandlerDeps {
    // State setters
    setViewMode: (mode: ViewMode) => void;
    setShowUserLogin: (show: boolean) => void;
    setShowUserSignup: (show: boolean) => void;
    setShowSubscription: (show: boolean) => void;
    setShowPackageSelection: (show: boolean) => void;
    setShowPayment: (show: boolean) => void;
    setShowUserProfile: (show: boolean) => void;
    setSelectedPackage: (pkg: any) => void;
    setPendingUser: (user: any) => void;
    setSubscriptionMode: (mode: 'pricing' | 'manage') => void;
    setAdminToken: (token: string | null) => void;
    setAdminUser: (user: any) => void;

    // Refs
    isProgrammaticHashChangeRef: React.MutableRefObject<boolean>;

    // State values (via refs or getters)
    user: UserProfile | null;
    projectList: any[];
    selectedPackage: any;
    pendingUser: any;

    // Other handlers
    handleCreateNewProject: () => void;
    authLogout: () => void;
}

/**
 * Create auth handlers with provided dependencies
 */
export const createAuthHandlers = (deps: AuthHandlerDeps) => {
    const {
        setViewMode,
        setShowUserLogin,
        setShowUserSignup,
        setShowSubscription,
        setShowPackageSelection,
        setShowPayment,
        setShowUserProfile,
        setSelectedPackage,
        setPendingUser,
        setSubscriptionMode,
        setAdminToken,
        setAdminUser,
        isProgrammaticHashChangeRef,
        user,
        projectList,
        selectedPackage,
        pendingUser,
        handleCreateNewProject,
        authLogout
    } = deps;

    /**
     * Launch demo mode for non-authenticated users
     */
    const handleLaunchDemo = () => {
        setViewMode('setup');
        window.location.hash = '#setup';
    };

    /**
     * Open signup modal, optionally with a preselected package
     */
    const handleSignup = (preSelectedPackage?: any) => {
        console.log('handleSignup called with package:', preSelectedPackage);
        if (preSelectedPackage) {
            console.log('Setting selected package:', preSelectedPackage);
            setSelectedPackage(preSelectedPackage);
        }
        console.log('Opening signup modal');
        setShowUserSignup(true);
    };

    /**
     * Handle successful login - migrate data and update UI
     */
    const handleLogin = async (u: UserProfile) => {
        // Persist auth token
        if (u.token) {
            setAuthToken(u.token);
        }

        // Migrate localStorage data to database on login
        if (u.token) {
            try {
                const { migrateLocalStorageToDatabase, extractLocalStorageData } = await import('../services/userSettingsApi');
                const localStorageData = extractLocalStorageData();
                if (localStorageData.currentProjectId ||
                    Object.keys(localStorageData.preferences).length > 0 ||
                    Object.keys(localStorageData.shareLinks).length > 0) {
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
    };

    /**
     * Handle successful user login from API response
     */
    const handleUserLoginSuccess = async (userData: any) => {
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
            userProfileRole: userProfile.role
        });

        await handleLogin(userProfile);

        // Navigate to appropriate view
        if (projectList.length > 0) {
            setViewMode('setup');
        } else {
            setTimeout(() => {
                if (typeof handleCreateNewProject === 'function') {
                    handleCreateNewProject();
                } else {
                    setViewMode('setup');
                    window.location.hash = '#setup';
                }
            }, 0);
        }
    };

    /**
     * Handle successful user signup - show package selection
     */
    const handleUserSignupSuccess = (userData: any) => {
        setPendingUser(userData);
        setShowUserSignup(false);
        setShowPackageSelection(true);
    };

    /**
     * Handle package selection during signup flow
     */
    const handlePackageSelect = (pkg: any) => {
        setSelectedPackage(pkg);
        setShowPackageSelection(false);

        if (pkg.price === 0) {
            completeSignup(pkg);
        } else {
            setShowPayment(true);
        }
    };

    /**
     * Handle successful payment
     */
    const handlePaymentSuccess = (paymentData: any) => {
        completeSignup(selectedPackage, paymentData);
    };

    /**
     * Complete the signup process
     */
    const completeSignup = (pkg: any, _paymentData?: any) => {
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
            memberSince: Date.now()
        };

        handleLogin(userProfile);
        setShowPayment(false);
        setShowPackageSelection(false);
        setPendingUser(null);
        setSelectedPackage(null);

        if (projectList.length > 0) {
            setViewMode('setup');
        } else {
            handleCreateNewProject();
        }
    };

    /**
     * Open upgrade/pricing modal
     */
    const handleUpgradeClick = () => {
        setSubscriptionMode('pricing');
        setShowSubscription(true);
    };

    /**
     * Open user profile or login modal
     */
    const handleProfileClick = () => {
        if (user) {
            setShowUserProfile(true);
        } else {
            setShowUserLogin(true);
        }
    };

    /**
     * Navigate to admin console
     */
    const handleAdminClick = () => {
        setViewMode('admin');
        window.location.hash = '#admin';
    };

    /**
     * Handle successful admin login
     */
    const handleAdminLoginSuccess = (token: string, adminUserData: any) => {
        localStorage.setItem('admin_token', token);
        setAdminToken(token);
        setAdminUser(adminUserData);
        setViewMode('admin');
    };

    /**
     * Handle admin logout
     */
    const handleAdminLogout = () => {
        localStorage.removeItem('admin_token');
        setAdminToken(null);
        setAdminUser(null);
        setViewMode('setup');
        isProgrammaticHashChangeRef.current = true;
        window.location.hash = '#setup';
    };

    /**
     * Handle user logout
     */
    const handleUserLogout = () => {
        authLogout();
        setViewMode('landing');
    };

    return {
        handleLaunchDemo,
        handleSignup,
        handleLogin,
        handleUserLoginSuccess,
        handleUserSignupSuccess,
        handlePackageSelect,
        handlePaymentSuccess,
        completeSignup,
        handleUpgradeClick,
        handleProfileClick,
        handleAdminClick,
        handleAdminLoginSuccess,
        handleAdminLogout,
        handleUserLogout
    };
};

export type AuthHandlers = ReturnType<typeof createAuthHandlers>;
