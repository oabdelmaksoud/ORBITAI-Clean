/**
 * Force JSON Response Middleware
 * Ensures all API routes return JSON, never HTML
 */

import { Request, Response, NextFunction } from 'express';

export function forceJsonResponse(req: Request, res: Response, next: NextFunction): void {
  // Only apply to API routes
  if (!req.path.startsWith('/api')) {
    return next();
  }

  // Allow HTML responses for demo prototype (CUA testing)
  if (req.path === '/api/demo/prototype/html') {
    return next();
  }

  // Store original json method
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalSendFile = res.sendFile.bind(res);
  const originalRender = res.render.bind(res);

  // Force Content-Type to JSON for API routes
  res.setHeader('Content-Type', 'application/json');

  // Override res.json to ensure Content-Type is set
  res.json = function (body: any) {
    res.setHeader('Content-Type', 'application/json');
    return originalJson(body);
  };

  // Override res.send to convert HTML to JSON error
  res.send = function (body: any) {
    // If body is HTML, convert to JSON error
    if (typeof body === 'string' && (body.trim().startsWith('<!DOCTYPE') || body.trim().startsWith('<!doctype') || body.trim().startsWith('<html'))) {
      res.setHeader('Content-Type', 'application/json');
      return originalJson({
        success: false,
        error: {
          message: 'Server returned HTML instead of JSON',
          path: req.path,
          method: req.method
        }
      });
    }

    // If Content-Type is not set or is HTML, force JSON
    const contentType = res.getHeader('content-type');
    if (!contentType || (typeof contentType === 'string' && contentType.includes('text/html'))) {
      res.setHeader('Content-Type', 'application/json');
      if (typeof body === 'string') {
        return originalJson({
          success: false,
          error: {
            message: body.substring(0, 200),
            path: req.path,
            method: req.method
          }
        });
      }
    }

    return originalSend(body);
  };

  // Override res.sendFile to prevent serving HTML files for API routes
  res.sendFile = function (path: string, ...args: any[]) {
    res.setHeader('Content-Type', 'application/json');
    return originalJson({
      success: false,
      error: {
        message: 'File serving not allowed for API routes',
        path: req.path,
        method: req.method
      }
    });
  };

  // Override res.render to prevent rendering HTML templates for API routes
  res.render = function (view: string, ...args: any[]) {
    res.setHeader('Content-Type', 'application/json');
    return originalJson({
      success: false,
      error: {
        message: 'Template rendering not allowed for API routes',
        path: req.path,
        method: req.method
      }
    });
  };

  // Intercept response finish to ensure JSON
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any) {
    const contentType = res.getHeader('content-type');

    // If Content-Type is HTML or not set, force JSON
    if (!contentType || (typeof contentType === 'string' && contentType.includes('text/html'))) {
      res.setHeader('Content-Type', 'application/json');
      const errorResponse = {
        success: false,
        error: {
          message: 'Server attempted to return HTML for API route',
          path: req.path,
          method: req.method
        }
      };
      return originalEnd(JSON.stringify(errorResponse), encoding);
    }

    // If chunk is HTML string, convert to JSON
    if (typeof chunk === 'string' && (chunk.trim().startsWith('<!DOCTYPE') || chunk.trim().startsWith('<!doctype') || chunk.trim().startsWith('<html'))) {
      res.setHeader('Content-Type', 'application/json');
      const errorResponse = {
        success: false,
        error: {
          message: 'Server returned HTML instead of JSON',
          path: req.path,
          method: req.method
        }
      };
      return originalEnd(JSON.stringify(errorResponse), encoding);
    }

    return originalEnd(chunk, encoding);
  };

  next();
}

