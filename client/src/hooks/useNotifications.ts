import { useState, useEffect, useCallback } from 'react';

interface Notification {
  _id: string;
  type: 'mention' | 'comment' | 'reply' | 'assignment' | 'project_share' | 'workspace_invite';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    workspace?: { name: string; slug: string };
    project?: { name: string };
    actor?: { name: string; avatar: string };
    resourceType?: string;
    resourceId?: string;
  };
}

interface NotificationsOptions {
  read?: boolean;
  type?: Notification['type'];
  limit?: number;
  page?: number;
}

export const useNotifications = (options?: NotificationsOptions) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (fetchOptions?: NotificationsOptions) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      const mergedOptions = { ...options, ...fetchOptions };
      
      if (mergedOptions.read !== undefined) {
        params.append('read', mergedOptions.read.toString());
      }
      if (mergedOptions.type) {
        params.append('type', mergedOptions.type);
      }
      if (mergedOptions.limit) {
        params.append('limit', mergedOptions.limit.toString());
      }
      if (mergedOptions.page) {
        params.append('page', mergedOptions.page.toString());
      }

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications);
      setTotalCount(data.totalCount);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      setUnreadCount(data.count);
    } catch (err: any) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  const markAsRead = async (notificationId: string): Promise<void> => {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to mark as read');
    }

    setNotifications(prev =>
      prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async (): Promise<void> => {
    const response = await fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to mark all as read');
    }

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (notificationId: string): Promise<void> => {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete notification');
    }

    setNotifications(prev => prev.filter(n => n._id !== notificationId));
    setTotalCount(prev => prev - 1);
  };

  const deleteAllRead = async (): Promise<void> => {
    const response = await fetch('/api/notifications', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete notifications');
    }

    setNotifications(prev => prev.filter(n => !n.read));
    await fetchNotifications();
  };

  // WebSocket integration for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // TODO: Connect to WebSocket server
    // const ws = new WebSocket(`wss://api.example.com/notifications?token=${token}`);
    
    // ws.onmessage = (event) => {
    //   const notification = JSON.parse(event.data);
    //   setNotifications(prev => [notification, ...prev]);
    //   setUnreadCount(prev => prev + 1);
    // };

    // return () => ws.close();
  }, []);

  return {
    notifications,
    totalCount,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead
  };
};
