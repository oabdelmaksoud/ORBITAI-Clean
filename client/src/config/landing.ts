/**
 * Landing Page Configuration
 * Controls whether to use Elementor embed or React landing page
 */

export interface LandingConfig {
  /** Whether Elementor embed is enabled */
  elementorEnabled: boolean;
  /** URL to the Elementor-rendered page */
  elementorUrl: string | null;
  /** Allowed origins for postMessage communication (security) */
  allowedOrigins: string[];
}

/**
 * Get landing page configuration from environment variables
 */
export function getLandingConfig(): LandingConfig {
  const elementorEnabled = import.meta.env.VITE_ELEMENTOR_ENABLE === 'true';
  const elementorUrl = import.meta.env.VITE_ELEMENTOR_EMBED_URL || null;
  
  // Parse allowed origins from env var (comma-separated)
  const allowedOriginsEnv = import.meta.env.VITE_ELEMENTOR_ALLOWED_ORIGINS || '';
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // If no origins specified but Elementor is enabled, use the URL's origin
  if (elementorEnabled && elementorUrl && allowedOrigins.length === 0) {
    try {
      const url = new URL(elementorUrl);
      allowedOrigins.push(url.origin);
    } catch (e) {
      console.warn('[Landing Config] Invalid Elementor URL, cannot extract origin:', e);
    }
  }

  return {
    elementorEnabled,
    elementorUrl,
    allowedOrigins,
  };
}

/**
 * Check if a message origin is allowed
 */
export function isOriginAllowed(origin: string, config: LandingConfig): boolean {
  if (config.allowedOrigins.length === 0) {
    // If no origins configured, allow same origin only
    return origin === window.location.origin;
  }
  return config.allowedOrigins.includes(origin);
}




