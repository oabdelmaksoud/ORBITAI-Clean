/**
 * Health Check Routes
 * Provides health status of the application and its dependencies
 */

import express from 'express';
import { connectDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';
import { redisService } from '../services/redis.service.js';
import { e2bService } from '../services/e2b.service.js';
import { config } from '../config/env.js';

const router = express.Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  dependencies: {
    database: {
      status: 'connected' | 'disconnected' | 'error';
      latency?: number;
    };
    redis?: {
      status: 'connected' | 'disconnected' | 'error';
      latency?: number;
    };
    externalApis?: {
      gemini?: {
        status: 'available' | 'unavailable' | 'error';
        responseTime?: number;
      };
      e2b?: {
        status: 'available' | 'unavailable' | 'error';
        responseTime?: number;
      };
    };
  };
}

/**
 * Basic health check
 * GET /health
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check with dependency status
 * GET /health/detailed
 */
router.get('/detailed', async (_req, res) => {
  const startTime = Date.now();
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    dependencies: {
      database: {
        status: 'disconnected',
      },
    },
  };

  // Check database connection
  try {
    const dbStartTime = Date.now();
    const dbState = mongoose.connection.readyState;
    const dbLatency = Date.now() - dbStartTime;

    if (dbState === 1) {
      // Connected
      healthStatus.dependencies.database = {
        status: 'connected',
        latency: dbLatency,
      };
    } else if (dbState === 2) {
      // Connecting
      healthStatus.dependencies.database = {
        status: 'error',
      };
      healthStatus.status = 'degraded';
    } else {
      // Disconnected or uninitialized
      healthStatus.dependencies.database = {
        status: 'disconnected',
      };
      healthStatus.status = 'unhealthy';
    }

    // Try to ping the database
    if (dbState === 1) {
      try {
        await mongoose.connection.db.admin().ping();
        healthStatus.dependencies.database.latency = Date.now() - dbStartTime;
      } catch (pingError) {
        logger.warn('Database ping failed:', pingError);
        healthStatus.dependencies.database.status = 'error';
        healthStatus.status = 'degraded';
      }
    }
  } catch (error: any) {
    logger.error('Health check error:', error);
    healthStatus.dependencies.database = {
      status: 'error',
    };
    healthStatus.status = 'unhealthy';
  }

  // Check Redis connection (optional service)
  try {
    const redisStartTime = Date.now();
    const redisConnected = redisService.isAvailable();
    const redisLatency = Date.now() - redisStartTime;
    
    healthStatus.dependencies.redis = {
      status: redisConnected ? 'connected' : 'disconnected',
      latency: redisLatency
    };
    
    // Redis is optional, so don't degrade status if not connected
    // Only degrade if it was connected and then failed
  } catch (error) {
    healthStatus.dependencies.redis = {
      status: 'error'
    };
    // Redis errors shouldn't degrade overall status since it's optional
  }

  // Check external APIs
  healthStatus.dependencies.externalApis = {};
  
  // Check Gemini API (from database)
  try {
    const { apiKeyProvider } = await import('../services/apiKeyProvider.service.js');
    const geminiStartTime = Date.now();
    const geminiAvailable = await apiKeyProvider.hasApiKey('gemini');
    const geminiResponseTime = Date.now() - geminiStartTime;
    
    healthStatus.dependencies.externalApis.gemini = {
      status: geminiAvailable ? 'available' : 'unavailable',
      responseTime: geminiResponseTime
    };
  } catch (error) {
    healthStatus.dependencies.externalApis.gemini = {
      status: 'error'
    };
  }

  // Check E2B API
  try {
    const e2bStartTime = Date.now();
    const e2bConfigured = await e2bService.isConfigured();
    const e2bResponseTime = Date.now() - e2bStartTime;
    
    healthStatus.dependencies.externalApis.e2b = {
      status: e2bConfigured ? 'available' : 'unavailable',
      responseTime: e2bResponseTime
    };
  } catch (error) {
    healthStatus.dependencies.externalApis.e2b = {
      status: 'error'
    };
  }

  // Determine overall status
  // Only database is critical - Redis is optional
  const databaseStatus = healthStatus.dependencies.database.status;
  
  if (databaseStatus === 'disconnected' || databaseStatus === 'error') {
    healthStatus.status = 'unhealthy';
  } else {
    // System is healthy if database is connected
    // Redis being unavailable doesn't affect overall health
    healthStatus.status = 'healthy';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

/**
 * Readiness check (for Kubernetes/Docker)
 * GET /health/ready
 */
router.get('/ready', async (_req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'not ready',
        reason: 'Database not connected',
      });
    }

    // Ping database
    await mongoose.connection.db.admin().ping();

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      reason: error.message || 'Unknown error',
    });
  }
});

/**
 * Liveness check (for Kubernetes/Docker)
 * GET /health/live
 */
router.get('/live', (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
