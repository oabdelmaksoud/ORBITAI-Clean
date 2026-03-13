import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Jitter handler to delay 429 responses slightly
const jitterHandler = (req: Request, res: Response, next: NextFunction, options: any) => {
  const jitterMs = Math.floor(Math.random() * 1000) + 500; // 500ms to 1500ms
  setTimeout(() => {
    res.status(options.statusCode).send(options.message);
  }, jitterMs);
};

// Skip rate limiting for admin routes
const skipAdminRoutes = (req: Request): boolean => {
  return req.path.startsWith('/api/admin') || req.path.startsWith('/api/admin-auth');
};

// Skip rate limiting for localhost in development (React StrictMode causes double-invocations)
const skipLocalhostInDev = (req: Request): boolean => {
  if (process.env.NODE_ENV === 'development') {
    // In development, skip rate limiting for all requests to avoid issues with React StrictMode
    // This is safe because we're only in development mode
    return true;

    // Alternative: More specific IP detection (commented out in favor of blanket skip in dev)
    // const ip = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for'] || '';
    // const host = req.headers.host || '';
    // return ip === '127.0.0.1' || 
    //        ip === '::1' || 
    //        ip === '::ffff:127.0.0.1' || 
    //        ip?.includes('localhost') || 
    //        host?.includes('localhost') ||
    //        !ip;
  }
  return false;
};

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased from 100 to 300 to allow more normal usage (20 requests/minute)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    return skipAdminRoutes(req) || skipLocalhostInDev(req);
  },
  handler: jitterHandler,
});

// More lenient rate limiter for admin routes
// Using a shorter window with very high limits to handle React StrictMode double invocations
// and multiple components making requests on mount
export const adminRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window (resets more frequently)
  max: 1000, // Very high limit: 1000 requests per minute (~16 requests/second)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting entirely for localhost in development
  skip: (req: Request) => {
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.socket.remoteAddress;
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip?.includes('localhost');
    }
    return false;
  }
});

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req: Request) => {
    return skipLocalhostInDev(req);
  },
});

// Lenient rate limiter for task execution and AI operations
// These operations require multiple API calls and should not be heavily restricted
export const taskExecutionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Much higher limit for task execution (allows ~66 requests/minute)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for admin routes
    return req.path.startsWith('/api/admin') || req.path.startsWith('/api/admin-auth');
  }
});

// Very lenient rate limiter for public feature flags check endpoint
// This endpoint is called frequently on app load and should not be heavily restricted
export const featureFlagsCheckRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 1000, // Increased to 1000 requests per minute to handle many concurrent checks on app load
  message: 'Too many feature flag checks from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development mode to avoid issues with React StrictMode double invocations
  skip: (req: Request) => {
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.socket.remoteAddress;
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip?.includes('localhost') || !ip;
    }
    return false;
  }
});

