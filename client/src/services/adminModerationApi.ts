/**
 * Admin Moderation API Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
    throw new Error(data.error || `API Error: ${response.statusText}`);
  }

  return data;
}

export interface ModerationItem {
  _id: string;
  entityType: 'project' | 'artifact' | 'user' | 'comment' | 'template';
  entityId: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  flaggedBy?: string;
  flaggedReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  autoFlagged: boolean;
  flags: Array<{
    type: string;
    reason: string;
    flaggedAt: Date;
    flaggedBy?: string;
  }>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationStats {
  totals: {
    pending: number;
    approved: number;
    rejected: number;
    flagged: number;
    total: number;
  };
  byType: Array<{
    _id: string;
    pending: number;
    approved: number;
    rejected: number;
    flagged: number;
  }>;
}

export async function getPendingModeration(
  token: string,
  options?: {
    page?: number;
    limit?: number;
    entityType?: string;
    status?: string;
  }
): Promise<{
  items: ModerationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.entityType) params.append('entityType', options.entityType);
  if (options?.status) params.append('status', options.status);

  const response = await apiRequest<{
    success: boolean;
    data: {
      items: ModerationItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  }>(`/api/admin/moderation/pending?${params.toString()}`, { method: 'GET' }, token);
  return response.data;
}

export async function approveContent(token: string, id: string): Promise<ModerationItem> {
  const response = await apiRequest<{ success: boolean; data: ModerationItem }>(
    `/api/admin/moderation/approve/${id}`,
    { method: 'POST' },
    token
  );
  return response.data;
}

export async function rejectContent(
  token: string,
  id: string,
  reason: string
): Promise<ModerationItem> {
  const response = await apiRequest<{ success: boolean; data: ModerationItem }>(
    `/api/admin/moderation/reject/${id}`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
    token
  );
  return response.data;
}

export async function flagContent(
  token: string,
  options: {
    entityType: string;
    entityId: string;
    reason: string;
    flagType?: string;
  }
): Promise<ModerationItem> {
  const response = await apiRequest<{ success: boolean; data: ModerationItem }>(
    '/api/admin/moderation/flag',
    {
      method: 'POST',
      body: JSON.stringify(options),
    },
    token
  );
  return response.data;
}

export async function getProjectsNeedingModeration(
  token: string,
  options?: { page?: number; limit?: number }
): Promise<{
  projects: Array<{
    id: string;
    name: string;
    description: string;
    userId: string;
    moderationStatus?: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const response = await apiRequest<{
    success: boolean;
    data: {
      projects: Array<{
        id: string;
        name: string;
        description: string;
        userId: string;
        moderationStatus?: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
      };
    };
  }>(`/api/admin/moderation/projects?${params.toString()}`, { method: 'GET' }, token);
  return response.data;
}

export async function bulkModerationAction(
  token: string,
  options: {
    action: 'approve' | 'reject';
    itemIds: string[];
    reason?: string;
  }
): Promise<{ count: number }> {
  const response = await apiRequest<{ success: boolean; data: { count: number } }>(
    '/api/admin/moderation/bulk-action',
    {
      method: 'POST',
      body: JSON.stringify(options),
    },
    token
  );
  return response.data;
}

export async function getModerationStats(token: string): Promise<ModerationStats> {
  const response = await apiRequest<{ success: boolean; data: ModerationStats }>(
    '/api/admin/moderation/stats',
    { method: 'GET' },
    token
  );
  return response.data;
}




