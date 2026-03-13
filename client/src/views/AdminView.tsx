/**
 * Admin View Component
 * Extracted from App.tsx - Admin portal view
 */

import React from 'react';
import AdminLogin from '../components/AdminLogin';
import AdminDashboard from '../components/AdminDashboard';

interface AdminViewProps {
  adminToken: string | null;
  onLoginSuccess: (token: string, adminUser: any) => void;
  onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  adminToken,
  onLoginSuccess,
  onLogout,
}) => {
  if (!adminToken) {
    return <AdminLogin onLoginSuccess={onLoginSuccess} />;
  }

  return <AdminDashboard onExit={onLogout} token={adminToken} />;
};


