/**
 * Router Metrics Service
 * Real-time metrics aggregation for LLM routing with WebSocket support
 */

import mongoose from 'mongoose';
import { LLMUsage} from '../models/LLMUsage.model.js';
import { modelRegistry } from './llm/models/ModelRegistry.js';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export interface ModelHealthStatus {
  modelId: string;
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  successRate: number;
  avgLatency: number;
  errorCount: number;
  lastError?: string;
  lastUpdated: Date;
}

export interface LatencyPercentiles {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface CostBurnRate {
  hourly: number;
  daily: number;
  weekly: number;
  monthly: number;
  projectedMonthly: number;
}

export interface ModelMetrics {
  modelId: string;
  provider: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  latencyPercentiles: LatencyPercentiles;
  errorRate: number;
}

export interface HourlyMetric {
  hour: string;
  modelId: string;
  avgLatency: number;
  requestCount: number;
  errorRate: number;
}

export interface RealTimeMetrics {
  timestamp: Date;
  period: '5min' | '1hour' | '24hours';
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
  costBurnRate: CostBurnRate;
  modelHealth: ModelHealthStatus[];
  modelMetrics: ModelMetrics[];
  latencyHeatmap: HourlyMetric[];
  topErrors: Array<{ error: string; count: number; lastOccurred: Date }>;
}

class RouterMetricsService extends EventEmitter {
  private metricsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private modelHealthCache: Map<string, ModelHealthStatus> = new Map();

  constructor() {
    super();
    this.startHealthMonitoring();
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    // Update health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.updateModelHealth();
        this.emit('healthUpdate', Array.from(this.modelHealthCache.values()));
      } catch (error: unknown) {
        logger.error('[RouterMetrics] Health monitoring error:', error);
      }
    }, 30000);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get real-time metrics for the dashboard
   */
  async getRealTimeMetrics(period: '5min' | '1hour' | '24hours' = '1hour', routerType?: 'end-user' | 'internal'): Promise<RealTimeMetrics> {
    const cacheKey = `realtime_${period}_${routerType || 'all'}`;
    const cached = this.metricsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const now = new Date();
    const periodMs = period === '5min' ? 5 * 60 * 1000 : 
                     period === '1hour' ? 60 * 60 * 1000 : 
                     24 * 60 * 60 * 1000;
    const startTime = new Date(now.getTime() - periodMs);

    try {
      const [
        basicMetrics,
        modelMetrics,
        latencyHeatmap,
        topErrors,
        costBurnRate
      ] = await Promise.all([
        this.getBasicMetrics(startTime, now, routerType),
        this.getModelMetrics(startTime, now, routerType),
        this.getLatencyHeatmap(startTime, now, routerType),
        this.getTopErrors(startTime, now, routerType),
        this.getCostBurnRate(routerType)
      ]);

      const result: RealTimeMetrics = {
        timestamp: now,
        period,
        ...basicMetrics,
        costBurnRate,
        modelHealth: Array.from(this.modelHealthCache.values()),
        modelMetrics,
        latencyHeatmap,
        topErrors
      };

      this.metricsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error: unknown) {
      logger.error('[RouterMetrics] Failed to get real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Get basic aggregated metrics
   */
  private async getBasicMetrics(startTime: Date, endTime: Date, routerType?: 'end-user' | 'internal'): Promise<{
    totalRequests: number;
    totalCost: number;
    avgLatency: number;
    errorRate: number;
  }> {
    const matchQuery: any = {
      timestamp: { $gte: startTime, $lte: endTime }
    };
    
    // Filter by routerType if specified
    if (routerType) {
      matchQuery.routerType = routerType;
    }
    
    const result = await LLMUsage.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalCost: { $sum: '$totalCost' },
          avgLatency: { $avg: '$latencyMs' },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
          }
        }
      }
    ]);

    if (result.length === 0) {
      return { totalRequests: 0, totalCost: 0, avgLatency: 0, errorRate: 0 };
    }

    const data = result[0];
    return {
      totalRequests: data.totalRequests || 0,
      totalCost: data.totalCost || 0,
      avgLatency: Math.round(data.avgLatency || 0),
      errorRate: data.totalRequests > 0 
        ? (data.errorCount / data.totalRequests) * 100 
        : 0
    };
  }

  /**
   * Get per-model metrics with latency percentiles
   */
  private async getModelMetrics(startTime: Date, endTime: Date, routerType?: 'end-user' | 'internal'): Promise<ModelMetrics[]> {
    const matchQuery: any = {
      timestamp: { $gte: startTime, $lte: endTime }
    };
    
    // Filter by routerType if specified
    if (routerType) {
      matchQuery.routerType = routerType;
    }
    
    const result = await LLMUsage.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: { modelId: '$modelId', provider: '$provider' },
          requestCount: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] }
          },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
          },
          totalTokens: { $sum: '$totalTokens' },
          totalCost: { $sum: '$totalCost' },
          latencies: { $push: '$latencyMs' }
        }
      }
    ]);

    return result.map(r => {
      const latencies = (r.latencies || []).filter((l: number) => l != null).sort((a: number, b: number) => a - b);
      const percentiles = this.calculatePercentiles(latencies);
      
      return {
        modelId: r._id.modelId,
        provider: r._id.provider,
        requestCount: r.requestCount,
        successCount: r.successCount,
        errorCount: r.errorCount,
        totalTokens: r.totalTokens,
        totalCost: r.totalCost,
        avgLatency: latencies.length > 0 
          ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
          : 0,
        latencyPercentiles: percentiles,
        errorRate: r.requestCount > 0 ? (r.errorCount / r.requestCount) * 100 : 0
      };
    });
  }

  /**
   * Calculate latency percentiles
   */
  private calculatePercentiles(sortedLatencies: number[]): LatencyPercentiles {
    if (sortedLatencies.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const getPercentile = (arr: number[], p: number): number => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return Math.round(arr[Math.max(0, index)] || 0);
    };

    return {
      p50: getPercentile(sortedLatencies, 50),
      p75: getPercentile(sortedLatencies, 75),
      p90: getPercentile(sortedLatencies, 90),
      p95: getPercentile(sortedLatencies, 95),
      p99: getPercentile(sortedLatencies, 99)
    };
  }

  /**
   * Get latency heatmap data (by hour and model)
   */
  private async getLatencyHeatmap(startTime: Date, endTime: Date, routerType?: 'end-user' | 'internal'): Promise<HourlyMetric[]> {
    const matchQuery: any = {
      timestamp: { $gte: startTime, $lte: endTime }
    };
    
    // Filter by routerType if specified
    if (routerType) {
      matchQuery.routerType = routerType;
    }
    
    const result = await LLMUsage.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: {
            hour: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$timestamp' } },
            modelId: '$modelId'
          },
          avgLatency: { $avg: '$latencyMs' },
          requestCount: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.hour': 1 }
      }
    ]);

    return result.map(r => ({
      hour: r._id.hour,
      modelId: r._id.modelId,
      avgLatency: Math.round(r.avgLatency || 0),
      requestCount: r.requestCount,
      errorRate: r.requestCount > 0 ? (r.errorCount / r.requestCount) * 100 : 0
    }));
  }

  /**
   * Get top errors
   */
  private async getTopErrors(startTime: Date, endTime: Date, routerType?: 'end-user' | 'internal'): Promise<Array<{ error: string; count: number; lastOccurred: Date }>> {
    const matchQuery: any = {
      timestamp: { $gte: startTime, $lte: endTime },
      success: false,
      errorMessage: { $exists: true, $ne: null }
    };
    
    // Filter by routerType if specified
    if (routerType) {
      matchQuery.routerType = routerType;
    }
    
    const result = await LLMUsage.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: '$errorMessage',
          count: { $sum: 1 },
          lastOccurred: { $max: '$timestamp' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return result.map(r => ({
      error: r._id,
      count: r.count,
      lastOccurred: r.lastOccurred
    }));
  }

  /**
   * Calculate cost burn rate
   */
  private async getCostBurnRate(routerType?: 'end-user' | 'internal'): Promise<CostBurnRate> {
    const now = new Date();
    
    // Get costs for different periods
    const [hourly, daily, weekly] = await Promise.all([
      this.getCostForPeriod(new Date(now.getTime() - 60 * 60 * 1000), now, routerType),
      this.getCostForPeriod(new Date(now.getTime() - 24 * 60 * 60 * 1000), now, routerType),
      this.getCostForPeriod(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now, routerType)
    ]);

    // Calculate monthly from daily average
    const dailyAvg = daily;
    const monthly = dailyAvg * 30;
    
    // Project based on current week's trend
    const weeklyAvgDaily = weekly / 7;
    const projectedMonthly = weeklyAvgDaily * 30;

    return {
      hourly,
      daily,
      weekly,
      monthly,
      projectedMonthly
    };
  }

  /**
   * Get total cost for a period
   */
  private async getCostForPeriod(startTime: Date, endTime: Date, routerType?: 'end-user' | 'internal'): Promise<number> {
    const matchQuery: any = {
      timestamp: { $gte: startTime, $lte: endTime }
    };
    
    // Filter by routerType if specified
    if (routerType) {
      matchQuery.routerType = routerType;
    }
    
    const result = await LLMUsage.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$totalCost' }
        }
      }
    ]);

    return result.length > 0 ? result[0].totalCost : 0;
  }

  /**
   * Update model health status
   */
  private async updateModelHealth(): Promise<void> {
    // Check if MongoDB is connected before querying
    if (mongoose.connection.readyState !== 1) {
      logger.debug('[RouterMetrics] MongoDB not connected, skipping health update');
      return;
    }

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Get recent usage for each model
    const result = await LLMUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: fiveMinutesAgo }
        }
      },
      {
        $group: {
          _id: { modelId: '$modelId', provider: '$provider' },
          requestCount: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] }
          },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
          },
          avgLatency: { $avg: '$latencyMs' },
          lastError: { $last: '$errorMessage' }
        }
      }
    ]);

    // Update health cache
    for (const r of result) {
      const successRate = r.requestCount > 0 
        ? (r.successCount / r.requestCount) * 100 
        : 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (successRate < 50) {
        status = 'unhealthy';
      } else if (successRate < 90 || r.avgLatency > 5000) {
        status = 'degraded';
      }

      this.modelHealthCache.set(r._id.modelId, {
        modelId: r._id.modelId,
        provider: r._id.provider,
        status,
        successRate,
        avgLatency: Math.round(r.avgLatency || 0),
        errorCount: r.errorCount,
        lastError: r.lastError,
        lastUpdated: now
      });
    }

    // Add healthy status for models with no recent traffic
    const activeModels = modelRegistry.getActiveModels();
    for (const model of activeModels) {
      if (!this.modelHealthCache.has(model.id)) {
        this.modelHealthCache.set(model.id, {
          modelId: model.id,
          provider: model.provider,
          status: 'healthy',
          successRate: 100,
          avgLatency: 0,
          errorCount: 0,
          lastUpdated: now
        });
      }
    }
  }

  /**
   * Get current model health
   */
  getModelHealth(): ModelHealthStatus[] {
    return Array.from(this.modelHealthCache.values());
  }

  /**
   * Get metrics for a specific model
   */
  async getModelSpecificMetrics(modelId: string, hours: number = 24): Promise<{
    hourlyBreakdown: Array<{ hour: string; requests: number; cost: number; avgLatency: number; errorRate: number }>;
    totalRequests: number;
    totalCost: number;
    avgLatency: number;
    errorRate: number;
    latencyPercentiles: LatencyPercentiles;
  }> {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const [hourlyData, overallData] = await Promise.all([
      LLMUsage.aggregate([
        {
          $match: {
            modelId,
            timestamp: { $gte: startTime, $lte: now }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$timestamp' } },
            requests: { $sum: 1 },
            cost: { $sum: '$totalCost' },
            avgLatency: { $avg: '$latencyMs' },
            errors: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      LLMUsage.aggregate([
        {
          $match: {
            modelId,
            timestamp: { $gte: startTime, $lte: now }
          }
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalCost: { $sum: '$totalCost' },
            latencies: { $push: '$latencyMs' },
            errors: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } }
          }
        }
      ])
    ]);

    const overall = overallData[0] || { totalRequests: 0, totalCost: 0, latencies: [], errors: 0 };
    const latencies = (overall.latencies || []).filter((l: number) => l != null).sort((a: number, b: number) => a - b);

    return {
      hourlyBreakdown: hourlyData.map(h => ({
        hour: h._id,
        requests: h.requests,
        cost: h.cost,
        avgLatency: Math.round(h.avgLatency || 0),
        errorRate: h.requests > 0 ? (h.errors / h.requests) * 100 : 0
      })),
      totalRequests: overall.totalRequests,
      totalCost: overall.totalCost,
      avgLatency: latencies.length > 0 
        ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
        : 0,
      errorRate: overall.totalRequests > 0 
        ? (overall.errors / overall.totalRequests) * 100 
        : 0,
      latencyPercentiles: this.calculatePercentiles(latencies)
    };
  }

  /**
   * Get error sparkline data (for mini charts)
   */
  async getErrorSparkline(modelId: string, points: number = 12): Promise<number[]> {
    const now = new Date();
    const intervalMs = (60 * 60 * 1000) / points; // Divide 1 hour into points
    
    const result = await LLMUsage.aggregate([
      {
        $match: {
          modelId,
          timestamp: { $gte: new Date(now.getTime() - 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $floor: {
              $divide: [
                { $subtract: ['$timestamp', new Date(now.getTime() - 60 * 60 * 1000)] },
                intervalMs
              ]
            }
          },
          errors: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing intervals with 0
    const sparkline: number[] = new Array(points).fill(0);
    for (const r of result) {
      if (r._id >= 0 && r._id < points) {
        sparkline[r._id] = r.errors;
      }
    }

    return sparkline;
  }

  /**
   * Clear metrics cache
   */
  clearCache(): void {
    this.metricsCache.clear();
  }
}

export const routerMetricsService = new RouterMetricsService();
export default routerMetricsService;

