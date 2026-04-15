/**
 * useTimeTracking Hook
 * Manages time tracking with timer, manual entries, and summaries
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface TimeEntry {
  _id: string;
  user: string;
  project: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  isRunning: boolean;
  isPaused?: boolean;
  pausedAt?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

interface TimeSummary {
  totalTime: number;
  billableTime: number;
  nonBillableTime: number;
  projects: Array<{ projectId: string; totalTime: number }>;
}

interface FetchOptions {
  startDate?: string;
  endDate?: string;
  projectId?: string;
}

interface StartTimerInput {
  projectId: string;
  description?: string;
  billable?: boolean;
}

interface ManualEntryInput {
  projectId: string;
  description: string;
  startTime: string;
  endTime: string;
  billable: boolean;
}

interface UseTimeTrackingReturn {
  entries: TimeEntry[];
  activeTimer: TimeEntry | null;
  isTimerRunning: boolean;
  isTimerPaused: boolean;
  currentDuration: number;
  loading: boolean;
  error: string | null;
  summary: TimeSummary | null;
  fetchEntries: (options?: FetchOptions) => Promise<void>;
  startTimer: (input: StartTimerInput) => Promise<void>;
  stopTimer: (id: string) => Promise<void>;
  pauseTimer: (id: string) => Promise<void>;
  resumeTimer: (id: string) => Promise<void>;
  createManualEntry: (input: ManualEntryInput) => Promise<void>;
  updateEntry: (id: string, data: Partial<TimeEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getSummary: (options: { startDate: string; endDate: string }) => Promise<void>;
  formatDuration: (seconds: number) => string;
}

export function useTimeTracking(): UseTimeTrackingReturn {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTimerRunning = activeTimer !== null && activeTimer.isRunning && !activeTimer.isPaused;
  const isTimerPaused = activeTimer?.isPaused === true;

  // Update duration every second when timer is running
  useEffect(() => {
    if (isTimerRunning && activeTimer) {
      intervalRef.current = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime();
        const now = Date.now();
        setCurrentDuration(Math.floor((now - start) / 1000));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTimerRunning, activeTimer]);

  const fetchEntries = useCallback(async (options?: FetchOptions) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options?.startDate) params.set('startDate', options.startDate);
      if (options?.endDate) params.set('endDate', options.endDate);
      if (options?.projectId) params.set('project', options.projectId);

      const queryString = params.toString();
      const url = `/api/time-entries${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch entries');
      }
      const data = await response.json();
      setEntries(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const startTimer = useCallback(async (input: StartTimerInput) => {
    if (activeTimer) {
      throw new Error('A timer is already running');
    }
    setError(null);
    try {
      const response = await fetch('/api/time-entries/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start timer');
      }
      const timer = await response.json();
      setActiveTimer(timer);
      const start = new Date(timer.startTime).getTime();
      setCurrentDuration(Math.floor((Date.now() - start) / 1000));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    }
  }, [activeTimer]);

  const stopTimer = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/time-entries/${id}/stop`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to stop timer');
      }
      const stoppedEntry = await response.json();
      setActiveTimer(null);
      setCurrentDuration(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setEntries(prev => [...prev, stoppedEntry]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const pauseTimer = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/time-entries/${id}/pause`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to pause timer');
      }
      const paused = await response.json();
      setActiveTimer(paused);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const resumeTimer = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/time-entries/${id}/resume`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to resume timer');
      }
      const resumed = await response.json();
      setActiveTimer(resumed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const createManualEntry = useCallback(async (input: ManualEntryInput) => {
    const startMs = new Date(input.startTime).getTime();
    const endMs = new Date(input.endTime).getTime();
    if (endMs <= startMs) {
      throw new Error('End time must be after start time');
    }

    setError(null);
    try {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create entry');
      }
      const entry = await response.json();
      setEntries(prev => [...prev, entry]);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'End time must be after start time') {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const updateEntry = useCallback(async (id: string, data: Partial<TimeEntry>) => {
    setError(null);
    try {
      const response = await fetch(`/api/time-entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to update entry');
      }
      const updated = await response.json();
      setEntries(prev =>
        prev.map(e => (e._id === id ? { ...e, ...updated } : e))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/time-entries/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to delete entry');
      }
      setEntries(prev => prev.filter(e => e._id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const getSummary = useCallback(async (options: { startDate: string; endDate: string }) => {
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: options.startDate,
        endDate: options.endDate,
      });
      const response = await fetch(`/api/time-entries/summary?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to get summary');
      }
      const data = await response.json();
      setSummary(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs]
      .map(v => String(v).padStart(2, '0'))
      .join(':');
  }, []);

  return {
    entries,
    activeTimer,
    isTimerRunning,
    isTimerPaused,
    currentDuration,
    loading,
    error,
    summary,
    fetchEntries,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    createManualEntry,
    updateEntry,
    deleteEntry,
    getSummary,
    formatDuration,
  };
}
