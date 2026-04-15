/**
 * LLM Router AI Service
 * Analyzes usage patterns, provides recommendations, detects anomalies, and predicts optimal routing
 */

import { LLMUsage } from '../models/LLMUsage.model.js';
import { EffectiveRouterSettings } from './llmRouterSettings.service.js';
import { logger } from '../utils/logger.js';
import { modelRegistry } from './llm/models/ModelRegistry.js';

export interface UsagePattern {
  agentRole?: string;
  taskType?: string;
  modelId: string;
  provider: string;
  avgLatency: number;
  avgCost: number;
  successRate: number;
  totalRequests: number;
  avgTokens: number;
  performanceScore: number; // Combined score based on latency, cost, success rate
}

export interface AIRecommendation {
  type: 'routing_rule' | 'cost_control' | 'model_priority' | 'performance_tuning' | 'budget_limit';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string; // Expected impact (e.g., "Reduce costs by 30%")
  confidence: number; // 0-1 confidence score
  suggestedChanges: Record<string, any>;
  reasoning: string;
}

export interface Anomaly {
  type: 'cost_spike' | 'performance_degradation' | 'unusual_pattern' | 'error_spike';
  severity: 'critical' | 'warning' | 'info';
  detectedAt: Date;
  description: string;
  metrics: Record<string, any>;
  suggestedAction?: string;
}

export interface ModelPrediction {
  modelId: string;
  provider: string;
  confidence: number;
  estimatedCost: number;
  estimatedLatency: number;
  reasoning: string;
  alternatives: Array<{
    modelId: string;
    confidence: number;
    estimatedCost: number;
    estimatedLatency: number;
  }>;
}

class LLMRouterAIService {
  /**
   * Analyze usage patterns from historical data
   */
  async analyzeUsagePatterns(
    timeRange: { start: Date; end: Date },
    filters?: {
      agentRole?: string;
      taskType?: string;
      provider?: string;
    }
  ): Promise<UsagePattern[]> {
    try {
      const query: any = {
        timestamp: {
          $gte: timeRange.start,
          $lte: timeRange.end
        },
        success: true
      };

      if (filters?.agentRole) query.agentRole = filters.agentRole;
      if (filters?.taskType) query.taskType = filters.taskType;
      if (filters?.provider) query.provider = filters.provider;

      const usageData = await LLMUsage.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              modelId: '$modelId',
              provider: '$provider',
              agentRole: '$agentRole',
              taskType: '$taskType'
            },
            avgLatency: { $avg: '$latencyMs' },
            avgCost: { $avg: '$totalCost' },
            successRate: {
              $avg: { $cond: ['$success', 1, 0] }
            },
            totalRequests: { $sum: 1 },
            avgTokens: { $avg: '$totalTokens' },
            totalCost: { $sum: '$totalCost' }
          }
        },
        {
          $project: {
            _id: 0,
            agentRole: '$_id.agentRole',
            taskType: '$_id.taskType',
            modelId: '$_id.modelId',
            provider: '$_id.provider',
            avgLatency: { $ifNull: ['$avgLatency', 0] },
            avgCost: { $ifNull: ['$avgCost', 0] },
            successRate: { $ifNull: ['$successRate', 0] },
            totalRequests: 1,
            avgTokens: { $ifNull: ['$avgTokens', 0] },
            totalCost: 1
          }
        }
      ]);

      // Calculate performance scores
      const patterns: UsagePattern[] = usageData.map((data: any) => {
        // Normalize metrics (0-1 scale)
        const normalizedLatency = Math.min(data.avgLatency / 5000, 1); // Assume 5s is max
        const normalizedCost = Math.min(data.avgCost / 0.1, 1); // Assume $0.1 is max per request
        const normalizedSuccess = data.successRate;

        // Performance score: number;

        // Performance score: higher is better
        // Weight: success rate (40%), inverse latency (30%), inverse cost (30%)
        const performanceScore =
          normalizedSuccess * 0.4 +
          (1 - normalizedLatency) * 0.3 +
          (1 - normalizedCost) * 0.3;

        return {
          agentRole: data.agentRole,
          taskType: data.taskType,
          modelId: data.modelId,
          provider: data.provider,
          avgLatency: data.avgLatency,
          avgCost: data.avgCost,
          successRate: data.successRate,
          totalRequests: data.totalRequests,
          avgTokens: data.avgTokens,
          performanceScore
        };
      });

      // Sort by performance score descending
      return patterns.sort((a, b) => b.performanceScore - a.performanceScore);
    } catch (error: unknown) {
      logger.error('Failed to analyze usage patterns:', error);
      throw error;
    }
  }

  /**
   * Generate AI recommendations for router settings
   */
  async generateRecommendations(
    currentSettings: EffectiveRouterSettings
  ): Promise<AIRecommendation[]> {
    try {
      const recommendations: AIRecommendation[] = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Analyze usage patterns
      const patterns = await this.analyzeUsagePatterns({
        start: thirtyDaysAgo,
        end: new Date()
      });

      if (patterns.length === 0) {
        return recommendations;
      }

      // 1. Cost Optimization Recommendations
      const highCostPatterns = patterns.filter(
        p => p.avgCost > 0.05 && p.totalRequests > 10
      );
      if (highCostPatterns.length > 0) {
        // Find cheaper alternatives with similar performance
        for (const pattern of highCostPatterns.slice(0, 5)) {
          const cheaperAlternatives = patterns.filter(
            p =>
              p.agentRole === pattern.agentRole &&
              p.taskType === pattern.taskType &&
              p.avgCost < pattern.avgCost * 0.7 &&
              p.performanceScore >= pattern.performanceScore * 0.9 &&
              p.modelId !== pattern.modelId
          );

          if (cheaperAlternatives.length > 0) {
            const bestAlternative = cheaperAlternatives[0];
            const costSavings = ((pattern.avgCost - bestAlternative.avgCost) / pattern.avgCost) * 100;

            recommendations.push({
              type: 'routing_rule',
              priority: costSavings > 30 ? 'high' : 'medium',
              title: `Use ${bestAlternative.modelId} for ${pattern.agentRole || 'all'} ${pattern.taskType || 'tasks'}`,
              description: `Switch from ${pattern.modelId} to ${bestAlternative.modelId} for similar performance at lower cost`,
              impact: `Reduce costs by ~${costSavings.toFixed(0)}%`,
              confidence: Math.min(bestAlternative.totalRequests / 50, 1),
              suggestedChanges: {
                routingRule: {
                  name: `Cost-optimized routing for ${pattern.agentRole || 'all'} ${pattern.taskType || 'tasks'}`,
                  priority: 5,
                  conditions: {
                    agentRoles: pattern.agentRole ? [pattern.agentRole] : undefined,
                    taskTypes: pattern.taskType ? [pattern.taskType] : undefined
                  },
                  actions: {
                    preferredModel: bestAlternative.modelId,
                    costPreference: 'low'
                  }
                }
              },
              reasoning: `${bestAlternative.modelId} shows ${bestAlternative.performanceScore.toFixed(2)} performance score vs ${pattern.performanceScore.toFixed(2)} for ${pattern.modelId}, with ${costSavings.toFixed(0)}% cost savings across ${pattern.totalRequests} requests`
            });
          }
        }
      }

      // 2. Performance Tuning Recommendations
      const latencyIssues = patterns.filter(
        p => p.avgLatency > 3000 && p.totalRequests > 20
      );
      if (latencyIssues.length > 0 && currentSettings.performanceTuning) {
        const currentLatencyWeight = currentSettings.performanceTuning.latencyWeight || 0.33;
        const suggestedLatencyWeight = Math.min(currentLatencyWeight + 0.1, 0.6);

        recommendations.push({
          type: 'performance_tuning',
          priority: 'medium',
          title: 'Increase latency weight in performance tuning',
          description: 'Many requests are experiencing high latency. Prioritize faster models.',
          impact: 'Improve average response time by 10-20%',
          confidence: 0.7,
          suggestedChanges: {
            performanceTuning: {
              ...currentSettings.performanceTuning,
              latencyWeight: suggestedLatencyWeight,
              costWeight: (1 - suggestedLatencyWeight) * 0.5,
              qualityWeight: (1 - suggestedLatencyWeight) * 0.5
            }
          },
          reasoning: `${latencyIssues.length} patterns show average latency > 3s. Increasing latency weight from ${currentLatencyWeight} to ${suggestedLatencyWeight} will prioritize faster models.`
        });
      }

      // 3. Model Priority Recommendations
      const topPerformers = patterns
        .filter(p => p.totalRequests > 50)
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 5);

      if (topPerformers.length > 0) {
        const modelRankings: Record<string, number> = {};
        topPerformers.forEach((pattern, index) => {
          modelRankings[pattern.modelId] = index + 1;
        });

        recommendations.push({
          type: 'model_priority',
          priority: 'medium',
          title: 'Update model priorities based on performance',
          description: 'Prioritize top-performing models based on historical data',
          impact: 'Improve overall routing quality',
          confidence: 0.8,
          suggestedChanges: {
            modelPriorities: {
              modelRankings
            }
          },
          reasoning: `Top ${topPerformers.length} models by performance score: ${topPerformers.map(p => `${p.modelId} (${p.performanceScore.toFixed(2)})`).join(', ')}`
        });
      }

      // 4. Budget Limit Recommendations
      const totalCost = patterns.reduce((sum, p) => sum + (p.avgCost * p.totalRequests), 0);
      const avgDailyCost = totalCost / 30;
      const suggestedMonthlyLimit = avgDailyCost * 30 * 1.2; // 20% buffer

      if (currentSettings.costControls?.globalBudget?.monthlyLimit) {
        const currentLimit = currentSettings.costControls.globalBudget.monthlyLimit;
        if (suggestedMonthlyLimit < currentLimit * 0.8) {
          recommendations.push({
            type: 'budget_limit',
            priority: 'low',
            title: 'Consider reducing monthly budget limit',
            description: `Current usage suggests a lower limit may be appropriate`,
            impact: `Potential savings of $${(currentLimit - suggestedMonthlyLimit).toFixed(2)}/month`,
            confidence: 0.6,
            suggestedChanges: {
              costControls: {
                ...currentSettings.costControls,
                globalBudget: {
                  ...currentSettings.costControls.globalBudget,
                  monthlyLimit: suggestedMonthlyLimit
                }
              }
            },
            reasoning: `Average daily cost is $${avgDailyCost.toFixed(2)}, suggesting monthly limit of $${suggestedMonthlyLimit.toFixed(2)} vs current $${currentLimit}`
          });
        }
      }

      return recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error: unknown) {
      logger.error('Failed to generate recommendations:', error);
      throw error;
    }
  }

  /**
   * Detect anomalies in routing, costs, or performance
   */
  async detectAnomalies(timeRange: { start: Date; end: Date }): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = [];

      // Get usage data
      const usageData = await LLMUsage.find({
        timestamp: {
          $gte: timeRange.start,
          $lte: timeRange.end
        }
      }).sort({ timestamp: -1 });

      if (usageData.length === 0) {
        return anomalies;
      }

      // Calculate baseline metrics (from first half of time range)
      const midpoint = new Date(
        timeRange.start.getTime() + (timeRange.end.getTime() - timeRange.start.getTime()) / 2
      );
      const baselineData = usageData.filter(u => u.timestamp < midpoint);
      const recentData = usageData.filter(u => u.timestamp >= midpoint);

      if (baselineData.length === 0 || recentData.length === 0) {
        return anomalies;
      }

      // Calculate baseline averages
      const baselineAvgCost = baselineData.reduce((sum, u) => sum + u.totalCost, 0) / baselineData.length;
      const baselineAvgLatency = baselineData.reduce((sum, u) => sum + (u.latencyMs || 0), 0) / baselineData.filter(u => u.latencyMs).length;
      const baselineErrorRate = baselineData.filter(u => !u.success).length / baselineData.length;

      // Calculate recent averages
      const recentAvgCost = recentData.reduce((sum, u) => sum + u.totalCost, 0) / recentData.length;
      const recentAvgLatency = recentData.reduce((sum, u) => sum + (u.latencyMs || 0), 0) / recentData.filter(u => u.latencyMs).length;
      const recentErrorRate = recentData.filter(u => !u.success).length / recentData.length;

      // 1. Cost Spike Detection
      if (recentAvgCost > baselineAvgCost * 1.5 && baselineAvgCost > 0) {
        const costIncrease = ((recentAvgCost - baselineAvgCost) / baselineAvgCost) * 100;
        anomalies.push({
          type: 'cost_spike',
          severity: costIncrease > 100 ? 'critical' : 'warning',
          detectedAt: new Date(),
          description: `Cost per request increased by ${costIncrease.toFixed(0)}%`,
          metrics: {
            baselineAvgCost,
            recentAvgCost,
            increase: costIncrease
          },
          suggestedAction: 'Review recent routing decisions and consider cost optimization recommendations'
        });
      }

      // 2. Performance Degradation Detection
      if (recentAvgLatency > baselineAvgLatency * 1.3 && baselineAvgLatency > 0) {
        const latencyIncrease = ((recentAvgLatency - baselineAvgLatency) / baselineAvgLatency) * 100;
        anomalies.push({
          type: 'performance_degradation',
          severity: latencyIncrease > 50 ? 'critical' : 'warning',
          detectedAt: new Date(),
          description: `Average latency increased by ${latencyIncrease.toFixed(0)}%`,
          metrics: {
            baselineAvgLatency,
            recentAvgLatency,
            increase: latencyIncrease
          },
          suggestedAction: 'Check for model availability issues or consider adjusting performance tuning weights'
        });
      }

      // 3. Error Spike Detection
      if (recentErrorRate > baselineErrorRate * 2 && baselineErrorRate > 0) {
        const errorIncrease = ((recentErrorRate - baselineErrorRate) / baselineErrorRate) * 100;
        anomalies.push({
          type: 'error_spike',
          severity: recentErrorRate > 0.1 ? 'critical' : 'warning',
          detectedAt: new Date(),
          description: `Error rate increased by ${errorIncrease.toFixed(0)}%`,
          metrics: {
            baselineErrorRate,
            recentErrorRate,
            increase: errorIncrease
          },
          suggestedAction: 'Investigate model failures and check API key status'
        });
      }

      // 4. Unusual Pattern Detection (e.g., sudden model switch)
      const modelDistribution = new Map<string, number>();
      recentData.forEach(u => {
        modelDistribution.set(u.modelId, (modelDistribution.get(u.modelId) || 0) + 1);
      });

      const mostUsedModel = Array.from(modelDistribution.entries())
        .sort((a, b) => b[1] - a[1])[0];

      if (mostUsedModel && mostUsedModel[1] / recentData.length > 0.8) {
        // Check if this is different from baseline
        const baselineModelDistribution = new Map<string, number>();
        baselineData.forEach(u => {
          baselineModelDistribution.set(u.modelId, (baselineModelDistribution.get(u.modelId) || 0) + 1);
        });
        const baselineMostUsed = Array.from(baselineModelDistribution.entries())
          .sort((a, b) => b[1] - a[1])[0];

        if (baselineMostUsed && baselineMostUsed[0] !== mostUsedModel[0]) {
          anomalies.push({
            type: 'unusual_pattern',
            severity: 'info',
            detectedAt: new Date(),
            description: `Routing pattern changed: ${baselineMostUsed[0]} (${(baselineMostUsed[1] / baselineData.length * 100).toFixed(0)}%) → ${mostUsedModel[0]} (${(mostUsedModel[1] / recentData.length * 100).toFixed(0)}%)`,
            metrics: {
              previousModel: baselineMostUsed[0],
              currentModel: mostUsedModel[0],
              previousPercentage: (baselineMostUsed[1] / baselineData.length) * 100,
              currentPercentage: (mostUsedModel[1] / recentData.length) * 100
            },
            suggestedAction: 'Verify if this change is intentional or investigate routing rule changes'
          });
        }
      }

      return anomalies.sort((a, b) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error: unknown) {
      logger.error('Failed to detect anomalies:', error);
      throw error;
    }
  }

  /**
   * Predict optimal model for a task
   */
  async predictOptimalModel(
    taskAnalysis: {
      agentRole?: string;
      taskType?: string;
      complexity?: 'simple' | 'moderate' | 'complex';
      estimatedTokens?: number;
      requiredCapabilities?: string[];
    },
    context?: {
      userId?: string;
      costPreference?: 'low' | 'balanced' | 'quality';
      maxLatency?: number;
    }
  ): Promise<ModelPrediction> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get relevant patterns
      const patterns = await this.analyzeUsagePatterns(
        {
          start: thirtyDaysAgo,
          end: new Date()
        },
        {
          agentRole: taskAnalysis.agentRole,
          taskType: taskAnalysis.taskType
        }
      );

      // Filter by capabilities if specified
      let candidateModels = patterns;
      if (taskAnalysis.requiredCapabilities && taskAnalysis.requiredCapabilities.length > 0) {
        // Get models from registry that match capabilities
        const allModels = modelRegistry.getActiveModels();
        const matchingModels = allModels.filter(model => {
          return taskAnalysis.requiredCapabilities!.every(cap => {
            const capKey = cap as keyof typeof model.capabilities;
            return model.capabilities[capKey] === true;
          });
        });
        const matchingModelIds = new Set(matchingModels.map(m => m.id));
        candidateModels = patterns.filter(p => matchingModelIds.has(p.modelId));
      }

      // Apply cost preference filter
      if (context?.costPreference === 'low') {
        candidateModels = candidateModels.sort((a, b) => a.avgCost - b.avgCost);
      } else if (context?.costPreference === 'quality') {
        candidateModels = candidateModels.sort((a, b) => b.performanceScore - a.performanceScore);
      } else {
        // Balanced: sort by performance score
        candidateModels = candidateModels.sort((a, b) => b.performanceScore - a.performanceScore);
      }

      // Filter by latency if specified
      if (context?.maxLatency) {
        candidateModels = candidateModels.filter(p => p.avgLatency <= context.maxLatency!);
      }

      if (candidateModels.length === 0) {
        // Fallback to registry models
        const allModels = modelRegistry.getActiveModels();
        const defaultModel = allModels[0];
        return {
          modelId: defaultModel.id,
          provider: defaultModel.provider,
          confidence: 0.3,
          estimatedCost: (taskAnalysis.estimatedTokens || 1000) / 1_000_000 * (defaultModel.pricing.inputCostPer1MTokens + defaultModel.pricing.outputCostPer1MTokens),
          estimatedLatency: defaultModel.performance.avgLatencyMs,
          reasoning: 'No historical data available, using default model',
          alternatives: []
        };
      }

      const bestModel = candidateModels[0];
      const confidence = Math.min(bestModel.totalRequests / 100, 1); // More requests = higher confidence

      // Calculate estimated cost
      const estimatedCost = bestModel.avgCost * ((taskAnalysis.estimatedTokens || 1000) / bestModel.avgTokens);

      // Get alternatives (top 3)
      const alternatives = candidateModels.slice(1, 4).map(p => ({
        modelId: p.modelId,
        confidence: Math.min(p.totalRequests / 100, 1),
        estimatedCost: p.avgCost * ((taskAnalysis.estimatedTokens || 1000) / p.avgTokens),
        estimatedLatency: p.avgLatency
      }));

      return {
        modelId: bestModel.modelId,
        provider: bestModel.provider,
        confidence,
        estimatedCost,
        estimatedLatency: bestModel.avgLatency,
        reasoning: `Based on ${bestModel.totalRequests} historical requests: ${bestModel.performanceScore.toFixed(2)} performance score, ${bestModel.avgLatency.toFixed(0)}ms avg latency, $${bestModel.avgCost.toFixed(4)} avg cost`,
        alternatives
      };
    } catch (error: unknown) {
      logger.error('Failed to predict optimal model:', error);
      throw error;
    }
  }

  /**
   * Suggest auto-tuning adjustments
   */
  async suggestAutoTuning(
    currentSettings: EffectiveRouterSettings,
    metrics: {
      avgLatency: number;
      avgCost: number;
      successRate: number;
      totalRequests: number;
    }
  ): Promise<Partial<EffectiveRouterSettings['performanceTuning']>> {
    try {
      const currentTuning = currentSettings.performanceTuning || {
        latencyWeight: 0.33,
        costWeight: 0.33,
        qualityWeight: 0.34
      };

      const suggestions: Partial<EffectiveRouterSettings['performanceTuning']> = {};

      // If latency is high, increase latency weight
      if (metrics.avgLatency > 3000) {
        suggestions.latencyWeight = Math.min(currentTuning.latencyWeight + 0.1, 0.6);
        const remaining = 1 - (suggestions.latencyWeight || currentTuning.latencyWeight);
        suggestions.costWeight = remaining * 0.5;
        suggestions.qualityWeight = remaining * 0.5;
      }
      // If cost is high, increase cost weight
      else if (metrics.avgCost > 0.05) {
        suggestions.costWeight = Math.min(currentTuning.costWeight + 0.1, 0.6);
        const remaining = 1 - (suggestions.costWeight || currentTuning.costWeight);
        suggestions.latencyWeight = remaining * 0.5;
        suggestions.qualityWeight = remaining * 0.5;
      }
      // If success rate is low, increase quality weight
      else if (metrics.successRate < 0.9) {
        suggestions.qualityWeight = Math.min(currentTuning.qualityWeight + 0.1, 0.6);
        const remaining = 1 - (suggestions.qualityWeight || currentTuning.qualityWeight);
        suggestions.latencyWeight = remaining * 0.5;
        suggestions.costWeight = remaining * 0.5;
      }

      return suggestions;
    } catch (error: unknown) {
      logger.error('Failed to suggest auto-tuning:', error);
      throw error;
    }
  }

  /**
   * Get AI insights summary
   */
  async getInsights(timeRange: { start: Date; end: Date }): Promise<{
    totalRequests: number;
    totalCost: number;
    avgLatency: number;
    successRate: number;
    topModels: Array<{ modelId: string; usage: number; cost: number }>;
    topAgentRoles: Array<{ agentRole: string; requests: number; cost: number }>;
    costTrend: Array<{ date: string; cost: number }>;
  }> {
    try {
      const usageData = await LLMUsage.find({
        timestamp: {
          $gte: timeRange.start,
          $lte: timeRange.end
        }
      });

      const totalRequests = usageData.length;
      const totalCost = usageData.reduce((sum, u) => sum + u.totalCost, 0);
      const avgLatency = usageData.reduce((sum, u) => sum + (u.latencyMs || 0), 0) / usageData.filter(u => u.latencyMs).length || 0;
      const successRate = usageData.filter(u => u.success).length / totalRequests || 0;

      // Top models
      const modelUsage = new Map<string, { count: number; cost: number }>();
      usageData.forEach(u => {
        const existing = modelUsage.get(u.modelId) || { count: 0, cost: 0 };
        modelUsage.set(u.modelId, {
          count: existing.count + 1,
          cost: existing.cost + u.totalCost
        });
      });

      const topModels = Array.from(modelUsage.entries())
        .map(([modelId, data]) => ({ modelId, usage: data.count, cost: data.cost }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 5);

      // Top agent roles
      const roleUsage = new Map<string, { count: number; cost: number }>();
      usageData.forEach(u => {
        if (u.agentRole) {
          const existing = roleUsage.get(u.agentRole) || { count: 0, cost: 0 };
          roleUsage.set(u.agentRole, {
            count: existing.count + 1,
            cost: existing.cost + u.totalCost
          });
        }
      });

      const topAgentRoles = Array.from(roleUsage.entries())
        .map(([agentRole, data]) => ({ agentRole, requests: data.count, cost: data.cost }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 5);

      // Cost trend (daily)
      const costByDate = new Map<string, number>();
      usageData.forEach(u => {
        const date = u.timestamp.toISOString().split('T')[0];
        costByDate.set(date, (costByDate.get(date) || 0) + u.totalCost);
      });

      const costTrend = Array.from(costByDate.entries())
        .map(([date, cost]) => ({ date, cost }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalRequests,
        totalCost,
        avgLatency,
        successRate,
        topModels,
        topAgentRoles,
        costTrend
      };
    } catch (error: unknown) {
      logger.error('Failed to get insights:', error);
      throw error;
    }
  }
}

export const llmRouterAIService = new LLMRouterAIService();




