/**
 * Notifications API Service for Admin Console
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'system' | 'user' | 'project' | 'financial' | 'security';
  isRead: boolean;
  link?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
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
 * Get notifications for the current admin
 */
export async function getNotifications(
  token: string,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.unreadOnly) params.append('unreadOnly', 'true');

  const response = await apiRequest<{
    success: boolean;
    data: NotificationsResponse;
  }>(`/api/admin/notifications?${params.toString()}`, {
    method: 'GET',
  }, token);

  return response.data;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(token: string): Promise<number> {
  const response = await apiRequest<{
    success: boolean;
    data: { count: number };
  }>(`/api/admin/notifications/unread-count`, {
    method: 'GET',
  }, token);

  return response.data.count;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(token: string, notificationId: string): Promise<void> {
  await apiRequest(`/api/admin/notifications/${notificationId}/read`, {
    method: 'PUT',
  }, token);
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(token: string): Promise<void> {
  await apiRequest(`/api/admin/notifications/read-all`, {
    method: 'PUT',
  }, token);
}

/**
 * Delete a notification
 */
export async function deleteNotification(token: string, notificationId: string): Promise<void> {
  await apiRequest(`/api/admin/notifications/${notificationId}`, {
    method: 'DELETE',
  }, token);
}
















