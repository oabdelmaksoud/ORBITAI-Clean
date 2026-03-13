/**
 * Admin API Service - Frontend service for admin portal
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: 'user' | 'admin' | 'superadmin';
  plan: 'Free' | 'Pro' | 'Enterprise';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminProject {
  id: string;
  name: string;
  description: string;
  userId: string;
  currentPhase: string;
  currentSprint: number;
  methodology: string;
  agentsCount: number;
  tasksCount: number;
  artifactsCount: number;
  useInternet: boolean;
  budget: {
    cap: number;
    spent: number;
  };
  createdAt: Date;
  lastModified: Date;
  isSample?: boolean;
}

export interface DashboardStats {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    activeProjects: number;
    usersByPlan: Record<string, number>;
    projectsByPhase: Record<string, number>;
    projectsByMethodology: Record<string, number>;
  };
  recentUsers: AdminUser[];
  recentProjects: AdminProject[];
}

// Helper function for authenticated admin API calls
// NOTE: This is a different implementation from src/services/api.ts apiRequest
// It has enhanced error handling for admin features, guest users, and connection errors
export async function adminApiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Bypass-Tunnel-Reminder': 'true', // Fix for localtunnel 511 error
        ...headers,
      },
    });

    // Read response as text first (can only read body once)
    const text = await response.text();

    // Check if response is HTML (common error case)
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
      throw new Error(`Server returned HTML instead of JSON. This usually means the endpoint doesn't exist or there's a server error. Response: ${text.substring(0, 200)}`);
    }

    // Check Content-Type to determine if we should parse as JSON
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType && contentType.includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        // If JSON parsing fails, check if it's HTML
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
          throw new Error(`Server returned HTML instead of JSON. This usually means the endpoint doesn't exist or there's a server error.`);
        }
        // If JSON parsing fails, use the text as error message
        if (!response.ok) {
          throw new Error(text || `Failed to parse JSON response: ${response.statusText}`);
        }
        // For successful responses that aren't valid JSON, return text
        return text as any;
      }
    } else {
      // Non-JSON response - check if it's HTML
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Expected JSON but got HTML. This usually means the endpoint doesn't exist or there's a server error.`);
      }
      // Non-JSON response
      if (!response.ok) {
        throw new Error(text || `API Error: ${response.statusText}`);
      }
      // For non-JSON successful responses, return the text
      return text as any;
    }

    if (!response.ok) {
      // Check if this is a 401 Unauthorized error for guest tokens (suppress logging)
      const isUnauthorized = response.status === 401;
      const isGuestToken = token && (token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3);

      if (isUnauthorized && isGuestToken) {
        // For guest users, 401 is expected - don't log as error
        // Return a rejected promise with a silent error that won't be logged
        const silentError = new Error('Unauthorized (guest user)');
        (silentError as any).isGuestError = true;
        (silentError as any).status = 401;
        throw silentError;
      }

      throw new Error(data.error?.message || data.message || text || `API Error: ${response.statusText}`);
    }

    return data;
  } catch (error: any) {
    // Check if this is a connection error (backend not running)
    const isConnectionError = error instanceof TypeError && error.message.includes('fetch') ||
      error.message === 'Failed to fetch' ||
      error.message.includes('NetworkError') ||
      error.message?.includes('ERR_CONNECTION_REFUSED');

    // Only log connection errors once per session to reduce noise
    if (isConnectionError) {
      if (!(window as any).__adminApiConnectionErrorLogged) {
        (window as any).__adminApiConnectionErrorLogged = true;
        if (import.meta.env.DEV) {
          console.debug(`[Admin API] Backend server not available at ${API_BASE_URL}`);
        }
      }
      throw new Error(`Cannot connect to backend server at ${API_BASE_URL}. Please ensure the server is running.`);
    }

    // Suppress logging for guest user 401 errors
    if (error.isGuestError) {
      // Silent error for guest users - don't log
      throw error;
    }

    // Log other errors normally
    if (import.meta.env.DEV) {
      console.error('Admin API Request Error:', error);
    }

    // Handle other fetch-related errors
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      throw new Error(`Network error: Cannot reach backend server at ${API_BASE_URL}. Please check if the server is running and accessible.`);
    }

    // Re-throw other errors as-is
    throw error;
  }
}

// Backwards-compatible alias - allows existing `import { apiRequest } from './adminApi'` to work
export const apiRequest = adminApiRequest;

// ============ AUTHENTICATION ============

export async function adminLogin(
  email: string,
  password: string
): Promise<{ token: string; user: AdminUser }> {
  const response = await apiRequest<{
    success: boolean;
    data: { token: string; user: AdminUser };
  }>('/api/admin-auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (!response.success) {
    throw new Error('Login failed');
  }

  return response.data;
}

export async function getAdminUser(token: string): Promise<AdminUser> {
  const response = await apiRequest<{
    success: boolean;
    data: { user: AdminUser };
  }>('/api/admin-auth/me', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch admin user');
  }

  return response.data.user;
}

// ============ DASHBOARD ============

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  const response = await apiRequest<{
    success: boolean;
    data: DashboardStats;
  }>('/api/admin/dashboard', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch dashboard stats');
  }

  return response.data;
}

// ============ USER MANAGEMENT ============

export interface UserListResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getUsers(
  token: string,
  options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    plan?: string;
    isActive?: boolean;
  }
): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.search) params.append('search', options.search);
  if (options?.role) params.append('role', options.role);
  if (options?.plan) params.append('plan', options.plan);
  if (options?.isActive !== undefined) params.append('isActive', options.isActive.toString());

  const queryString = params.toString();
  const endpoint = `/api/admin/users${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{
    success: boolean;
    data: UserListResponse;
  }>(endpoint, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch users');
  }

  return response.data;
}

export async function getUserDetails(
  token: string,
  userId: string
): Promise<{ user: AdminUser; projects: any[] }> {
  const response = await apiRequest<{
    success: boolean;
    data: { user: AdminUser; projects: any[] };
  }>(`/api/admin/users/${userId}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch user details');
  }

  return response.data;
}

export async function updateUser(
  token: string,
  userId: string,
  updates: Partial<{
    name: string;
    email: string;
    plan: string;
    role: string;
    isActive: boolean;
  }>
): Promise<{ user: AdminUser }> {
  const response = await apiRequest<{
    success: boolean;
    data: { user: AdminUser };
  }>(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update user');
  }

  return response.data;
}

export async function createUser(
  token: string,
  userData: {
    email: string;
    password: string;
    name: string;
    plan?: 'Free' | 'Pro' | 'Enterprise';
    role?: 'user' | 'admin' | 'superadmin' | 'editor';
  }
): Promise<AdminUser> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      user: AdminUser;
    };
  }>(`/api/admin/users`, {
    method: 'POST',
    body: JSON.stringify(userData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create user');
  }

  return response.data.user;
}

export async function deleteUser(token: string, userId: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete user');
  }
}

// ============ PROJECT MANAGEMENT ============

export interface ProjectListResponse {
  projects: AdminProject[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getProjects(
  token: string,
  options?: {
    page?: number;
    limit?: number;
    search?: string;
    phase?: string;
    methodology?: string;
    userId?: string;
  }
): Promise<ProjectListResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.search) params.append('search', options.search);
  if (options?.phase) params.append('phase', options.phase);
  if (options?.methodology) params.append('methodology', options.methodology);
  if (options?.userId) params.append('userId', options.userId);

  const queryString = params.toString();
  const endpoint = `/api/admin/projects${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{
    success: boolean;
    data: ProjectListResponse;
  }>(endpoint, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch projects');
  }

  return response.data;
}

export async function getProjectDetails(
  token: string,
  projectId: string
): Promise<any> {
  const response = await apiRequest<{
    success: boolean;
    data: { project: any };
  }>(`/api/admin/projects/${projectId}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch project details');
  }

  return response.data.project;
}

export async function updateProject(
  token: string,
  projectId: string,
  updates: Partial<{
    name: string;
    description: string;
    currentPhase: string;
    currentSprint: number;
    methodology: string;
    useInternet: boolean;
  }>
): Promise<any> {
  const response = await apiRequest<{
    success: boolean;
    data: { project: any };
  }>(`/api/admin/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update project');
  }

  return response.data.project;
}

export async function deleteProject(token: string, projectId: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/admin/projects/${projectId}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete project');
  }
}

export async function markProjectAsSample(token: string, projectId: string): Promise<AdminProject> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
    data: { project: AdminProject };
  }>(`/api/admin/projects/${projectId}/mark-as-sample`, {
    method: 'POST',
  }, token);

  if (!response.success) {
    throw new Error(response.message || 'Failed to mark project as sample');
  }

  return response.data.project;
}

export async function unmarkProjectAsSample(token: string, projectId: string): Promise<AdminProject> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
    data: { project: AdminProject };
  }>(`/api/admin/projects/${projectId}/unmark-as-sample`, {
    method: 'POST',
  }, token);

  if (!response.success) {
    throw new Error(response.message || 'Failed to unmark project as sample');
  }

  return response.data.project;
}

// ============ SYSTEM CONFIGURATION ============

export async function getSystemConfig(token: string): Promise<any> {
  const response = await apiRequest<{
    success: boolean;
    data: any;
  }>('/api/admin/system/config', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch system config');
  }

  return response.data;
}

export async function getSystemStats(token: string): Promise<any> {
  const response = await apiRequest<{
    success: boolean;
    data: any;
  }>('/api/admin/system/stats', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch system stats');
  }

  return response.data;
}

export interface EnvironmentVariable {
  value: string;
  editable: boolean;
  masked: boolean;
}

export interface EnvironmentVariablesResponse {
  variables: Record<string, EnvironmentVariable>;
  editable: string[];
}

/**
 * Get environment variables
 */
export async function getEnvironmentVariables(token: string): Promise<EnvironmentVariablesResponse> {
  const response = await apiRequest<{
    success: boolean;
    data: EnvironmentVariablesResponse;
  }>(`/api/admin/environment`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch environment variables');
  }

  return response.data;
}

/**
 * Update environment variables
 */
export async function updateEnvironmentVariables(
  token: string,
  updates: Record<string, string>
): Promise<{ updated: string[] }> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
    data: { updated: string[] };
  }>(`/api/admin/environment`, {
    method: 'PUT',
    body: JSON.stringify({ updates }),
  }, token);

  if (!response.success) {
    throw new Error(response.message || 'Failed to update environment variables');
  }

  return response.data;
}

export async function getComprehensiveSystemDetails(token: string): Promise<any> {
  const response = await apiRequest<{
    success: boolean;
    data: any;
  }>('/api/admin/system/details', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch comprehensive system details');
  }

  return response.data;
}

// ============ PACKAGE MANAGEMENT ============

export interface Package {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  features: Array<{
    key: string;
    label: string;
    value: string | number | boolean;
    type: 'string' | 'number' | 'boolean';
  }>;
  limits: {
    maxProjects: number;
    maxAgents: number;
    maxTasks: number;
    maxStorageGB: number;
    maxAPICalls: number;
  };
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  metadata?: {
    color?: string;
    icon?: string;
    highlight?: boolean;
  };
}

export async function getPackages(token: string): Promise<Package[]> {
  const response = await apiRequest<{
    success: boolean;
    data: { packages: Package[] };
  }>('/api/admin/packages', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch packages');
  }

  return response.data.packages;
}

export async function getPackage(token: string, packageId: string): Promise<Package> {
  const response = await apiRequest<{
    success: boolean;
    data: { package: Package };
  }>(`/api/admin/packages/${packageId}`, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch package');
  }

  return response.data.package;
}

export async function createPackage(token: string, packageData: Partial<Package>): Promise<Package> {
  const response = await apiRequest<{
    success: boolean;
    data: { package: Package };
  }>('/api/admin/packages', {
    method: 'POST',
    body: JSON.stringify(packageData),
  }, token);

  if (!response.success) {
    throw new Error('Failed to create package');
  }

  return response.data.package;
}

export async function updatePackage(token: string, packageId: string, updates: Partial<Package>): Promise<Package> {
  const response = await apiRequest<{
    success: boolean;
    data: { package: Package };
  }>(`/api/admin/packages/${packageId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, token);

  if (!response.success) {
    throw new Error('Failed to update package');
  }

  return response.data.package;
}

export async function deletePackage(token: string, packageId: string): Promise<void> {
  const response = await apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/admin/packages/${packageId}`, {
    method: 'DELETE',
  }, token);

  if (!response.success) {
    throw new Error('Failed to delete package');
  }
}

// ============ AUDIT LOGS ============

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: Date;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getAuditLogs(
  token: string,
  options?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.action) params.append('action', options.action);
  if (options?.entityType) params.append('entityType', options.entityType);
  if (options?.userId) params.append('userId', options.userId);
  if (options?.status) params.append('status', options.status);
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);

  const queryString = params.toString();
  const endpoint = `/api/admin/audit${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{
    success: boolean;
    data: AuditLogListResponse;
  }>(endpoint, {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch audit logs');
  }

  return response.data;
}

export async function getAuditLogStats(token: string): Promise<any> {
  const response = await apiRequest<{
    success: boolean;
    data: any;
  }>('/api/admin/audit/stats/summary', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch audit log stats');
  }

  return response.data;
}

// ============ EXPORT ============

export async function exportUsers(
  token: string,
  format: 'csv' | 'json' = 'csv',
  filters?: {
    role?: string;
    plan?: string;
    isActive?: boolean;
  }
): Promise<Blob> {
  const params = new URLSearchParams();
  params.append('format', format);
  if (filters?.role) params.append('role', filters.role);
  if (filters?.plan) params.append('plan', filters.plan);
  if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());

  const response = await fetch(`${API_BASE_URL}/api/admin/export/users?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export users');
  }

  return await response.blob();
}

export async function exportProjects(
  token: string,
  format: 'csv' | 'json' = 'csv',
  filters?: {
    phase?: string;
    methodology?: string;
    userId?: string;
  }
): Promise<Blob> {
  const params = new URLSearchParams();
  params.append('format', format);
  if (filters?.phase) params.append('phase', filters.phase);
  if (filters?.methodology) params.append('methodology', filters.methodology);
  if (filters?.userId) params.append('userId', filters.userId);

  const response = await fetch(`${API_BASE_URL}/api/admin/export/projects?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export projects');
  }

  return await response.blob();
}

// ============ BULK ACTIONS ============

export async function bulkUserAction(
  token: string,
  action: 'activate' | 'deactivate' | 'delete' | 'changePlan',
  userIds: string[],
  options?: { plan?: string }
): Promise<{ affected: number; total: number }> {
  const response = await apiRequest<{
    success: boolean;
    data: { affected: number; total: number };
  }>('/api/admin/bulk/users', {
    method: 'POST',
    body: JSON.stringify({
      action,
      userIds,
      ...options
    }),
  }, token);

  if (!response.success) {
    throw new Error(`Failed to ${action} users`);
  }

  return response.data;
}

export async function bulkProjectAction(
  token: string,
  action: 'delete' | 'archive',
  projectIds: string[]
): Promise<{ affected: number; total: number }> {
  const response = await apiRequest<{
    success: boolean;
    data: { affected: number; total: number };
  }>('/api/admin/bulk/projects', {
    method: 'POST',
    body: JSON.stringify({
      action,
      projectIds
    }),
  }, token);

  if (!response.success) {
    throw new Error(`Failed to ${action} projects`);
  }

  return response.data;
}

// ============ FINANCIAL DASHBOARD ============

export interface FinancialDashboard {
  revenue: {
    totalMRR: number;
    annualRunRate: number;
    byPlan: Record<string, {
      users: number;
      price: number;
      mrr: number;
    }>;
  };
  users: {
    byPlan: Record<string, {
      total: number;
      active: number;
      inactive: number;
    }>;
  };
  growth: {
    last30Days: number;
    previous30Days: number;
    growthRate: number;
  };
  signups: Array<{
    date: string;
    count: number;
    plans: string[];
  }>;
}

export async function getFinancialDashboard(token: string): Promise<FinancialDashboard> {
  const response = await apiRequest<{
    success: boolean;
    data: FinancialDashboard;
  }>('/api/admin/financial/dashboard', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch financial dashboard');
  }

  return response.data;
}

// ============ ANALYTICS ============

export interface AnalyticsOverview {
  users: {
    total: number;
    last30Days: number;
    last7Days: number;
    today: number;
    active7d: number;
  };
  projects: {
    total: number;
    active: number;
    last30Days: number;
    last7Days: number;
  };
  breakdown: {
    projectsByPhase: Record<string, number>;
    usersByPlan: Record<string, number>;
  };
  trends: {
    dailySignups: Array<{ date: string; count: number }>;
    dailyProjects: Array<{ date: string; count: number }>;
  };
}

export async function getAnalyticsOverview(token: string): Promise<AnalyticsOverview> {
  const response = await apiRequest<{
    success: boolean;
    data: AnalyticsOverview;
  }>('/api/admin/analytics/overview', {
    method: 'GET',
  }, token);

  if (!response.success) {
    throw new Error('Failed to fetch analytics overview');
  }

  return response.data;
}

