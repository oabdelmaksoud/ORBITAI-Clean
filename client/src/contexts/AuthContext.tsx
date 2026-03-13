import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, getAuthToken, removeAuthToken, setAuthToken, setCurrentUser, getCurrentUser } from '@src/services/api';

/**
 * AuthContext - Centralized Authentication State Management
 * 
 * This is the SINGLE SOURCE OF TRUTH for authentication state in the application.
 * All components should use this context via the `useAuth()` hook.
 * 
 * @example
 * ```tsx
 * import { useAuth } from '@/contexts/AuthContext';
 * 
 * function MyComponent() {
 *   const { user, loading, login, logout } = useAuth();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <LoginForm onLogin={login} />;
 *   return <div>Welcome, {user.name}</div>;
 * }
 * ```
 * 
 * Storage Strategy:
 * - Stores auth token in localStorage as 'authToken'
 * - Stores user data in localStorage as both 'orbitai_user' and 'currentUser' (for compatibility)
 * - Automatically restores session on page load
 * - Guest users are stored with role='guest' and special token format
 * 
 * Migration Notes:
 * - Replaced App.tsx local user state with this centralized context
 * - All components now receive reactive auth state updates
 * - No manual localStorage reading needed - context handles it
 * 
 * @see {@link useAuth} for the hook to consume this context
 */

/**
 * User profile data structure
 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  plan: string;
  role?: string;
  privacyMode?: boolean;
  token?: string; // JWT authentication token
}

/**
 * AuthContext API
 * 
 * @property {User | null} user - Currently authenticated user or null
 * @property {boolean} loading - True while validating stored token on mount
 * @property {boolean} isAuthenticated - True if user is logged in with valid token
 * @property {Function} login - Authenticate with email/password
 * @property {Function} register - Create new user account  
 * @property {Function} loginAsGuest - Create temporary guest session (no backend)
 * @property {Function} logout - Clear all auth state and localStorage
 * @property {Function} refreshUser - Re-fetch user data from backend
 * @property {Function} updateUser - Update user profile data
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    console.log('🔐 [Auth] Initializing auth...');
    try {
      const token = getAuthToken();
      if (token) {
        // Check if this is a guest token - skip API validation for guest
        if (token.startsWith('guest-token-')) {
          console.log('🔐 [Auth] Found guest token');
          const storedUser = getCurrentUser();
          if (storedUser && storedUser.role === 'guest') {
            setUser({ ...storedUser, token });
            console.log('✅ [Auth] Guest session restored from localStorage');
            return;
          }
        }

        // Try to get user from API for real tokens
        try {
          console.log('🔐 [Auth] Validating token with API...');
          const response = await authApi.getCurrentUser(true); // suppress auth errors
          if (response?.success && response?.data?.user) {
            console.log('✅ [Auth] Token valid, user restored:', response.data.user.email);
            setUser({
              ...response.data.user,
              token
            });
          } else {
            // Token might be invalid, clear it
            console.warn('⚠️ [Auth] Token invalid or API error, clearing token');
            removeAuthToken();
            setUser(null);
          }
        } catch (error: any) {
          // If 401/403, token is invalid
          if (error?.status === 401 || error?.status === 403) {
            console.warn('⚠️ [Auth] Token expired (401/403), clearing');
            removeAuthToken();
            setUser(null);
          } else {
            console.warn('⚠️ [Auth] Network error validting token, falling back to local');
            // Network error - try localStorage fallback for guest mode
            const storedUser = getCurrentUser();
            if (storedUser) {
              setUser({ ...storedUser, token });
            }
          }
        }
      } else {
        // No token - check localStorage for guest user
        const storedUser = getCurrentUser();
        if (storedUser && storedUser.role === 'guest') {
          console.log('🔐 [Auth] Restoring guest from localStorage (no token in memory)');
          // Restore guest user and their token
          setUser(storedUser);
          if (storedUser.token) {
            setAuthToken(storedUser.token);
          }
        } else {
          console.log('🔐 [Auth] No user found');
        }
      }
    } catch (error) {
      console.error('❌ [Auth] Auth initialization error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      if (response.success && response.data.user && response.data.token) {
        const userData = {
          ...response.data.user,
          token: response.data.token
        };
        setUser(userData);
        setAuthToken(response.data.token);
        setCurrentUser(response.data.user);
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await authApi.register({ email, password, name });
      if (response.success && response.data.user && response.data.token) {
        const userData = {
          ...response.data.user,
          token: response.data.token
        };
        setUser(userData);
        setAuthToken(response.data.token);
        setCurrentUser(response.data.user);
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  }, []);

  // Guest login - creates a local guest user without backend auth
  const loginAsGuest = useCallback(() => {
    const guestUser: User = {
      id: `guest-${Date.now()}`,
      email: 'guest@orbitai.local',
      name: 'Guest User',
      plan: 'free',
      role: 'guest',
      token: `guest-token-${Date.now()}`
    };
    setUser(guestUser);
    setAuthToken(guestUser.token!);
    setCurrentUser(guestUser);
    console.log('✅ Logged in as guest');
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    removeAuthToken();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('orbitai_user');
      }
    } catch (error) {
      console.error('Error clearing localStorage on logout:', error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await authApi.getCurrentUser(true);
      if (response?.success && response?.data?.user) {
        const userData = {
          ...response.data.user,
          token
        };
        setUser(userData);
        setCurrentUser(response.data.user);
      } else {
        // Token invalid
        logout();
      }
    } catch (error: any) {
      if (error?.status === 401 || error?.status === 403) {
        logout();
      } else {
        console.error('Failed to refresh user:', error);
      }
    }
  }, [logout]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
    if (user) {
      const updatedUser = { ...user, ...updates };
      setCurrentUser(updatedUser);
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user && !!getAuthToken(),
    login,
    register,
    loginAsGuest,
    logout,
    refreshUser,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access authentication context
 * 
 * @throws {Error} If used outside of AuthProvider
 * @returns {AuthContextType} Authentication state and methods
 * 
 * @example
 * ```tsx
 * const { user, loading, login, logout } = useAuth();
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
