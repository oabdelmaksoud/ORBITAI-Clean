import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../hooks/useNotifications';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn().mockReturnValue('test-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('useNotifications', () => {
  const mockNotifications = [
    {
      _id: '1',
      type: 'comment' as const,
      title: 'New Comment',
      message: 'John commented on your project',
      read: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: '2',
      type: 'mention' as const,
      title: 'You were mentioned',
      message: '@john mentioned you',
      read: true,
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ];

  // Helper: mock both auto-fetch calls (fetchNotifications + fetchUnreadCount on mount)
  function mockInitialFetch() {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notifications: mockNotifications, total: 2, unread: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 1 }),
      });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('fetchNotifications', () => {
    it('should fetch notifications on mount', async () => {
      mockInitialFetch();

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.notifications).toEqual(mockNotifications);
    });

    it('should handle fetch error', async () => {
      // Both auto-fetch calls fail
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockInitialFetch();

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(2);
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockNotifications[0], read: true }),
      });

      await act(async () => {
        await result.current.markAsRead('1');
      });

      const notification = result.current.notifications.find(n => n._id === '1');
      expect(notification?.read).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockInitialFetch();

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(2);
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ modified: 2 }),
      });

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.notifications.every(n => n.read)).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });
  });
});
