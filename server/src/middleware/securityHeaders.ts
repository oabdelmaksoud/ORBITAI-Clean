/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Nonce generation middleware — must run before securityHeaders.
 * Attaches a per-request nonce to res.locals so CSP and templates can use it.
 */
export function generateNonce(_req: Request, res: Response, next: NextFunction): void {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
}

/**
 * Security headers middleware
 * Adds CSP, HSTS, and other security headers
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  const nonce = (res.locals.nonce as string) || crypto.randomBytes(16).toString('base64');

  // Content Security Policy — nonce-based, no unsafe-inline
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.tailwindcss.com`,
    `style-src 'self' 'nonce-${nonce}' https://cdn.tailwindcss.com`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.x.ai",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  // Set security headers
  res.setHeader('Content-Security-Policy', cspDirectives);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // Critical for WebContainers (SharedArrayBuffer)
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // HSTS - Only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}
