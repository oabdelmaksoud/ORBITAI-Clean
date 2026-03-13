import { useState, useEffect, useCallback } from 'react';

interface TimeEntry {
  _id: string;
  user: string;
  workspace: string;
  project: {
    _id: string;
    name: string;
  };
  task?: {
    _id: string;
    title: string;
  };
  description?: string;
  startTime: string;
  endTime?: string;
  duration: number;
  isBillable: boolean;
  isRunning: boolean;
  tags: string[];
  createdAt: string;
}

interface StartTimerData {
  workspace: string;
  project: string;
  task?: string;
  description?: string;
  tags?: string[];
  isBillable?: boolean;
}

interface ManualEntryData {
  workspace: string;
  project: string;
  task?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  tags?: string[];
  isBillable?: boolean;
}

export const useTimeTracking = () => {
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time for active timer
  useEffect(() => {
    if (!activeTimer) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeTimer.startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      setElapsedTime(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  const fetchActiveTimer = useCallback(async () => {
    try {
      const response = await fetch('/api/time-tracking/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active timer');
      }

      const data = await response.json();
      setActiveTimer(data.activeTimer);
    } catch (err: any) {
      console.error('Failed to fetch active timer:', err);
    }
  }, []);

  const fetchEntries = useCallback(async (options?: {
    startDate?: string;
    endDate?: string;
    project?: string;
    workspace?: string;
    limit?: number;
    page?: number;
  }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (options?.startDate) params.append('startDate', options.startDate);
      if (options?.endDate) params.append('endDate', options.endDate);
      if (options?.project) params.append('project', options.project);
      if (options?.workspace) params.append('workspace', options.workspace);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.page) params.append('page', options.page.toString());

      const response = await fetch(`/api/time-tracking/entries?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch time entries');
      }

      const data = await response.json();
      setEntries(data.entries);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveTimer();
  }, [fetchActiveTimer]);

  const startTimer = async (data: StartTimerData): Promise<TimeEntry> => {
    const response = await fetch('/api/time-tracking/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start timer');
    }

    const newTimer = await response.json();
    setActiveTimer(newTimer);
    return newTimer;
  };

  const stopTimer = async (timerId: string): Promise<TimeEntry> => {
    const response = await fetch(`/api/time-tracking/stop/${timerId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stop timer');
    }

    const stoppedTimer = await response.json();
    setActiveTimer(null);
    setElapsedTime(0);
    setEntries(prev => [stoppedTimer, ...prev]);
    return stoppedTimer;
  };

  const createManualEntry = async (data: ManualEntryData): Promise<TimeEntry> => {
    const response = await fetch('/api/time-tracking/manual', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create manual entry');
    }

    const newEntry = await response.json();
    setEntries(prev => [newEntry, ...prev]);
    return newEntry;
  };

  const updateEntry = async (id: string, data: Partial<ManualEntryData>): Promise<TimeEntry> => {
    const response = await fetch(`/api/time-tracking/entries/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update entry');
    }

    const updatedEntry = await response.json();
    setEntries(prev =>
      prev.map(e => e._id === id ? updatedEntry : e)
    );
    return updatedEntry;
  };

  const deleteEntry = async (id: string): Promise<void> => {
    const response = await fetch(`/api/time-tracking/entries/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete entry');
    }

    setEntries(prev => prev.filter(e => e._id !== id));
  };

  const getSummary = async (startDate: string, endDate: string, project?: string) => {
    const params = new URLSearchParams({
      startDate,
      endDate
    });
    
    if (project) params.append('project', project);

    const response = await fetch(`/api/time-tracking/summary?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get summary');
    }

    return response.json();
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    activeTimer,
    entries,
    loading,
    error,
    elapsedTime,
    formattedTime: formatTime(elapsedTime),
    fetchActiveTimer,
    fetchEntries,
    startTimer,
    stopTimer,
    createManualEntry,
    updateEntry,
    deleteEntry,
    getSummary,
    formatTime
  };
};
