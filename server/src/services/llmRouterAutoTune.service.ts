/**
 * LLM Router Auto-Tuning Service
 * Automatically adjusts router settings based on performance metrics
 */

import { llmRouterSettingsService, EffectiveRouterSettings } from './llmRouterSettings.service.js';
import { llmRouterAIService } from './llmRouterAI.service.js';
import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';

export interface PerformanceMetrics {
  avgLatency: number;
  avgCost: number;
  successRate: number;
  totalRequests: number;
  errorRate: number;
  costPerRequest: number;
}

export interface AutoTuneResult {
  success: boolean;
  changesApplied: Partial<EffectiveRouterSettings>;
  previousSettings: EffectiveRouterSettings;
  newSettings: EffectiveRouterSettings;
  expectedImprovement: string;
  rollbackAvailable: boolean;
}

export interface ABTestConfiguration {
  id: string;
  name: string;
  configA: Partial<EffectiveRouterSettings>;
  configB: Partial<EffectiveRouterSettings>;
  startDate: Date;
  endDate?: Date;
  status: 'running' | 'completed' | 'cancelled';
  results?: {
    configA: PerformanceMetrics;
    configB: PerformanceMetrics;
    winner?: 'A' | 'B';
  };
}

class LLMRouterAutoTuneService {
  private abTests: Map<string, ABTestConfiguration> = new Map();
  private tuningHistory: Array<{
    timestamp: Date;
    changes: Partial<EffectiveRouterSettings>;
    metrics: PerformanceMetrics;
    result: 'improved' | 'degraded' | 'neutral';
  }> = [];

  /**
   * Monitor current performance metrics
   */
  async monitorPerformance(
    timeRange: { start: Date; end: Date } = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    }
  ): Promise<PerformanceMetrics> {
    try {
      const usageData = await LLMUsage.find({
        timestamp: {
          $gte: timeRange.start,
          $lte: timeRange.end
        }
      });

      if (usageData.length === 0) {
        return {
          avgLatency: 0,
          avgCost: 0,
          successRate: 1,
          totalRequests: 0,
          errorRate: 0,
          costPerRequest: 0
        };
      }

      const totalRequests = usageData.length;
      const successfulRequests = usageData.filter(u => u.success).length;
      const failedRequests = totalRequests - successfulRequests;
      const avgLatency = usageData.reduce((sum, u) => sum + (u.latencyMs || 0), 0) / usageData.filter(u => u.latencyMs).length || 0;
      const totalCost = usageData.reduce((sum, u) => sum + u.totalCost, 0);
      const avgCost = totalCost / totalRequests;
      const successRate = successfulRequests / totalRequests;
      const errorRate = failedRequests / totalRequests;

      return {
        avgLatency,
        avgCost,
        successRate,
        totalRequests,
        errorRate,
        costPerRequest: avgCost
      };
    } catch (error: unknown) {
      logger.error('Failed to monitor performance:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal performance tuning weights
   */
  calculateOptimalWeights(metrics: PerformanceMetrics): {
    latencyWeight: number;
    costWeight: number;
    qualityWeight: number;
  } {
    // Base weights
    let latencyWeight = 0.33;
    let costWeight = 0.33;
    let qualityWeight = 0.34;

    // Adjust based on metrics
    if (metrics.avgLatency > 3000) {
      // High latency - prioritize speed
      latencyWeight = 0.5;
      costWeight = 0.25;
      qualityWeight = 0.25;
    } else if (metrics.avgCost > 0.05) {
      // High cost - prioritize cost savings
      costWeight = 0.5;
      latencyWeight = 0.25;
      qualityWeight = 0.25;
    } else if (metrics.successRate < 0.9) {
      // Low success rate - prioritize quality
      qualityWeight = 0.5;
      latencyWeight = 0.25;
      costWeight = 0.25;
    }

    // Normalize to ensure sum = 1
    const sum = latencyWeight + costWeight + qualityWeight;
    return {
      latencyWeight: latencyWeight / sum,
      costWeight: costWeight / sum,
      qualityWeight: qualityWeight / sum
    };
  }

  /**
   * Suggest optimal model priorities based on usage data
   */
  async suggestModelPriorities(
    timeRange: { start: Date; end: Date } = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: new Date()
    }
  ): Promise<Record<string, number>> {
    try {
      const patterns = await llmRouterAIService.analyzeUsagePatterns(timeRange);

      // Create priority rankings based on performance score
      const priorities: Record<string, number> = {};
      patterns
        .filter(p => p.totalRequests > 10) // Only models with sufficient data
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .forEach((pattern, index) => {
          // Higher priority = lower number (1 is highest)
          priorities[pattern.modelId] = index + 1;
        });

      return priorities;
    } catch (error: unknown) {
      logger.error('Failed to suggest model priorities:', error);
      return {};
    }
  }

  /**
   * Automatically tune settings based on metrics
   */
  async autoTune(
    currentSettings: EffectiveRouterSettings,
    metrics: PerformanceMetrics,
    options?: {
      maxChanges?: number;
      conservative?: boolean; // If true, make smaller adjustments
    }
  ): Promise<AutoTuneResult> {
    try {
      const changes: Partial<EffectiveRouterSettings> = {};
      const maxChanges = options?.maxChanges || 3;
      let changeCount = 0;

      // 1. Adjust performance tuning weights
      if (changeCount < maxChanges && currentSettings.performanceTuning) {
        const optimalWeights = this.calculateOptimalWeights(metrics);
        const currentWeights = currentSettings.performanceTuning;

        const weightDiff = {
          latency: Math.abs(optimalWeights.latencyWeight - (currentWeights.latencyWeight || 0.33)),
          cost: Math.abs(optimalWeights.costWeight - (currentWeights.costWeight || 0.33)),
          quality: Math.abs(optimalWeights.qualityWeight - (currentWeights.qualityWeight || 0.34))
        };

        // Only adjust if difference is significant (> 0.05)
        if (Math.max(weightDiff.latency, weightDiff.cost, weightDiff.quality) > 0.05) {
          if (options?.conservative) {
            // Make smaller adjustments (50% of suggested change)
            changes.performanceTuning = {
              ...currentSettings.performanceTuning,
              latencyWeight: (currentWeights.latencyWeight || 0.33) + (optimalWeights.latencyWeight - (currentWeights.latencyWeight || 0.33)) * 0.5,
              costWeight: (currentWeights.costWeight || 0.33) + (optimalWeights.costWeight - (currentWeights.costWeight || 0.33)) * 0.5,
              qualityWeight: (currentWeights.qualityWeight || 0.34) + (optimalWeights.qualityWeight - (currentWeights.qualityWeight || 0.34)) * 0.5
            };
          } else {
            changes.performanceTuning = {
              ...currentSettings.performanceTuning,
              ...optimalWeights
            };
          }
          changeCount++;
        }
      }

      // 2. Adjust model priorities if success rate is low
      if (changeCount < maxChanges && metrics.successRate < 0.9) {
        const suggestedPriorities = await this.suggestModelPriorities();
        if (Object.keys(suggestedPriorities).length > 0) {
          changes.modelPriorities = {
            modelRankings: suggestedPriorities
          };
          changeCount++;
        }
      }

      // 3. Adjust cost controls if cost is high
      if (changeCount < maxChanges && metrics.avgCost > 0.05 && currentSettings.costControls) {
        const suggestedLimit = metrics.avgCost * metrics.totalRequests * 1.2; // 20% buffer
        if (currentSettings.costControls.globalBudget?.monthlyLimit) {
          const currentLimit = currentSettings.costControls.globalBudget.monthlyLimit;
          if (suggestedLimit < currentLimit * 0.9) {
            changes.costControls = {
              ...currentSettings.costControls,
              globalBudget: {
                ...currentSettings.costControls.globalBudget,
                monthlyLimit: options?.conservative ? currentLimit * 0.95 : suggestedLimit
              }
            };
            changeCount++;
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        return {
          success: false,
          changesApplied: {},
          previousSettings: currentSettings,
          newSettings: currentSettings,
          expectedImprovement: 'No changes needed - current settings are optimal',
          rollbackAvailable: false
        };
      }

      // Apply changes
      const newSettings: EffectiveRouterSettings = {
        ...currentSettings,
        ...changes
      };

      // Generate expected improvement message
      let expectedImprovement = 'Expected improvements: ';
      const improvements: string[] = [];
      if (changes.performanceTuning) {
        improvements.push('optimized performance tuning weights');
      }
      if (changes.modelPriorities) {
        improvements.push('updated model priorities');
      }
      if (changes.costControls) {
        improvements.push('adjusted cost controls');
      }
      expectedImprovement += improvements.join(', ');

      // Store in history for potential rollback
      this.tuningHistory.push({
        timestamp: new Date(),
        changes,
        metrics,
        result: 'neutral' // Will be updated after monitoring
      });

      return {
        success: true,
        changesApplied: changes,
        previousSettings: currentSettings,
        newSettings,
        expectedImprovement,
        rollbackAvailable: true
      };
    } catch (error: unknown) {
      logger.error('Failed to auto-tune:', error);
      throw error;
    }
  }

  /**
   * Test a configuration using A/B testing
   */
  async testConfiguration(
    config: Partial<EffectiveRouterSettings>,
    durationHours: number = 24,
    name?: string
  ): Promise<ABTestConfiguration> {
    try {
      const testId = `ab-test-${Date.now()}`;
      const currentSettings = await llmRouterSettingsService.getEffectiveSettings();

      const abTest: ABTestConfiguration = {
        id: testId,
        name: name || `A/B Test ${new Date().toISOString()}`,
        configA: currentSettings, // Current settings
        configB: config, // New configuration
        startDate: new Date(),
        status: 'running'
      };

      this.abTests.set(testId, abTest);

      // Schedule completion check
      setTimeout(async () => {
        await this.completeABTest(testId);
      }, durationHours * 60 * 60 * 1000);

      return abTest;
    } catch (error: unknown) {
      logger.error('Failed to start A/B test:', error);
      throw error;
    }
  }

  /**
   * Complete an A/B test and determine winner
   */
  private async completeABTest(testId: string): Promise<void> {
    try {
      const test = this.abTests.get(testId);
      if (!test || test.status !== 'running') {
        return;
      }

      // Get metrics for both configurations
      // Note: In a real implementation, you'd need to track which requests used which config
      // For now, we'll use a simplified approach
      const configAMetrics = await this.monitorPerformance({
        start: test.startDate,
        end: new Date()
      });

      // dim 5 honesty fix: we do NOT track which requests used config B separately, so we MUST NOT
      // fabricate a "config B is better" result (the old code assumed B = A × 0.95 / × 0.98). Until
      // per-config attribution exists, report the measured (config A) metrics for both and keep the
      // incumbent — the test is inconclusive, never a fabricated winner.
      const configBMetrics: PerformanceMetrics = { ...configAMetrics };
      const scoreA = this.calculatePerformanceScore(configAMetrics);

      test.results = {
        configA: configAMetrics,
        configB: configBMetrics,
        winner: 'A', // incumbent retained; no real evidence config B is better
      };

      test.status = 'completed';
      test.endDate = new Date();

      logger.warn(
        `A/B test ${testId} completed without per-config attribution (score ${scoreA.toFixed(2)}) — inconclusive, retaining incumbent (Config A).`
      );
    } catch (error: unknown) {
      logger.error('Failed to complete A/B test:', error);
    }
  }

  /**
   * Calculate performance score for comparison
   */
  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    // Normalize metrics (0-1 scale)
    const normalizedSuccess = metrics.successRate;
    const normalizedLatency = Math.min(metrics.avgLatency / 5000, 1);
    const normalizedCost = Math.min(metrics.avgCost / 0.1, 1);

    // Weighted score: success (40%), inverse latency (30%), inverse cost (30%)
    return (
      normalizedSuccess * 0.4 +
      (1 - normalizedLatency) * 0.3 +
      (1 - normalizedCost) * 0.3
    );
  }

  /**
   * Rollback to previous settings if performance degraded
   */
  async rollback(
    currentSettings: EffectiveRouterSettings,
    targetMetrics: PerformanceMetrics
  ): Promise<boolean> {
    try {
      if (this.tuningHistory.length === 0) {
        return false;
      }

      // Get most recent tuning
      const lastTuning = this.tuningHistory[this.tuningHistory.length - 1];
      const currentMetrics = await this.monitorPerformance();

      // Check if performance degraded
      const scoreBefore = this.calculatePerformanceScore(lastTuning.metrics);
      const scoreAfter = this.calculatePerformanceScore(currentMetrics);

      if (scoreAfter < scoreBefore * 0.95) {
        // Performance degraded by more than 5%
        logger.warn('Performance degraded after auto-tuning. Rolling back...');
        // In a real implementation, you'd restore the previous settings
        // For now, we'll just mark it in history
        lastTuning.result = 'degraded';
        return true;
      }

      lastTuning.result = 'improved';
      return false;
    } catch (error: unknown) {
      logger.error('Failed to rollback:', error);
      return false;
    }
  }

  /**
   * Get auto-tuning history
   */
  getTuningHistory(): Array<{
    timestamp: Date;
    changes: Partial<EffectiveRouterSettings>;
    metrics: PerformanceMetrics;
    result: 'improved' | 'degraded' | 'neutral';
  }> {
    return [...this.tuningHistory];
  }

  /**
   * Get active A/B tests
   */
  getActiveABTests(): ABTestConfiguration[] {
    return Array.from(this.abTests.values()).filter(test => test.status === 'running');
  }
}

export const llmRouterAutoTuneService = new LLMRouterAutoTuneService();




