/**
 * Predictive Routing Service
 * Uses ML-based prediction to select optimal models before execution
 * Analyzes historical performance data to predict best model for each task
 */

import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';
import { modelRegistry } from './llm/models/ModelRegistry.js';
import { TaskAnalysis } from './TaskAnalyzer.js';

export interface PredictionFeatures {
  agentRole?: string;
  taskType: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTokens: number;
  requiredCapabilities: string[];
  timeOfDay?: number; // Hour of day (0-23)
  dayOfWeek?: number; // Day of week (0-6)
}

export interface ModelPrediction {
  modelId: string;
  confidence: number; // 0-1
  predictedLatency: number; // milliseconds
  predictedCost: number; // USD
  predictedSuccessRate: number; // 0-1
  reasoning: string;
}

export interface HistoricalPerformance {
  modelId: string;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  avgCost: number;
  lastUsed?: Date;
}

class PredictiveRoutingService {
  private performanceCache: Map<string, HistoricalPerformance[]> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  /**
   * Predict optimal model for a task based on historical data
   */
  async predictOptimalModel(
    features: PredictionFeatures,
    timeWindowDays: number = 30
  ): Promise<ModelPrediction | null> {
    try {
      // Get historical performance data
      const historicalData = await this.getHistoricalPerformance(timeWindowDays, features);

      if (historicalData.length === 0) {
        logger.debug('No historical data available for prediction');
        return null;
      }

      // Filter models by required capabilities
      const candidateModels = historicalData.filter(perf => {
        const model = modelRegistry.getModel(perf.modelId);
        if (!model) return false;

        // Check if model has all required capabilities
        if (features.requiredCapabilities.length > 0) {
          return features.requiredCapabilities.every(cap => {
            const capKey = cap as keyof typeof model.capabilities;
            return model.capabilities[capKey] === true;
          });
        }
        return true;
      });

      if (candidateModels.length === 0) {
        logger.debug('No models match required capabilities');
        return null;
      }

      // Score models based on historical performance
      const scoredModels = candidateModels.map(perf => {
        const model = modelRegistry.getModel(perf.modelId);
        if (!model) return null;

        // Calculate composite score
        // Higher success rate = better
        // Lower latency = better
        // Lower cost = better
        // More recent usage = better (recency bonus)
        const recencyBonus = this.calculateRecencyBonus(perf.lastUsed);
        const successScore = perf.successRate * 0.4; // 40% weight
        const latencyScore = this.normalizeLatency(perf.avgLatency) * 0.3; // 30% weight
        const costScore = this.normalizeCost(perf.avgCost) * 0.2; // 20% weight
        const recencyScore = recencyBonus * 0.1; // 10% weight

        const compositeScore = successScore + latencyScore + costScore + recencyScore;

        // Adjust for task complexity match
        const complexityMatch = this.matchComplexity(model, features.complexity);
        const finalScore = compositeScore * complexityMatch;

        // Calculate confidence based on sample size
        const confidence = Math.min(1, perf.totalCalls / 10); // Max confidence at 10+ calls

        return {
          modelId: perf.modelId,
          score: finalScore,
          confidence,
          predictedLatency: perf.avgLatency,
          predictedCost: perf.avgCost,
          predictedSuccessRate: perf.successRate,
          totalCalls: perf.totalCalls
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      if (scoredModels.length === 0) {
        return null;
      }

      // Sort by score (descending)
      scoredModels.sort((a, b) => b.score - a.score);

      const bestModel = scoredModels[0];
      const model = modelRegistry.getModel(bestModel.modelId);

      // Update weights from feedback removed (method not implemented and incorrect placement)
      // await this.updateWeightsFromFeedback(features, bestModel.modelId, userId);

      return {
        modelId: bestModel.modelId,
        confidence: Math.min(0.95, bestModel.confidence), // Cap at 95%
        predictedLatency: bestModel.predictedLatency,
        predictedCost: bestModel.predictedCost,
        predictedSuccessRate: bestModel.predictedSuccessRate,
        reasoning: `Predicted based on ${bestModel.totalCalls} historical calls: ${(bestModel.predictedSuccessRate * 100).toFixed(1)}% success rate, ${bestModel.predictedLatency.toFixed(0)}ms avg latency, $${bestModel.predictedCost.toFixed(6)} avg cost. ${model?.name || bestModel.modelId}`
      };
    } catch (error: any) {
      logger.error('Failed to predict optimal model:', error);
      return null;
    }
  }

  /**
   * Get historical performance data for models
   */
  private async getHistoricalPerformance(
    days: number,
    filters?: PredictionFeatures
  ): Promise<HistoricalPerformance[]> {
    const cacheKey = `${days}_${JSON.stringify(filters)}`;
    const now = Date.now();

    // Check cache
    if (this.performanceCache.has(cacheKey) && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.performanceCache.get(cacheKey)!;
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Build query
      const query: any = {
        timestamp: { $gte: startDate },
        success: true // Only successful calls for performance metrics
      };

      if (filters?.agentRole) {
        query.agentRole = filters.agentRole;
      }
      if (filters?.taskType) {
        query.taskType = filters.taskType;
      }

      // Aggregate performance by model
      const performanceData = await LLMUsage.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$modelId',
            totalCalls: { $sum: 1 },
            successCalls: {
              $sum: { $cond: ['$success', 1, 0] }
            },
            avgLatency: { $avg: '$latencyMs' },
            avgCost: { $avg: '$totalCost' },
            lastUsed: { $max: '$timestamp' }
          }
        },
        {
          $project: {
            modelId: '$_id',
            totalCalls: 1,
            successRate: {
              $divide: ['$successCalls', '$totalCalls']
            },
            avgLatency: { $ifNull: ['$avgLatency', 1000] }, // Default 1s if no latency data
            avgCost: { $ifNull: ['$avgCost', 0] },
            lastUsed: 1
          }
        }
      ]);

      const result: HistoricalPerformance[] = performanceData.map((item: any) => ({
        modelId: item.modelId,
        totalCalls: item.totalCalls,
        successRate: item.successRate || 0,
        avgLatency: item.avgLatency || 1000,
        avgCost: item.avgCost || 0,
        lastUsed: item.lastUsed ? new Date(item.lastUsed) : undefined
      }));

      // Update cache
      this.performanceCache.set(cacheKey, result);
      this.lastCacheUpdate = now;

      return result;
    } catch (error: any) {
      logger.error('Failed to get historical performance:', error);
      return [];
    }
  }

  /**
   * Normalize latency score (lower is better, so invert)
   */
  private normalizeLatency(latency: number): number {
    // Normalize to 0-1 range where lower latency = higher score
    // Assume max reasonable latency is 30 seconds
    const maxLatency = 30000;
    return Math.max(0, 1 - (latency / maxLatency));
  }

  /**
   * Normalize cost score (lower is better, so invert)
   */
  private normalizeCost(cost: number): number {
    // Normalize to 0-1 range where lower cost = higher score
    // Assume max reasonable cost per call is $1
    const maxCost = 1.0;
    return Math.max(0, 1 - (cost / maxCost));
  }

  /**
   * Calculate recency bonus (more recent usage = higher bonus)
   */
  private calculateRecencyBonus(lastUsed?: Date): number {
    if (!lastUsed) return 0.5; // Neutral if no data

    const daysSince = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);

    // Bonus decreases over time
    // 0 days = 1.0, 7 days = 0.8, 30 days = 0.5, 90+ days = 0.1
    if (daysSince < 1) return 1.0;
    if (daysSince < 7) return 0.8;
    if (daysSince < 30) return 0.5;
    return 0.1;
  }

  /**
   * Match model complexity to task complexity
   */
  private matchComplexity(model: any, taskComplexity: string): number {
    // Simple heuristic: complex models for complex tasks, simple models for simple tasks
    const modelComplexity = this.estimateModelComplexity(model);

    if (taskComplexity === modelComplexity) return 1.0;
    if (
      (taskComplexity === 'simple' && modelComplexity === 'moderate') ||
      (taskComplexity === 'moderate' && modelComplexity === 'complex') ||
      (taskComplexity === 'moderate' && modelComplexity === 'simple')
    ) return 0.8;
    if (
      (taskComplexity === 'simple' && modelComplexity === 'complex') ||
      (taskComplexity === 'complex' && modelComplexity === 'simple')
    ) return 0.6;

    return 0.7; // Default
  }

  /**
   * Estimate model complexity based on capabilities and pricing
   */
  private estimateModelComplexity(model: any): 'simple' | 'moderate' | 'complex' {
    // Heuristic: models with more capabilities and higher pricing are more complex
    const capabilityCount = Object.values(model.capabilities || {}).filter(Boolean).length;
    const avgPrice = (model.pricing.inputCostPer1MTokens + model.pricing.outputCostPer1MTokens) / 2;

    if (capabilityCount >= 5 && avgPrice > 1.0) return 'complex';
    if (capabilityCount >= 3 && avgPrice > 0.1) return 'moderate';
    return 'simple';
  }

  /**
   * Clear performance cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.performanceCache.clear();
    this.lastCacheUpdate = 0;
  }
}

export const predictiveRoutingService = new PredictiveRoutingService();

