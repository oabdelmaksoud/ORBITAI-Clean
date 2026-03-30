import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTimeTracking } from '../hooks/useTimeTracking';

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

describe('useTimeTracking', () => {
  const mockEntries = [
    {
      _id: '1',
      user: 'user1',
      workspace: 'ws1',
      project: { _id: 'proj1', name: 'Project 1' },
      description: 'Working on frontend',
      startTime: '2026-01-01T09:00:00.000Z',
      endTime: '2026-01-01T10:30:00.000Z',
      duration: 5400,
      isBillable: true,
      isRunning: false,
      tags: [],
      createdAt: '2026-01-01T09:00:00.000Z',
    },
  ];

  // The hook auto-fetches active timer on mount, response is { activeTimer: ... }
  function mockActiveTimerFetch(activeTimer: any = null) {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ activeTimer }),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('fetchEntries', () => {
    it('should fetch time entries successfully', async () => {
      // Mock auto-fetch of active timer on mount
      mockActiveTimerFetch(null);

      const { result } = renderHook(() => useTimeTracking());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Now fetch entries - response is { entries: [...] }
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: mockEntries }),
      });

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.entries).toEqual(mockEntries);
    });

    it('should handle fetch error', async () => {
      mockActiveTimerFetch(null);

      const { result } = renderHook(() => useTimeTracking());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('startTimer', () => {
    it('should start timer successfully', async () => {
      mockActiveTimerFetch(null);

      const { result } = renderHook(() => useTimeTracking());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockTimer = {
        _id: '2',
        isRunning: true,
        startTime: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimer,
      });

      await act(async () => {
        await result.current.startTimer({
          workspace: 'ws1',
          project: 'proj1',
          description: 'Test task',
        });
      });

      expect(result.current.activeTimer).toEqual(mockTimer);
    });
  });

  describe('stopTimer', () => {
    it('should stop timer successfully', async () => {
      const activeTimer = { _id: '2', isRunning: true, startTime: new Date().toISOString() };
      mockActiveTimerFetch(activeTimer);

      const { result } = renderHook(() => useTimeTracking());

      await waitFor(() => {
        expect(result.current.activeTimer).toBeTruthy();
      });

      const stoppedTimer = { ...activeTimer, isRunning: false, endTime: new Date().toISOString(), duration: 3600 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => stoppedTimer,
      });

      await act(async () => {
        await result.current.stopTimer('2');
      });

      expect(result.current.activeTimer).toBeNull();
    });
  });
});
