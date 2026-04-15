import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../useNotifications';

// Mock fetch
global.fetch = jest.fn();

describe('useNotifications', () => {
  const mockNotifications = [
    {
      _id: '1',
      type: 'comment',
      title: 'New Comment',
      message: 'John commented on your project',
      read: false,
      user: 'user1',
      resourceType: 'project',
      resourceId: 'project1',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      _id: '2',
      type: 'mention',
      title: 'You were mentioned',
      message: '@john mentioned you in a comment',
      read: true,
      user: 'user1',
      resourceType: 'comment',
      resourceId: 'comment1',
      createdAt: '2026-01-02T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchNotifications', () => {
    it('should fetch notifications successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      expect(result.current.notifications).toEqual(mockNotifications);
      expect(result.current.loading).toBe(false);
    });

    it('should handle fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      expect(result.current.error).toBe('Failed to fetch');
      expect(result.current.notifications).toEqual([]);
    });

    it('should fetch with pagination params', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications({ page: 2, limit: 10 });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });

    it('should filter unread notifications', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications({ unreadOnly: true });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('read=false'),
        expect.any(Object)
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockNotifications[0], read: true })
        });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      await act(async () => {
        await result.current.markAsRead('1');
      });

      const notification = result.current.notifications.find(n => n._id === '1');
      expect(notification?.read).toBe(true);
    });

    it('should update unread count after marking as read', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockNotifications[0], read: true })
        });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      const initialUnreadCount = result.current.unreadCount;

      await act(async () => {
        await result.current.markAsRead('1');
      });

      expect(result.current.unreadCount).toBe(initialUnreadCount - 1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ modified: 2 })
        });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.notifications.every(n => n.read)).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      await act(async () => {
        await result.current.deleteNotification('1');
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications.find(n => n._id === '1')).toBeUndefined();
    });

    it('should update unread count if deleted notification was unread', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      const initialUnreadCount = result.current.unreadCount;

      await act(async () => {
        await result.current.deleteNotification('1'); // This one is unread
      });

      expect(result.current.unreadCount).toBe(initialUnreadCount - 1);
    });
  });

  describe('deleteAllRead', () => {
    it('should delete all read notifications', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNotifications
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ deleted: 1 })
        });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      await act(async () => {
        await result.current.deleteAllRead();
      });

      expect(result.current.notifications.every(n => !n.read)).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('should fetch unread count', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 5 })
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.getUnreadCount();
      });

      expect(result.current.unreadCount).toBe(5);
    });
  });

  describe('filterByType', () => {
    it('should filter notifications by type', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      act(() => {
        result.current.setFilter({ type: 'comment' });
      });

      expect(result.current.filteredNotifications.every(n => n.type === 'comment')).toBe(true);
    });
  });

  describe('real-time updates', () => {
    it('should handle new notification via WebSocket', async () => {
      const newNotification = {
        _id: '3',
        type: 'task',
        title: 'New Task Assigned',
        message: 'You have a new task',
        read: false,
        user: 'user1',
        resourceType: 'task',
        resourceId: 'task1',
        createdAt: new Date().toISOString()
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      act(() => {
        result.current.handleNewNotification(newNotification);
      });

      expect(result.current.notifications).toHaveLength(3);
      expect(result.current.notifications[0]).toEqual(newNotification);
      expect(result.current.unreadCount).toBe(2); // 1 original + 1 new
    });
  });

  describe('error handling', () => {
    it('should handle unauthorized error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' })
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      expect(result.current.error).toContain('Unauthorized');
    });

    it('should handle network error gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      expect(result.current.notifications).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });
  });
});
