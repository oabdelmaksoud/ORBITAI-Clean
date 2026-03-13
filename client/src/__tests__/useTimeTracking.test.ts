import { renderHook, act, waitFor } from '@testing-library/react';
import { useTimeTracking } from '../useTimeTracking';

// Mock fetch
global.fetch = jest.fn();

describe('useTimeTracking', () => {
  const mockTimeEntries = [
    {
      _id: '1',
      user: 'user1',
      project: 'project1',
      description: 'Working on frontend',
      startTime: '2026-01-01T09:00:00.000Z',
      endTime: '2026-01-01T10:30:00.000Z',
      duration: 5400, // 1.5 hours in seconds
      billable: true,
      isRunning: false,
      createdAt: '2026-01-01T09:00:00.000Z'
    },
    {
      _id: '2',
      user: 'user1',
      project: 'project2',
      description: 'Backend API development',
      startTime: '2026-01-02T14:00:00.000Z',
      endTime: '2026-01-02T18:00:00.000Z',
      duration: 14400, // 4 hours in seconds
      billable: true,
      isRunning: false,
      createdAt: '2026-01-02T14:00:00.000Z'
    }
  ];

  const mockActiveTimer = {
    _id: '3',
    user: 'user1',
    project: 'project1',
    description: 'Current task',
    startTime: new Date(Date.now() - 3600000).toISOString(), // Started 1 hour ago
    endTime: null,
    duration: null,
    billable: true,
    isRunning: true,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('fetchEntries', () => {
    it('should fetch time entries successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeEntries
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.entries).toEqual(mockTimeEntries);
      expect(result.current.loading).toBe(false);
    });

    it('should fetch entries with date range', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeEntries
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.fetchEntries({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2026-01-01'),
        expect.any(Object)
      );
    });

    it('should fetch entries by project', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeEntries
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.fetchEntries({ projectId: 'project1' });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('project=project1'),
        expect.any(Object)
      );
    });
  });

  describe('startTimer', () => {
    it('should start timer successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActiveTimer
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task',
          billable: true
        });
      });

      expect(result.current.activeTimer).toEqual(mockActiveTimer);
      expect(result.current.isTimerRunning).toBe(true);
    });

    it('should not start timer if one is already running', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockActiveTimer
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockActiveTimer
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'First task'
        });
      });

      // Try to start another timer
      await act(async () => {
        try {
          await result.current.startTimer({
            projectId: 'project2',
            description: 'Second task'
          });
        } catch (error: any) {
          expect(error.message).toContain('already running');
        }
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should update duration in real-time', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActiveTimer
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task'
        });
      });

      // Advance time by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Duration should update
      expect(result.current.currentDuration).toBeGreaterThan(0);
    });
  });

  describe('stopTimer', () => {
    it('should stop timer successfully', async () => {
      const stoppedTimer = {
        ...mockActiveTimer,
        endTime: new Date().toISOString(),
        duration: 3600,
        isRunning: false
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockActiveTimer
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => stoppedTimer
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task'
        });
      });

      await act(async () => {
        await result.current.stopTimer('3');
      });

      expect(result.current.activeTimer).toBeNull();
      expect(result.current.isTimerRunning).toBe(false);
      expect(result.current.entries).toHaveLength(1);
    });

    it('should clear timer interval on stop', async () => {
      const stoppedTimer = {
        ...mockActiveTimer,
        endTime: new Date().toISOString(),
        duration: 3600,
        isRunning: false
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockActiveTimer
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => stoppedTimer
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task'
        });
      });

      await act(async () => {
        await result.current.stopTimer('3');
      });

      const durationBefore = result.current.currentDuration;

      // Advance time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Duration should not change after stopping
      expect(result.current.currentDuration).toBe(durationBefore);
    });
  });

  describe('pauseTimer', () => {
    it('should pause timer', async () => {
      const pausedTimer = {
        ...mockActiveTimer,
        isPaused: true,
        pausedAt: new Date().toISOString()
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockActiveTimer
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pausedTimer
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task'
        });
      });

      await act(async () => {
        await result.current.pauseTimer('3');
      });

      expect(result.current.isTimerPaused).toBe(true);
    });

    it('should not update duration while paused', async () => {
      const pausedTimer = {
        ...mockActiveTimer,
        isPaused: true,
        pausedAt: new Date().toISOString()
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockActiveTimer
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pausedTimer
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task'
        });
      });

      await act(async () => {
        await result.current.pauseTimer('3');
      });

      const durationWhenPaused = result.current.currentDuration;

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.currentDuration).toBe(durationWhenPaused);
    });
  });

  describe('resumeTimer', () => {
    it('should resume paused timer', async () => {
      const pausedTimer = {
        ...mockActiveTimer,
        isPaused: true,
        pausedAt: new Date().toISOString()
      };

      const resumedTimer = {
        ...mockActiveTimer,
        isPaused: false,
        pausedAt: null
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pausedTimer
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resumedTimer
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task'
        });
      });

      await act(async () => {
        await result.current.pauseTimer('3');
      });

      await act(async () => {
        await result.current.resumeTimer('3');
      });

      expect(result.current.isTimerPaused).toBe(false);
      expect(result.current.isTimerRunning).toBe(true);
    });
  });

  describe('createManualEntry', () => {
    it('should create manual time entry', async () => {
      const manualEntry = {
        _id: '4',
        user: 'user1',
        project: 'project1',
        description: 'Manual entry',
        startTime: '2026-01-03T09:00:00.000Z',
        endTime: '2026-01-03T10:00:00.000Z',
        duration: 3600,
        billable: true,
        isRunning: false,
        createdAt: '2026-01-03T09:00:00.000Z'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => manualEntry
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.createManualEntry({
          projectId: 'project1',
          description: 'Manual entry',
          startTime: '2026-01-03T09:00:00.000Z',
          endTime: '2026-01-03T10:00:00.000Z',
          billable: true
        });
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].description).toBe('Manual entry');
    });

    it('should validate end time is after start time', async () => {
      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        try {
          await result.current.createManualEntry({
            projectId: 'project1',
            description: 'Invalid entry',
            startTime: '2026-01-03T10:00:00.000Z',
            endTime: '2026-01-03T09:00:00.000Z',
            billable: true
          });
        } catch (error: any) {
          expect(error.message).toContain('End time must be after start time');
        }
      });
    });
  });

  describe('updateEntry', () => {
    it('should update time entry', async () => {
      const updatedEntry = {
        ...mockTimeEntries[0],
        description: 'Updated description'
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTimeEntries
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedEntry
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.fetchEntries();
      });

      await act(async () => {
        await result.current.updateEntry('1', { description: 'Updated description' });
      });

      const entry = result.current.entries.find(e => e._id === '1');
      expect(entry?.description).toBe('Updated description');
    });
  });

  describe('deleteEntry', () => {
    it('should delete time entry', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTimeEntries
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.fetchEntries();
      });

      await act(async () => {
        await result.current.deleteEntry('1');
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries.find(e => e._id === '1')).toBeUndefined();
    });
  });

  describe('getSummary', () => {
    it('should fetch time summary', async () => {
      const summary = {
        totalTime: 19800, // 5.5 hours
        billableTime: 19800,
        nonBillableTime: 0,
        projects: [
          { projectId: 'project1', totalTime: 5400 },
          { projectId: 'project2', totalTime: 14400 }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => summary
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.getSummary({
          startDate: '2026-01-01',
          endDate: '2026-01-31'
        });
      });

      expect(result.current.summary).toEqual(summary);
    });
  });

  describe('formatDuration', () => {
    it('should format duration in HH:MM:SS', () => {
      const { result } = renderHook(() => useTimeTracking());

      const formatted = result.current.formatDuration(3661); // 1h 1m 1s

      expect(formatted).toBe('01:01:01');
    });

    it('should handle zero duration', () => {
      const { result } = renderHook(() => useTimeTracking());

      const formatted = result.current.formatDuration(0);

      expect(formatted).toBe('00:00:00');
    });

    it('should handle large durations', () => {
      const { result } = renderHook(() => useTimeTracking());

      const formatted = result.current.formatDuration(100000); // 27h 46m 40s

      expect(formatted).toBe('27:46:40');
    });
  });

  describe('error handling', () => {
    it('should handle fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.entries).toEqual([]);
    });

    it('should handle unauthorized error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' })
      });

      const { result } = renderHook(() => useTimeTracking());

      await act(async () => {
        await result.current.fetchEntries();
      });

      expect(result.current.error).toContain('Unauthorized');
    });
  });

  describe('cleanup', () => {
    it('should cleanup interval on unmount', () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockActiveTimer
      });

      const { result, unmount } = renderHook(() => useTimeTracking());

      act(async () => {
        await result.current.startTimer({
          projectId: 'project1',
          description: 'Test task'
        });
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
