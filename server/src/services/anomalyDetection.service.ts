/**
 * Anomaly Detection Service
 * ML-based anomaly detection across all systems
 * Detects cost spikes, performance degradation, unusual patterns, and error spikes
 */

import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';

export interface Anomaly {
  id: string;
  type: 'cost_spike' | 'performance_degradation' | 'unusual_pattern' | 'error_spike' | 'usage_spike';
  severity: 'critical' | 'warning' | 'info';
  detectedAt: Date;
  description: string;
  metrics: Record<string, any>;
  suggestedAction?: string;
  affectedEntities?: {
    userId?: string;
    projectId?: string;
    modelId?: string;
    provider?: string;
  };
}

export interface AnomalyDetectionConfig {
  costSpikeThreshold?: number; // Multiplier for average cost (default: 3x)
  performanceDegradationThreshold?: number; // Percentage increase in latency (default: 50%)
  errorRateThreshold?: number; // Error rate percentage (default: 10%)
  minSamplesForDetection?: number; // Minimum samples needed (default: 10)
}

class AnomalyDetectionService {
  private config: AnomalyDetectionConfig = {
    costSpikeThreshold: 3.0,
    performanceDegradationThreshold: 0.5,
    errorRateThreshold: 0.1,
    minSamplesForDetection: 10
  };

  /**
   * Detect anomalies in LLM usage
   */
  async detectAnomalies(
    timeWindowHours: number = 24,
    filters?: {
      userId?: string;
      projectId?: string;
      modelId?: string;
      provider?: string;
    }
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindowHours * 60 * 60 * 1000);

    try {
      // Build query
      const query: any = {
        timestamp: { $gte: startTime }
      };
      if (filters?.userId) query.userId = filters.userId;
      if (filters?.projectId) query.projectId = filters.projectId;
      if (filters?.modelId) query.modelId = filters.modelId;
      if (filters?.provider) query.provider = filters.provider;

      // Get recent usage data
      const recentUsage = await LLMUsage.find(query)
        .sort({ timestamp: -1 })
        .lean();

      if (recentUsage.length < this.config.minSamplesForDetection!) {
        logger.debug(`Insufficient samples for anomaly detection: ${recentUsage.length}`);
        return [];
      }

      // Detect cost spikes
      const costAnomalies = await this.detectCostSpikes(recentUsage, filters);
      anomalies.push(...costAnomalies);

      // Detect performance degradation
      const performanceAnomalies = await this.detectPerformanceDegradation(recentUsage, filters);
      anomalies.push(...performanceAnomalies);

      // Detect error spikes
      const errorAnomalies = await this.detectErrorSpikes(recentUsage, filters);
      anomalies.push(...errorAnomalies);

      // Detect unusual patterns
      const patternAnomalies = await this.detectUnusualPatterns(recentUsage, filters);
      anomalies.push(...patternAnomalies);

      return anomalies.sort((a, b) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error: unknown) {
      logger.error('Failed to detect anomalies:', error);
      return [];
    }
  }

  /**
   * Detect cost spikes using statistical analysis
   */
  private async detectCostSpikes(
    recentUsage: any[],
    filters?: any
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      // Group by model/provider
      const groupedUsage = new Map<string, any[]>();
      recentUsage.forEach(usage => {
        const key = `${usage.modelId || 'unknown'}_${usage.provider || 'unknown'}`;
        if (!groupedUsage.has(key)) {
          groupedUsage.set(key, []);
        }
        groupedUsage.get(key)!.push(usage);
      });

      // Calculate baseline (average cost from last 7 days)
      const baselineStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const baselineQuery: any = {
        timestamp: { $gte: baselineStart, $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      };
      if (filters?.userId) baselineQuery.userId = filters.userId;
      if (filters?.projectId) baselineQuery.projectId = filters.projectId;

      const baselineUsage = await LLMUsage.find(baselineQuery).lean();
      const baselineAvgCost = baselineUsage.length > 0
        ? baselineUsage.reduce((sum, u) => sum + (u.totalCost || 0), 0) / baselineUsage.length
        : 0;

      // Check each group for spikes
      groupedUsage.forEach((usage, key) => {
        const recentCosts = usage.map((u: any) => u.totalCost || 0);
        const avgRecentCost = recentCosts.reduce((a: number, b: number) => a + b, 0) / recentCosts.length;

        if (baselineAvgCost > 0 && avgRecentCost > baselineAvgCost * this.config.costSpikeThreshold!) {
          const [modelId, provider] = key.split('_');
          anomalies.push({
            id: `cost_spike_${Date.now()}_${key}`,
            type: 'cost_spike',
            severity: avgRecentCost > baselineAvgCost * 5 ? 'critical' : 'warning',
            detectedAt: new Date(),
            description: `Cost spike detected: ${provider} ${modelId} average cost increased from $${baselineAvgCost.toFixed(6)} to $${avgRecentCost.toFixed(6)} (${((avgRecentCost / baselineAvgCost - 1) * 100).toFixed(1)}% increase)`,
            metrics: {
              baselineAvgCost,
              recentAvgCost: avgRecentCost,
              multiplier: avgRecentCost / baselineAvgCost,
              sampleCount: recentCosts.length
            },
            suggestedAction: 'Review model usage patterns and consider switching to more cost-effective models for similar tasks',
            affectedEntities: {
              modelId,
              provider
            }
          });
        }
      });
    } catch (error: unknown) {
      logger.error('Failed to detect cost spikes:', error);
    }

    return anomalies;
  }

  /**
   * Detect performance degradation
   */
  private async detectPerformanceDegradation(
    recentUsage: any[],
    filters?: any
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      // Get baseline latency (last 7 days, excluding last 24 hours)
      const baselineStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const baselineEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const baselineQuery: any = {
        timestamp: { $gte: baselineStart, $lt: baselineEnd },
        latencyMs: { $exists: true, $ne: null }
      };
      if (filters?.userId) baselineQuery.userId = filters.userId;
      if (filters?.projectId) baselineQuery.projectId = filters.projectId;

      const baselineUsage = await LLMUsage.find(baselineQuery).lean();
      const baselineAvgLatency = baselineUsage.length > 0
        ? baselineUsage.reduce((sum, u) => sum + (u.latencyMs || 0), 0) / baselineUsage.length
        : 0;

      if (baselineAvgLatency === 0) return [];

      // Calculate recent average latency
      const recentLatencies = recentUsage
        .filter(u => u.latencyMs && u.latencyMs > 0)
        .map(u => u.latencyMs);
      
      if (recentLatencies.length < this.config.minSamplesForDetection!) return [];

      const recentAvgLatency = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
      const latencyIncrease = (recentAvgLatency - baselineAvgLatency) / baselineAvgLatency;

      if (latencyIncrease > this.config.performanceDegradationThreshold!) {
        anomalies.push({
          id: `perf_degradation_${Date.now()}`,
          type: 'performance_degradation',
          severity: latencyIncrease > 1.0 ? 'critical' : 'warning', // >100% increase = critical
          detectedAt: new Date(),
          description: `Performance degradation detected: Average latency increased from ${baselineAvgLatency.toFixed(0)}ms to ${recentAvgLatency.toFixed(0)}ms (${(latencyIncrease * 100).toFixed(1)}% increase)`,
          metrics: {
            baselineAvgLatency,
            recentAvgLatency,
            latencyIncrease,
            sampleCount: recentLatencies.length
          },
          suggestedAction: 'Check provider status, network conditions, or consider switching to faster models',
          affectedEntities: filters
        });
      }
    } catch (error: unknown) {
      logger.error('Failed to detect performance degradation:', error);
    }

    return anomalies;
  }

  /**
   * Detect error spikes
   */
  private async detectErrorSpikes(
    recentUsage: any[],
    filters?: any
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      const totalCalls = recentUsage.length;
      const failedCalls = recentUsage.filter(u => !u.success).length;
      const errorRate = totalCalls > 0 ? failedCalls / totalCalls : 0;

      if (errorRate > this.config.errorRateThreshold!) {
        // Group by model/provider to identify problematic models
        const errorByModel = new Map<string, number>();
        recentUsage.filter(u => !u.success).forEach(u => {
          const key = `${u.modelId || 'unknown'}_${u.provider || 'unknown'}`;
          errorByModel.set(key, (errorByModel.get(key) || 0) + 1);
        });

        errorByModel.forEach((count, key) => {
          const [modelId, provider] = key.split('_');
          const modelErrorRate = count / totalCalls;

          if (modelErrorRate > this.config.errorRateThreshold!) {
            anomalies.push({
              id: `error_spike_${Date.now()}_${key}`,
              type: 'error_spike',
              severity: modelErrorRate > 0.3 ? 'critical' : 'warning',
              detectedAt: new Date(),
              description: `Error spike detected: ${provider} ${modelId} has ${(modelErrorRate * 100).toFixed(1)}% error rate (${count} failures out of ${totalCalls} total calls)`,
              metrics: {
                errorRate: modelErrorRate,
                failureCount: count,
                totalCalls
              },
              suggestedAction: 'Check API key validity, provider status, or switch to alternative models',
              affectedEntities: {
                modelId,
                provider
              }
            });
          }
        });
      }
    } catch (error: unknown) {
      logger.error('Failed to detect error spikes:', error);
    }

    return anomalies;
  }

  /**
   * Detect unusual patterns using simple heuristics
   */
  private async detectUnusualPatterns(
    recentUsage: any[],
    filters?: any
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      // Detect unusual usage times (e.g., very late night usage might indicate automation issues)
      const hourCounts = new Map<number, number>();
      recentUsage.forEach(u => {
        const hour = new Date(u.timestamp).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });

      // Check for unusual concentration in specific hours
      const totalCalls = recentUsage.length;
      hourCounts.forEach((count, hour) => {
        const concentration = count / totalCalls;
        // If >50% of calls are in a single hour, that's unusual
        if (concentration > 0.5 && totalCalls > 20) {
          anomalies.push({
            id: `unusual_pattern_${Date.now()}_hour_${hour}`,
            type: 'unusual_pattern',
            severity: 'info',
            detectedAt: new Date(),
            description: `Unusual usage pattern: ${(concentration * 100).toFixed(1)}% of calls occurred during hour ${hour}:00`,
            metrics: {
              hour,
              concentration,
              callCount: count,
              totalCalls
            },
            suggestedAction: 'This may indicate automated batch processing or potential abuse',
            affectedEntities: filters
          });
        }
      });

      // Detect unusual token usage patterns
      const tokenUsages = recentUsage.map(u => u.totalTokens || 0).filter(t => t > 0);
      if (tokenUsages.length > 0) {
        const avgTokens = tokenUsages.reduce((a, b) => a + b, 0) / tokenUsages.length;
        const maxTokens = Math.max(...tokenUsages);
        
        // If max is >10x average, that's unusual
        if (maxTokens > avgTokens * 10 && avgTokens > 0) {
          anomalies.push({
            id: `unusual_pattern_${Date.now()}_tokens`,
            type: 'unusual_pattern',
            severity: 'warning',
            detectedAt: new Date(),
            description: `Unusual token usage: Maximum token usage (${maxTokens.toLocaleString()}) is ${(maxTokens / avgTokens).toFixed(1)}x the average (${avgTokens.toFixed(0)})`,
            metrics: {
              avgTokens,
              maxTokens,
              multiplier: maxTokens / avgTokens
            },
            suggestedAction: 'Review large token usage requests - may indicate inefficient prompts or context issues',
            affectedEntities: filters
          });
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to detect unusual patterns:', error);
    }

    return anomalies;
  }

  /**
   * Update detection configuration
   */
  updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();




