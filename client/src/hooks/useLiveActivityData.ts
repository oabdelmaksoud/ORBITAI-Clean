/**
 * Custom hook for aggregating live LLM usage and user activity data
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getLiveUsage, LiveUsage } from '../services/llmUsageApi';
import { getActivityEvents, ActivityEvent } from '../services/activityApi';

export type TimeRange = '5min' | '15min' | '30min' | '1hr' | '1day';

export interface AggregatedActivityData {
  liveLLMUsage: LiveUsage | null;
  recentActivity: ActivityEvent[];
  trends: {
    callRate: number;
    tokenThroughput: number;
    totalCost: number;
    activeUsers: Set<string>;
    errorRate: number;
    topModels: Array<{ model: string; calls: number; tokens: number; cost: number }>;
    topUsers: Array<{ userId: string; count: number }>;
  };
  lastUpdate: Date;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
}

// Convert time range to minutes
const timeRangeToMinutes = (range: TimeRange): number => {
  switch (range) {
    case '5min': return 5;
    case '15min': return 15;
    case '30min': return 30;
    case '1hr': return 60;
    case '1day': return 1440; // 24 * 60
    default: return 5;
  }
};

export function useLiveActivityData(
  token: string,
  pollInterval: number = 10000, // 10 seconds default
  initialTimeRange: TimeRange = '5min'
): AggregatedActivityData {
  const [liveLLMUsage, setLiveLLMUsage] = useState<LiveUsage | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<{ calls: number; tokens: number; timestamp: Date } | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;

    const minutes = timeRangeToMinutes(timeRange);

    try {
      setError(null);
      const [llmData, activityData] = await Promise.allSettled([
        getLiveUsage(token, minutes),
        getActivityEvents(token, {
          limit: timeRange === '1day' ? 1000 : timeRange === '1hr' ? 500 : 100,
          since: new Date(Date.now() - minutes * 60 * 1000).toISOString()
        })
      ]);

      if (llmData.status === 'fulfilled') {
        setLiveLLMUsage(llmData.value);
      } else {
        console.error('Failed to load LLM usage:', llmData.reason);
      }

      if (activityData.status === 'fulfilled') {
        setRecentActivity(activityData.value);
      } else {
        console.error('Failed to load activity:', activityData.reason);
      }

      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load live activity data');
      console.error('Error loading live activity:', err);
    } finally {
      setLoading(false);
    }
  }, [token, timeRange]);

  useEffect(() => {
    // Initial load
    loadData();

    // Set up polling interval - poll less frequently for longer time ranges
    const adjustedInterval = timeRange === '1day' ? 60000 : timeRange === '1hr' ? 30000 : pollInterval;
    
    intervalRef.current = setInterval(() => {
      loadData();
    }, adjustedInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [token, pollInterval, loadData, timeRange]);

  // Calculate trends with memoization to prevent recalculation on every render
  const trends = useMemo(() => {
    // Calculate error rate efficiently (single pass)
    let errorCount = 0;
    const activeUserIds = new Set<string>();
    const userCounts = new Map<string, number>();
    
    for (const event of recentActivity) {
      if (event.type === 'error') errorCount++;
      if (event.userId) {
        activeUserIds.add(event.userId);
        userCounts.set(event.userId, (userCounts.get(event.userId) || 0) + 1);
      }
    }
    
    const errorRate = recentActivity.length > 0 ? errorCount / recentActivity.length : 0;
    
    // Optimize topModels calculation
    const topModels = liveLLMUsage
      ? Object.entries(liveLLMUsage.byModel)
          .map(([model, data]) => ({
            model,
            calls: data.calls,
            tokens: data.tokens,
            cost: data.cost || 0
          }))
          .sort((a, b) => b.calls - a.calls)
          .slice(0, 10)
      : [];
    
    // Optimize topUsers calculation
    const topUsers = Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      callRate: liveLLMUsage?.rate || 0,
      tokenThroughput: liveLLMUsage?.tokens || 0,
      totalCost: liveLLMUsage?.cost || 0,
      activeUsers: activeUserIds,
      errorRate,
      topModels,
      topUsers
    };
  }, [liveLLMUsage, recentActivity]);

  return {
    liveLLMUsage,
    recentActivity,
    trends,
    lastUpdate,
    loading,
    error,
    timeRange,
    setTimeRange
  };
}
