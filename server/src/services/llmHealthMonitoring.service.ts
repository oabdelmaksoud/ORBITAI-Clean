/**
 * LLM Provider Health Monitoring Service
 * Monitors uptime, response times, error rates, and health scores
 */

import { logger } from '../utils/logger.js';
import { LLMUsage } from '../models/LLMUsage.model.js';

export interface ProviderHealthMetrics {
  provider: string;
  uptime: number; // percentage (0-100)
  averageResponseTime: number; // milliseconds
  errorRate: number; // percentage (0-100)
  rateLimitFrequency: number; // rate limit errors per 1000 requests
  healthScore: number; // 0-100
  lastChecked: Date;
  trends: {
    responseTime: number[]; // Last 24 hours
    errorRate: number[];
    uptime: number[];
  };
}

export interface ProviderHealthReport {
  providers: ProviderHealthMetrics[];
  overallHealth: number; // 0-100
  unhealthyProviders: Array<{
    provider: string;
    healthScore: number;
    issues: string[];
  }>;
  generatedAt: Date;
}

class LLMHealthMonitoringService {
  /**
   * Calculate provider health metrics
   */
  async calculateHealthMetrics(
    provider: string,
    hours: number = 24
  ): Promise<ProviderHealthMetrics> {
    try {
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const usageRecords = await LLMUsage.find({
        provider,
        timestamp: { $gte: startDate }
      }).lean();

      if (usageRecords.length === 0) {
        return {
          provider,
          uptime: 0,
          averageResponseTime: 0,
          errorRate: 0,
          rateLimitFrequency: 0,
          healthScore: 0,
          lastChecked: new Date(),
          trends: {
            responseTime: [],
            errorRate: [],
            uptime: []
          }
        };
      }

      // Calculate metrics
      const successful = usageRecords.filter(r => r.success).length;
      const failed = usageRecords.length - successful;
      const uptime = (successful / usageRecords.length) * 100;
      const errorRate = (failed / usageRecords.length) * 100;

      // Calculate average response time
      const responseTimes = usageRecords
        .filter(r => r.latencyMs)
        .map(r => r.latencyMs!);
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

      // Count rate limit errors
      const rateLimitErrors = usageRecords.filter(r =>
        r.errorMessage?.toLowerCase().includes('rate limit') ||
        r.errorMessage?.includes('429')
      ).length;
      const rateLimitFrequency = (rateLimitErrors / usageRecords.length) * 1000;

      // Calculate health score
      const healthScore = this.calculateHealthScore(
        uptime,
        errorRate,
        averageResponseTime,
        rateLimitFrequency
      );

      // Calculate trends
      const trends = this.calculateTrends(usageRecords, hours);

      return {
        provider,
        uptime: Math.round(uptime * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        rateLimitFrequency: Math.round(rateLimitFrequency * 100) / 100,
        healthScore: Math.round(healthScore),
        lastChecked: new Date(),
        trends
      };
    } catch (error: unknown) {
      logger.error('Failed to calculate provider health metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(
    uptime: number,
    errorRate: number,
    averageResponseTime: number,
    rateLimitFrequency: number
  ): number {
    let score = 100;

    // Penalize for low uptime
    score -= (100 - uptime) * 0.5;

    // Penalize for high error rate
    score -= errorRate * 0.3;

    // Penalize for slow response (if > 5s average)
    if (averageResponseTime > 5000) {
      score -= ((averageResponseTime - 5000) / 1000) * 2;
    }

    // Penalize for frequent rate limits
    if (rateLimitFrequency > 10) {
      score -= (rateLimitFrequency - 10) * 0.5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate trends
   */
  private calculateTrends(
    records: any[],
    hours: number
  ): ProviderHealthMetrics['trends'] {
    // Group by hour
    const hourlyData = new Map<string, {
      success: number;
      total: number;
      responseTime: number[];
      errors: number;
    }>();

    for (const record of records) {
      const hour = new Date(record.timestamp).toISOString().substring(0, 13); // YYYY-MM-DDTHH
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, { success: 0, total: 0, responseTime: [], errors: 0 });
      }

      const data = hourlyData.get(hour)!;
      data.total++;
      if (record.success) {
        data.success++;
        if (record.latencyMs) {
          data.responseTime.push(record.latencyMs);
        }
      } else {
        data.errors++;
      }
    }

    // Convert to arrays
    const responseTime: number[] = [];
    const errorRate: number[] = [];
    const uptime: number[] = [];

    for (const [_, data] of Array.from(hourlyData.entries()).sort()) {
      responseTime.push(
        data.responseTime.length > 0
          ? data.responseTime.reduce((sum, t) => sum + t, 0) / data.responseTime.length
          : 0
      );
      errorRate.push(data.total > 0 ? (data.errors / data.total) * 100 : 0);
      uptime.push(data.total > 0 ? (data.success / data.total) * 100 : 0);
    }

    return { responseTime, errorRate, uptime };
  }

  /**
   * Generate health report
   */
  async generateHealthReport(): Promise<ProviderHealthReport> {
    try {
      const providers = ['gemini', 'openai', 'anthropic', 'mistral', 'deepseek', 'qwen', 'grok'];
      const metrics: ProviderHealthMetrics[] = [];

      for (const provider of providers) {
        const health = await this.calculateHealthMetrics(provider);
        metrics.push(health);
      }

      // Calculate overall health
      const overallHealth = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.healthScore, 0) / metrics.length
        : 0;

      // Identify unhealthy providers
      const unhealthyProviders = metrics
        .filter(m => m.healthScore < 70)
        .map(m => ({
          provider: m.provider,
          healthScore: m.healthScore,
          issues: this.identifyIssues(m)
        }));

      return {
        providers: metrics,
        overallHealth: Math.round(overallHealth),
        unhealthyProviders,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to generate health report:', error);
      throw error;
    }
  }

  /**
   * Identify health issues
   */
  private identifyIssues(metrics: ProviderHealthMetrics): string[] {
    const issues: string[] = [];

    if (metrics.uptime < 95) {
      issues.push(`Low uptime: ${metrics.uptime}%`);
    }

    if (metrics.errorRate > 5) {
      issues.push(`High error rate: ${metrics.errorRate}%`);
    }

    if (metrics.averageResponseTime > 10000) {
      issues.push(`Slow response time: ${(metrics.averageResponseTime / 1000).toFixed(1)}s average`);
    }

    if (metrics.rateLimitFrequency > 10) {
      issues.push(`Frequent rate limits: ${metrics.rateLimitFrequency} per 1000 requests`);
    }

    return issues;
  }

  /**
   * Auto-disable unhealthy providers
   */
  async checkAndDisableUnhealthy(threshold: number = 50): Promise<string[]> {
    const report = await this.generateHealthReport();
    const disabled: string[] = [];

    for (const provider of report.providers) {
      if (provider.healthScore < threshold) {
        // Would disable provider in model registry
        logger.warn(`Provider ${provider.provider} health score (${provider.healthScore}) below threshold (${threshold}), should be disabled`);
        disabled.push(provider.provider);
      }
    }

    return disabled;
  }
}

export const llmHealthMonitoringService = new LLMHealthMonitoringService();



