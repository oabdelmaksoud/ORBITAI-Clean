/**
 * Database Backup API Service for Admin Console
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface DatabaseBackup {
  id: string;
  filename: string;
  fileSize: number;
  backupType: 'manual' | 'scheduled' | 'automated';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  collections: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  verified: boolean;
  verifiedAt?: string;
  createdBy?: string;
  retentionDays: number;
  expiresAt: string;
  createdAt: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `API Error: ${response.statusText}`);
  }

  return data;
}

/**
 * Get all backups
 */
export async function getBackups(token: string, status?: string): Promise<DatabaseBackup[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);

  const response = await apiRequest<{
    success: boolean;
    data: {
      backups: DatabaseBackup[];
    };
  }>(`/api/admin/backups?${params.toString()}`, {
    method: 'GET',
  }, token);

  return response.data.backups;
}

/**
 * Create a manual backup
 */
export async function createBackup(
  token: string,
  options?: {
    collections?: string[];
    retentionDays?: number;
  }
): Promise<DatabaseBackup> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      backup: DatabaseBackup;
    };
    message: string;
  }>(`/api/admin/backups`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  }, token);

  return response.data.backup;
}

/**
 * Verify a backup
 */
export async function verifyBackup(token: string, backupId: string): Promise<{ verified: boolean; message: string }> {
  const response = await apiRequest<{
    success: boolean;
    data: {
      verified: boolean;
      message: string;
    };
  }>(`/api/admin/backups/${backupId}/verify`, {
    method: 'POST',
  }, token);

  return response.data;
}

/**
 * Restore from backup
 */
export async function restoreBackup(
  token: string,
  backupId: string,
  options?: { clearExisting?: boolean }
): Promise<void> {
  await apiRequest(`/api/admin/backups/${backupId}/restore`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  }, token);
}

/**
 * Delete a backup
 */
export async function deleteBackup(token: string, backupId: string): Promise<void> {
  await apiRequest(`/api/admin/backups/${backupId}`, {
    method: 'DELETE',
  }, token);
}
















