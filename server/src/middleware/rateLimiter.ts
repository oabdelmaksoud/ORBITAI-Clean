import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Jitter handler to delay 429 responses slightly
const jitterHandler = (_req: Request, res: Response, _next: NextFunction, options: any) => {
  const jitterMs = Math.floor(Math.random() * 1000) + 500; // 500ms to 1500ms
  setTimeout(() => {
    res.status(options.statusCode).send(options.message);
  }, jitterMs);
};

// Skip rate limiting for admin routes, but NOT admin auth endpoints (those need rate limiting)
const skipAdminRoutes = (req: Request): boolean => {
  if (req.path.startsWith('/api/admin-auth')) {
    return false; // Admin auth endpoints must be rate limited to prevent brute force
  }
  return req.path.startsWith('/api/admin');
};

// Skip rate limiting for localhost in development (React StrictMode causes double-invocations)
const skipLocalhostInDev = (req: Request): boolean => {
  if (process.env.NODE_ENV === 'development') {
    // Only skip rate limiting for localhost IPs, not all requests
    const ip = req.ip || req.socket.remoteAddress || '';
    const forwardedFor = (req.headers['x-forwarded-for'] as string) || '';
    const host = req.headers.host || '';
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      forwardedFor.includes('127.0.0.1') ||
      forwardedFor.includes('::1') ||
      host.startsWith('localhost')
    );
  }
  return false;
};

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased from 100 to 300 to allow more normal usage (20 requests/minute)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request): boolean => {
    return skipAdminRoutes(req) || skipLocalhostInDev(req);
  },
  handler: jitterHandler,
});

// More lenient rate limiter for admin routes
// Using a shorter window with very high limits to handle React StrictMode double invocations
// and multiple components making requests on mount
export const adminRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window (resets more frequently)
  max: 120, // 2 requests/second per IP — reasonable for admin dashboards
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting entirely for localhost in development
  skip: (req: Request): boolean => {
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.socket.remoteAddress;
      return (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '::ffff:127.0.0.1' ||
        ip?.includes('localhost') ||
        false
      );
    }
    return false;
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req: Request): boolean => {
    return skipLocalhostInDev(req);
  },
});

// Lenient rate limiter for task execution and AI operations
// These operations require multiple API calls and should not be heavily restricted
export const taskExecutionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 task executions per 15 min per IP — prevents abuse
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request): boolean => {
    // Skip rate limiting for admin routes, but NOT admin auth endpoints
    if (req.path.startsWith('/api/admin-auth')) {
      return false;
    }
    return req.path.startsWith('/api/admin');
  },
});

// Very lenient rate limiter for public feature flags check endpoint
// This endpoint is called frequently on app load and should not be heavily restricted
export const featureFlagsCheckRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 200, // 200 requests per minute — sufficient for polling; was 1000 (too permissive)
  message: 'Too many feature flag checks from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development mode to avoid issues with React StrictMode double invocations
  skip: (req: Request): boolean => {
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.socket.remoteAddress;
      return (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '::ffff:127.0.0.1' ||
        ip?.includes('localhost') ||
        false ||
        !ip
      );
    }
    return false;
  },
});
