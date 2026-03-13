/**
 * Share Links API Service
 * Database-only share links management
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('authToken');
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
  }
  return null;
}

export interface ShareLink {
  token: string;
  url: string;
  createdAt: string;
  expiresAt?: string;
  accessCount: number;
  isExpired: boolean;
}

/**
 * Get all share links for a project
 */
export async function getShareLinks(projectId: string): Promise<ShareLink[]> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/share`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch share links' }));
    throw new Error(error.message || 'Failed to fetch share links');
  }

  const result = await response.json();
  return result.data?.shareLinks || [];
}

/**
 * Create a share link for a project
 */
export async function createShareLink(projectId: string, expiresInDays?: number): Promise<ShareLink> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/share`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresInDays })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create share link' }));
    throw new Error(error.message || 'Failed to create share link');
  }

  const result = await response.json();
  return result.data?.shareLink;
}

/**
 * Delete a share link
 */
export async function deleteShareLink(projectId: string, token: string): Promise<void> {
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/share/${token}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete share link' }));
    throw new Error(error.message || 'Failed to delete share link');
  }
}

/**
 * Get a project by share token (public endpoint)
 */
export async function getProjectByShareToken(token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/projects/share/${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Share link not found or invalid' }));
    throw new Error(error.message || 'Share link not found or invalid');
  }

  const result = await response.json();
  return result.data?.project;
}

export const shareLinksApi = {
  getShareLinks,
  createShareLink,
  deleteShareLink,
  getProjectByShareToken
};












