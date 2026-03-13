/**
 * Sample Projects API Service - Fetch sample projects from backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface SampleProject {
  id: string;
  name: string;
  description: string;
  phase: string;
  methodology?: string;
  createdAt?: string | number;
}

// Cache for sample projects to prevent rate limiting
const sampleProjectsCache: { data: SampleProject[] | null; timestamp: number } = { data: null, timestamp: 0 };
const SAMPLE_CACHE_DURATION = 60 * 1000; // 60 seconds cache for sample projects
let pendingSampleProjectsRequest: Promise<SampleProject[]> | null = null;

// Rate limit tracking for sample projects
let lastSampleRateLimitTime: number = 0;
const SAMPLE_RATE_LIMIT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown after rate limit

export async function getSampleProjects(): Promise<SampleProject[]> {
  // Check cache first
  const now = Date.now();
  if (sampleProjectsCache.data && (now - sampleProjectsCache.timestamp) < SAMPLE_CACHE_DURATION) {
    if (import.meta.env.DEV) {
      console.debug('[Sample Projects] Using cached sample projects');
    }
    return sampleProjectsCache.data;
  }

  // Check if there's already a pending request
  if (pendingSampleProjectsRequest) {
    if (import.meta.env.DEV) {
      // Silently reuse pending request to reduce console noise
    }
    return pendingSampleProjectsRequest;
  }

  // Check if we've been rate limited recently - skip API call if so
  const timeSinceRateLimit = Date.now() - lastSampleRateLimitTime;
  if (timeSinceRateLimit < SAMPLE_RATE_LIMIT_COOLDOWN) {
    if (sampleProjectsCache.data) {
      if (import.meta.env.DEV) {
        console.debug('[Sample Projects] Using cached data - recently rate limited');
      }
      return sampleProjectsCache.data;
    }
    // If no cache, return empty array to avoid hitting rate limit
    return [];
  }

  // Create new request
  const requestPromise = (async (): Promise<SampleProject[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/samples`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true' // Fix for localtunnel 511 error
        }
      });

      if (!response.ok) {
        // If rate limited, track it and use cached data if available (even if expired)
        if (response.status === 429) {
          lastSampleRateLimitTime = Date.now();
          if (sampleProjectsCache.data) {
            console.warn('[Sample Projects] Rate limited, using cached data');
            return sampleProjectsCache.data;
          }
          // Return empty array if no cache
          return [];
        }
        throw new Error(`Failed to fetch sample projects: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data.projects)) {
        const projects = data.data.projects;

        // Update cache
        sampleProjectsCache.data = projects;
        sampleProjectsCache.timestamp = Date.now();

        return projects;
      }

      return [];
    } catch (error: any) {
      // If rate limited, track it and use cached data if available (even if expired)
      if (error?.message?.includes('429') || (error?.status === 429)) {
        lastSampleRateLimitTime = Date.now();
        if (sampleProjectsCache.data) {
          console.warn('[Sample Projects] Rate limited, using cached data');
          return sampleProjectsCache.data;
        }
        // Return empty array if no cache
        return [];
      }

      // Suppress all logging for connection errors (backend not running is expected)
      const isConnectionError = error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('Connection refused') ||
        error?.message?.includes('ERR_CONNECTION_REFUSED') ||
        error?.message?.includes('NetworkError') ||
        (error?.name === 'TypeError' && error?.message?.includes('fetch'));
      // Completely silent for connection errors - backend is not running
      if (!isConnectionError && import.meta.env.DEV) {
        console.debug('Error fetching sample projects:', error);
      }

      // Return cached data if available, otherwise empty array
      if (sampleProjectsCache.data) {
        return sampleProjectsCache.data;
      }

      // Return empty array on error - don't break the app
      return [];
    }
  })();

  // Store pending request
  pendingSampleProjectsRequest = requestPromise;

  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clear pending request
    pendingSampleProjectsRequest = null;
  }
}

