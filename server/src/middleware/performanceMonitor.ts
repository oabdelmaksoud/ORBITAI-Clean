/**
 * Performance Monitoring Middleware
 * Tracks API response times and performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface PerformanceMetrics {
  path: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: number;
}

// In-memory metrics store (in production, use Redis or database)
const metrics: PerformanceMetrics[] = [];
const MAX_METRICS = 1000; // Keep last 1000 requests

/**
 * Performance monitoring middleware
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const path = req.path;
  const method = req.method;

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn(`Slow request detected: ${method} ${path} took ${duration}ms`, {
        path,
        method,
        duration,
        statusCode,
      });
    }

    // Store metrics
    metrics.push({
      path,
      method,
      duration,
      statusCode,
      timestamp: Date.now(),
    });

    // Keep only last MAX_METRICS
    if (metrics.length > MAX_METRICS) {
      metrics.shift();
    }

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics(): {
  totalRequests: number;
  averageResponseTime: number;
  slowRequests: PerformanceMetrics[];
  requestsByPath: Record<string, { count: number; avgDuration: number }>;
  requestsByMethod: Record<string, { count: number; avgDuration: number }>;
  errorRate: number;
} {
  if (metrics.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: [],
      requestsByPath: {},
      requestsByMethod: {},
      errorRate: 0,
    };
  }

  const totalRequests = metrics.length;
  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
  const averageResponseTime = totalDuration / totalRequests;

  // Slow requests (> 1 second)
  const slowRequests = metrics.filter(m => m.duration > 1000);

  // Requests by path
  const requestsByPath: Record<string, { count: number; totalDuration: number }> = {};
  metrics.forEach(m => {
    if (!requestsByPath[m.path]) {
      requestsByPath[m.path] = { count: 0, totalDuration: 0 };
    }
    requestsByPath[m.path].count++;
    requestsByPath[m.path].totalDuration += m.duration;
  });

  const requestsByPathFormatted: Record<string, { count: number; avgDuration: number }> = {};
  Object.keys(requestsByPath).forEach(path => {
    const data = requestsByPath[path];
    requestsByPathFormatted[path] = {
      count: data.count,
      avgDuration: data.totalDuration / data.count,
    };
  });

  // Requests by method
  const requestsByMethod: Record<string, { count: number; totalDuration: number }> = {};
  metrics.forEach(m => {
    if (!requestsByMethod[m.method]) {
      requestsByMethod[m.method] = { count: 0, totalDuration: 0 };
    }
    requestsByMethod[m.method].count++;
    requestsByMethod[m.method].totalDuration += m.duration;
  });

  const requestsByMethodFormatted: Record<string, { count: number; avgDuration: number }> = {};
  Object.keys(requestsByMethod).forEach(method => {
    const data = requestsByMethod[method];
    requestsByMethodFormatted[method] = {
      count: data.count,
      avgDuration: data.totalDuration / data.count,
    };
  });

  // Error rate (4xx and 5xx status codes)
  const errorCount = metrics.filter(m => m.statusCode >= 400).length;
  const errorRate = (errorCount / totalRequests) * 100;

  return {
    totalRequests,
    averageResponseTime: Math.round(averageResponseTime),
    slowRequests: slowRequests.slice(-10), // Last 10 slow requests
    requestsByPath: requestsByPathFormatted,
    requestsByMethod: requestsByMethodFormatted,
    errorRate: Math.round(errorRate * 100) / 100,
  };
}

/**
 * Clear performance metrics
 */
export function clearPerformanceMetrics(): void {
  metrics.length = 0;
}

/**
 * Get raw performance metrics array
 */
export function getRawMetrics(): PerformanceMetrics[] {
  return [...metrics]; // Return a copy
}


