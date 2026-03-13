/**
 * API URL Normalizer
 * Ensures all API URLs use port 3002, catching any hardcoded references to port 3001
 */

/**
 * Normalizes an API URL to use port 3002
 * This is a runtime safety check to catch any hardcoded port 3001 references
 */
export function normalizeApiUrl(url: string | undefined | null): string {
  if (!url) {
    return 'http://localhost:3002';
  }

  // Replace any port 3001 references with 3002
  return url
    .replace(/localhost:3001(\/|$|:)/g, 'localhost:3002$1')
    .replace(/127\.0\.0\.1:3001(\/|$|:)/g, '127.0.0.1:3002$1')
    .replace(/:3001\//g, ':3002/')
    .replace(/:3001$/g, ':3002');
}

/**
 * Gets the API base URL from environment, normalized to port 3002
 * For remote access (localtunnel, ngrok, etc.), returns current origin to use proxy
 */
export function getApiBaseUrl(): string {
  // Check if we're being accessed remotely (not localhost)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // If accessed remotely, use current origin (proxied through Vite or via backend tunnel)
    if (!isLocalhost) {
      // For remote access, we return the current origin which will be proxied
      // to the backend via Vite's proxy configuration
      return window.location.origin;
    }
  }

  // Local development
  const envUrl = import.meta.env.VITE_API_URL;

  // If explicitly set to empty string (for proxy support), return empty string
  if (envUrl === '') {
    return '';
  }

  return normalizeApiUrl(envUrl || 'http://localhost:3002');
}


