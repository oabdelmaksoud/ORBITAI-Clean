/**
 * Performance Monitoring Routes
 * Provides performance metrics and monitoring endpoints
 */

import express from 'express';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { getPerformanceMetrics, clearPerformanceMetrics, getRawMetrics } from '../middleware/performanceMonitor.js';
import { AppError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

/**
 * GET /api/admin/performance/metrics
 * Get performance metrics
 */
router.get('/metrics', async (req: AdminRequest, res, next) => {
  try {
    const metrics = getPerformanceMetrics();
    res.json({
      success: true,
      data: {
        metrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/performance/metrics
 * Clear performance metrics
 */
router.delete('/metrics', async (req: AdminRequest, res, next) => {
  try {
    clearPerformanceMetrics();
    res.json({
      success: true,
      message: 'Performance metrics cleared',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/performance/api-metrics
 * Get API metrics in the format expected by the frontend
 */
router.get('/api-metrics', async (req: AdminRequest, res, next) => {
  try {
    const timeRange = req.query.timeRange as string || '1h';
    
    // Calculate time window
    const now = Date.now();
    let timeWindowMs: number;
    switch (timeRange) {
      case '24h':
        timeWindowMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        timeWindowMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case '1h':
      default:
        timeWindowMs = 60 * 60 * 1000;
        break;
    }
    
    // Get raw metrics and filter by time range
    const rawMetrics = getRawMetrics();
    const filteredMetrics = rawMetrics.filter(m => (now - m.timestamp) <= timeWindowMs);
    
    if (filteredMetrics.length === 0) {
      res.json({
        success: true,
        data: {
          timeRange,
          overall: {
            totalRequests: 0,
            totalErrors: 0,
            successRate: 100,
            avgResponseTime: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0,
          },
          endpoints: [],
          recentMetrics: [],
        },
      });
      return;
    }
    
    // Calculate overall stats
    const totalRequests = filteredMetrics.length;
    const responseTimes = filteredMetrics.map(m => m.duration).sort((a, b) => a - b);
    const avgResponseTime = Math.round(responseTimes.reduce((sum, rt) => sum + rt, 0) / totalRequests);
    
    // Calculate percentiles
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || avgResponseTime;
    const p99ResponseTime = responseTimes[p99Index] || avgResponseTime;
    
    // Calculate error count and success rate
    const errorMetrics = filteredMetrics.filter(m => m.statusCode >= 400);
    const totalErrors = errorMetrics.length;
    const successRate = totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 100;
    
    // Build endpoint stats grouped by method and path
    const endpointMap = new Map<string, {
      endpoint: string;
      method: string;
      durations: number[];
      errors: number;
    }>();
    
    filteredMetrics.forEach(m => {
      const key = `${m.method}:${m.path}`;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          endpoint: m.path,
          method: m.method,
          durations: [],
          errors: 0,
        });
      }
      const stats = endpointMap.get(key)!;
      stats.durations.push(m.duration);
      if (m.statusCode >= 400) {
        stats.errors++;
      }
    });
    
    const endpoints = Array.from(endpointMap.values()).map(stats => {
      const sortedDurations = stats.durations.sort((a, b) => a - b);
      const count = stats.durations.length;
      const avgResponseTime = Math.round(stats.durations.reduce((sum, d) => sum + d, 0) / count);
      const minResponseTime = sortedDurations[0] || 0;
      const maxResponseTime = sortedDurations[sortedDurations.length - 1] || 0;
      const errorCount = stats.errors;
      const endpointSuccessRate = count > 0 ? ((count - errorCount) / count) * 100 : 100;
      
      return {
        endpoint: stats.endpoint,
        method: stats.method,
        count,
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        errorCount,
        successRate: endpointSuccessRate,
      };
    });
    
    // Recent metrics (last 20)
    const recentMetrics = filteredMetrics
      .slice(-20)
      .reverse()
      .map(m => ({
        endpoint: m.path,
        method: m.method,
        responseTime: m.duration,
        statusCode: m.statusCode,
        timestamp: new Date(m.timestamp).toISOString(),
      }));
    
    res.json({
      success: true,
      data: {
        timeRange,
        overall: {
          totalRequests,
          totalErrors,
          successRate: Math.round(successRate * 10) / 10,
          avgResponseTime,
          p95ResponseTime,
          p99ResponseTime,
        },
        endpoints: endpoints.sort((a, b) => b.count - a.count), // Sort by request count
        recentMetrics,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/performance/slow-queries
 * Get slow database queries from MongoDB profiling data
 */
router.get('/slow-queries', async (req: AdminRequest, res, next) => {
  try {
    if (!mongoose.connection.readyState) {
      res.json({
        success: true,
        data: {
          message: 'Database connection not available. Slow query monitoring requires MongoDB profiling to be enabled.',
          slowQueries: [],
          summary: {
            total: 0,
            avgDuration: 0,
            maxDuration: 0,
            byCollection: [],
          },
          recommendations: [
            'Enable MongoDB profiling to track slow queries',
            'Use MongoDB Atlas Performance Advisor for query optimization',
            'Monitor database indexes and query patterns',
          ],
        },
      });
      return;
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      res.json({
        success: true,
        data: {
          message: 'Database connection not available.',
          slowQueries: [],
          summary: {
            total: 0,
            avgDuration: 0,
            maxDuration: 0,
            byCollection: [],
          },
          recommendations: [],
        },
      });
      return;
    }
    
    // Check if profiling is enabled
    let profilingStatus;
    try {
      profilingStatus = await db.command({ profile: -1 });
    } catch (checkError: any) {
      logger.warn('[slow-queries] Could not check profiling status:', checkError.message);
    }
    
    // Check if system.profile collection exists and has data
    const profileCollection = db.collection('system.profile');
    let profileExists = false;
    let profileCount = 0;
    
    try {
      const collections = await db.listCollections({ name: 'system.profile' }).toArray();
      profileExists = collections.length > 0;
      if (profileExists) {
        profileCount = await profileCollection.countDocuments();
      }
    } catch (profileError: any) {
      logger.debug('[slow-queries] Could not access system.profile:', profileError.message);
    }
    
    // If profiling is not enabled or no data, return instructions
    if (!profileExists || profileCount === 0 || (profilingStatus && profilingStatus.was === 0)) {
      res.json({
        success: true,
        data: {
          slowQueries: [],
          summary: {
            total: 0,
            avgDuration: 0,
            maxDuration: 0,
            byCollection: [],
          },
          recommendations: [
            'Enable MongoDB profiling: db.setProfilingLevel(1, { slowms: 100 })',
            'Or use MongoDB shell: db.setProfilingLevel(1, { slowms: 100 })',
            'Review indexes on frequently queried collections',
            'Consider adding compound indexes for common query patterns',
          ],
          message: 'Slow query monitoring requires MongoDB profiling to be enabled. Enable it with: db.setProfilingLevel(1, { slowms: 100 })',
          profilingStatus: profilingStatus ? {
            level: profilingStatus.was,
            slowms: profilingStatus.slowms,
            sampleRate: profilingStatus.sampleRate
          } : null,
        },
      });
      return;
    }
    
    // Query system.profile collection for slow queries
    // Get queries from the last 24 hours, sorted by duration (descending)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const slowQueriesDocs = await profileCollection
      .find({
        ts: { $gte: oneDayAgo },
        millis: { $exists: true }
      })
      .sort({ millis: -1 })
      .limit(100)
      .toArray();
    
    // Transform MongoDB profile documents to our format
    const slowQueries = slowQueriesDocs.map((doc: any) => {
      const command = doc.command || doc.query || {};
      const collection = command.find || command.count || command.aggregate || command.update || command.delete || 'unknown';
      const collectionName = typeof collection === 'string' ? collection : (collection.split('.')[1] || 'unknown');
      
      return {
        command: command,
        collection: collectionName,
        duration: Math.round(doc.millis || 0),
        timestamp: doc.ts || new Date(),
        filter: command.filter || command.query || {},
        projection: command.projection || {},
        sort: command.sort || {},
        limit: command.limit || 0,
        skip: command.skip || 0,
      };
    });
    
    // Calculate summary statistics
    const total = slowQueries.length;
    const durations = slowQueries.map(q => q.duration);
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    
    // Group by collection
    const byCollectionMap = new Map<string, number>();
    slowQueries.forEach(q => {
      const count = byCollectionMap.get(q.collection) || 0;
      byCollectionMap.set(q.collection, count + 1);
    });
    
    const byCollection = Array.from(byCollectionMap.entries())
      .map(([name, count]) => ({ collection: name, count }))
      .sort((a, b) => b.count - a.count);
    
    // Generate recommendations based on slow queries
    const recommendations: string[] = [];
    if (maxDuration > 1000) {
      recommendations.push(`Queries taking over 1 second detected. Consider adding indexes on frequently queried fields.`);
    }
    if (byCollection.length > 0) {
      const topCollection = byCollection[0];
      recommendations.push(`Most slow queries are in "${topCollection.collection}" collection. Review indexes for this collection.`);
    }
    if (slowQueries.some(q => q.filter && Object.keys(q.filter).length > 0)) {
      recommendations.push('Review query filters - ensure indexed fields are used in filter conditions.');
    }
    if (slowQueries.some(q => q.sort && Object.keys(q.sort).length > 0)) {
      recommendations.push('Queries with sorting detected - ensure sort fields are indexed.');
    }
    
    res.json({
      success: true,
      data: {
        slowQueries: slowQueries.slice(0, 50), // Return top 50
        summary: {
          total,
          avgDuration,
          maxDuration,
          byCollection,
        },
        recommendations: recommendations.length > 0 ? recommendations : [
          'Monitor slow queries regularly',
          'Review indexes on frequently queried collections',
          'Consider adding compound indexes for common query patterns',
        ],
        profilingStatus: profilingStatus ? {
          level: profilingStatus.was,
          slowms: profilingStatus.slowms,
          sampleRate: profilingStatus.sampleRate
        } : null,
      },
    });
  } catch (error: any) {
    logger.error('[slow-queries] Error fetching slow queries:', error);
    // Return error but don't fail the request
    res.json({
      success: true,
      data: {
        slowQueries: [],
        summary: {
          total: 0,
          avgDuration: 0,
          maxDuration: 0,
          byCollection: [],
        },
        recommendations: [
          'Enable MongoDB profiling: db.setProfilingLevel(1, { slowms: 100 })',
          'Check MongoDB connection and permissions',
        ],
        message: `Error fetching slow queries: ${error.message}`,
      },
    });
  }
});

/**
 * GET /api/admin/performance/system-health
 * Get system health information
 */
router.get('/system-health', async (req: AdminRequest, res, next) => {
  try {
    // Database health
    const isConnected = mongoose.connection.readyState === 1;
    let totalCollections = 0;
    let totalDocuments = 0;
    const collections: Array<{ name: string; count: number }> = [];
    
    if (isConnected) {
      try {
        const db = mongoose.connection.db;
        if (db) {
          const dbCollections = await db.listCollections().toArray();
          totalCollections = dbCollections.length;
          
          // Get document counts for top collections
          for (const collectionInfo of dbCollections.slice(0, 10)) {
            try {
              const collection = db.collection(collectionInfo.name);
              const count = await collection.countDocuments();
              totalDocuments += count;
              collections.push({
                name: collectionInfo.name,
                count,
              });
            } catch (err) {
              // Skip collections that can't be counted
            }
          }
        }
      } catch (dbError) {
        // Database operations failed
      }
    }
    
    // API metrics
    const metrics = getPerformanceMetrics();
    const recentErrors = Math.round((metrics.totalRequests * (metrics.errorRate || 0)) / 100);
    
    res.json({
      success: true,
      data: {
        database: {
          status: isConnected ? 'Connected' : 'Disconnected',
          isConnected,
          totalCollections,
          totalDocuments,
          collections: collections.sort((a, b) => b.count - a.count).slice(0, 10),
        },
        api: {
          totalMetrics: metrics.totalRequests || 0,
          recentErrors,
          avgResponseTime: metrics.averageResponseTime || 0,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/performance/profiling-status
 * Check MongoDB profiling status and enable if needed
 */
router.get('/profiling-status', async (req: AdminRequest, res, next) => {
  try {
    if (!mongoose.connection.readyState) {
      res.json({
        success: false,
        message: 'Database connection not available',
      });
      return;
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      res.json({
        success: false,
        message: 'Database connection not available',
      });
      return;
    }
    
    // Check current profiling status
    let profilingStatus;
    try {
      profilingStatus = await db.command({ profile: -1 });
    } catch (checkError: any) {
      logger.error('[profiling-status] Could not check profiling status:', checkError);
      res.json({
        success: false,
        message: `Could not check profiling status: ${checkError.message}`,
        error: checkError.message,
      });
      return;
    }
    
    // Check if system.profile collection exists
    let profileCount = 0;
    try {
      const collections = await db.listCollections({ name: 'system.profile' }).toArray();
      if (collections.length > 0) {
        const profileCollection = db.collection('system.profile');
        profileCount = await profileCollection.countDocuments();
      }
    } catch (profileError: any) {
      logger.debug('[profiling-status] Could not access system.profile:', profileError.message);
    }
    
    res.json({
      success: true,
      data: {
        enabled: profilingStatus.was > 0,
        level: profilingStatus.was,
        slowms: profilingStatus.slowms || 100,
        sampleRate: profilingStatus.sampleRate || 1.0,
        profileCount,
        message: profilingStatus.was === 0
          ? 'Profiling is disabled. Enable it with: db.setProfilingLevel(1, { slowms: 100 })'
          : `Profiling is enabled at level ${profilingStatus.was} with slowms=${profilingStatus.slowms || 100}`,
      },
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/performance/enable-profiling
 * Enable MongoDB profiling
 */
router.post('/enable-profiling', async (req: AdminRequest, res, next) => {
  try {
    const { level = 1, slowms = 100 } = req.body;
    
    if (!mongoose.connection.readyState) {
      res.json({
        success: false,
        message: 'Database connection not available',
      });
      return;
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      res.json({
        success: false,
        message: 'Database connection not available',
      });
      return;
    }
    
    // Enable profiling
    try {
      const result = await db.command({ profile: level, slowms });
      logger.info(`[enable-profiling] MongoDB profiling enabled: level=${level}, slowms=${slowms}`);
      
      res.json({
        success: true,
        message: `Profiling enabled at level ${level} with slowms=${slowms}`,
        data: {
          level: result.was,
          slowms: result.slowms,
          previousLevel: result.was,
        },
      });
    } catch (enableError: any) {
      logger.error('[enable-profiling] Failed to enable profiling:', enableError);
      res.json({
        success: false,
        message: `Failed to enable profiling: ${enableError.message}`,
        error: enableError.message,
        hint: 'This may require admin privileges. Try running: db.setProfilingLevel(1, { slowms: 100 }) in MongoDB shell',
      });
    }
  } catch (error: any) {
    next(error);
  }
});

export default router;
