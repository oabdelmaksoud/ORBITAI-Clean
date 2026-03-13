import { useState, useEffect } from 'react';

/**
 * Hook for managing admin authentication state
 * Extracted from App.tsx to centralize admin auth logic
 */
export const useAdminAuth = () => {
  const [adminToken, setAdminToken] = useState<string | null>(() => 
    localStorage.getItem('admin_token')
  );
  const [adminUser, setAdminUser] = useState<any>(null);

  // Update localStorage when token changes
  useEffect(() => {
    if (adminToken) {
      localStorage.setItem('admin_token', adminToken);
    } else {
      localStorage.removeItem('admin_token');
    }
  }, [adminToken]);

  const login = (token: string, adminUserData: any) => {
    setAdminToken(token);
    setAdminUser(adminUserData);
    localStorage.setItem('admin_token', token);
  };

  const logout = () => {
    setAdminToken(null);
    setAdminUser(null);
    localStorage.removeItem('admin_token');
  };

  return {
    adminToken,
    adminUser,
    login,
    logout,
    isAuthenticated: !!adminToken
  };
};






