/**
 * useNotifications Hook
 * Manages notification state, filtering, and real-time updates
 */

import { useState, useCallback, useMemo } from 'react';

export interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  user: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  [key: string]: unknown;
}

interface NotificationFilter {
  type?: string;
}

interface FetchOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  filteredNotifications: Notification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  fetchNotifications: (options?: FetchOptions) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllRead: () => Promise<void>;
  getUnreadCount: () => Promise<void>;
  setFilter: (filter: NotificationFilter) => void;
  handleNewNotification: (notification: Notification) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>({});

  const filteredNotifications = useMemo(() => {
    if (!filter.type) return notifications;
    return notifications.filter(n => n.type === filter.type);
  }, [notifications, filter]);

  const fetchNotifications = useCallback(async (options?: FetchOptions) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options?.page) params.set('page', String(options.page));
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.unreadOnly) params.set('read', 'false');

      const queryString = params.toString();
      const url = `/api/notifications${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch notifications');
      }
      const data = await response.json();
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.read).length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to mark as read');
      }
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to mark all as read');
      }
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setError(null);
    try {
      const toDelete = notifications.find(n => n._id === id);
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete notification');
      }
      setNotifications(prev => prev.filter(n => n._id !== id));
      if (toDelete && !toDelete.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, [notifications]);

  const deleteAllRead = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete read notifications');
      }
      setNotifications(prev => prev.filter(n => !n.read));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const getUnreadCount = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to get unread count');
      }
      const data = await response.json();
      setUnreadCount(data.count);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  return {
    notifications,
    filteredNotifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    getUnreadCount,
    setFilter,
    handleNewNotification,
  };
}
