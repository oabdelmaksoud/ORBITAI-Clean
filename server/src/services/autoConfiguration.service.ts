/**
 * Auto-Configuration Service
 * AI-powered automatic system configuration optimization
 * Analyzes usage patterns and optimizes configuration parameters
 */

import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';
import { llmRouterSettingsService } from './llmRouterSettings.service.js';
import { Project } from '../models/Project.model.js';

export interface ConfigurationRecommendation {
  setting: string;
  currentValue: any;
  recommendedValue: any;
  confidence: number; // 0-1
  reasoning: string;
  expectedImpact: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ConfigurationAnalysis {
  userId?: string;
  projectId?: string;
  recommendations: ConfigurationRecommendation[];
  overallScore: number; // 0-100
  analysisDate: Date;
}

class AutoConfigurationService {
  /**
   * Analyze current configuration and provide recommendations
   */
  async analyzeConfiguration(
    userId?: string,
    projectId?: string
  ): Promise<ConfigurationAnalysis> {
    const recommendations: ConfigurationRecommendation[] = [];

    try {
      // Analyze LLM usage patterns
      const usagePatterns = await this.analyzeUsagePatterns(userId, projectId);

      // 1. Cost optimization recommendations
      const costRecommendations = await this.analyzeCostOptimization(usagePatterns);
      recommendations.push(...costRecommendations);

      // 2. Performance optimization recommendations
      const perfRecommendations = await this.analyzePerformanceOptimization(usagePatterns);
      recommendations.push(...perfRecommendations);

      // 3. Model selection recommendations
      const modelRecommendations = await this.analyzeModelSelection(usagePatterns);
      recommendations.push(...modelRecommendations);

      // Calculate overall score
      const overallScore = this.calculateOverallScore(recommendations, usagePatterns);

      return {
        userId,
        projectId,
        recommendations: recommendations.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }),
        overallScore,
        analysisDate: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to analyze configuration:', error);
      return {
        userId,
        projectId,
        recommendations: [],
        overallScore: 0,
        analysisDate: new Date()
      };
    }
  }

  /**
   * Apply recommended configuration changes
   */
  async applyRecommendations(
    recommendations: ConfigurationRecommendation[],
    userId?: string
  ): Promise<{ applied: number; failed: number }> {
    let applied = 0;
    let failed = 0;

    for (const rec of recommendations) {
      try {
        await this.applyRecommendation(rec, userId);
        applied++;
      } catch (error: unknown) {
        logger.warn(`Failed to apply recommendation ${rec.setting}:`, error);
        failed++;
      }
    }

    return { applied, failed };
  }

  /**
   * Analyze usage patterns
   */
  private async analyzeUsagePatterns(
    userId?: string,
    projectId?: string
  ): Promise<{
    totalCalls: number;
    avgCost: number;
    avgLatency: number;
    costByModel: Record<string, number>;
    latencyByModel: Record<string, number>;
    callsByModel: Record<string, number>;
    errorRate: number;
  }> {
    const query: any = {
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    };
    if (userId) query.userId = userId;
    if (projectId) query.projectId = projectId;

    const usage = await LLMUsage.find(query).lean();

    const totalCalls = usage.length;
    const totalCost = usage.reduce((sum, u) => sum + (u.totalCost || 0), 0);
    const totalLatency = usage.reduce((sum, u) => sum + (u.latencyMs || 0), 0);
    const failedCalls = usage.filter(u => !u.success).length;

    const costByModel: Record<string, number> = {};
    const latencyByModel: Record<string, number> = {};
    const callsByModel: Record<string, number> = {};

    usage.forEach(u => {
      const model = u.modelId || 'unknown';
      costByModel[model] = (costByModel[model] || 0) + (u.totalCost || 0);
      latencyByModel[model] = (latencyByModel[model] || 0) + (u.latencyMs || 0);
      callsByModel[model] = (callsByModel[model] || 0) + 1;
    });

    // Calculate averages
    Object.keys(latencyByModel).forEach(model => {
      latencyByModel[model] = latencyByModel[model] / callsByModel[model];
    });

    return {
      totalCalls,
      avgCost: totalCalls > 0 ? totalCost / totalCalls : 0,
      avgLatency: totalCalls > 0 ? totalLatency / totalCalls : 0,
      costByModel,
      latencyByModel,
      callsByModel,
      errorRate: totalCalls > 0 ? failedCalls / totalCalls : 0
    };
  }

  /**
   * Analyze cost optimization opportunities
   */
  private async analyzeCostOptimization(patterns: any): Promise<ConfigurationRecommendation[]> {
    const recommendations: ConfigurationRecommendation[] = [];

    // Check if expensive models are being used for simple tasks
    const expensiveModels = Object.entries(patterns.costByModel)
      .filter(([_, cost]: [string, any]) => cost > patterns.avgCost * 2)
      .map(([model]) => model);

    if (expensiveModels.length > 0 && patterns.totalCalls > 50) {
      recommendations.push({
        setting: 'defaultCostPreference',
        currentValue: 'quality',
        recommendedValue: 'balanced',
        confidence: 0.7,
        reasoning: `Detected high usage of expensive models (${expensiveModels.join(', ')}). Switching to balanced cost preference could reduce costs by 20-30%.`,
        expectedImpact: 'Reduce costs by 20-30%',
        priority: 'high'
      });
    }

    // Check if cost preference is too aggressive
    if (patterns.avgCost < 0.001 && patterns.totalCalls > 100) {
      recommendations.push({
        setting: 'defaultCostPreference',
        currentValue: 'low',
        recommendedValue: 'balanced',
        confidence: 0.6,
        reasoning: 'Very low costs detected. Consider balanced preference for better quality.',
        expectedImpact: 'Improve quality with minimal cost increase',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Analyze performance optimization opportunities
   */
  private async analyzePerformanceOptimization(patterns: any): Promise<ConfigurationRecommendation[]> {
    const recommendations: ConfigurationRecommendation[] = [];

    // Check for high latency
    if (patterns.avgLatency > 5000 && patterns.totalCalls > 20) {
      const slowModels = Object.entries(patterns.latencyByModel)
        .filter(([_, latency]: [string, any]) => latency > patterns.avgLatency)
        .map(([model]) => model);

      if (slowModels.length > 0) {
        recommendations.push({
          setting: 'modelPriorities',
          currentValue: 'default',
          recommendedValue: 'prioritize_fast_models',
          confidence: 0.75,
          reasoning: `High latency detected (avg: ${patterns.avgLatency.toFixed(0)}ms). Models ${slowModels.join(', ')} are slower than average. Consider prioritizing faster models.`,
          expectedImpact: 'Reduce latency by 30-50%',
          priority: 'high'
        });
      }
    }

    // Check error rate
    if (patterns.errorRate > 0.1 && patterns.totalCalls > 50) {
      recommendations.push({
        setting: 'enableIntelligentRouting',
        currentValue: false,
        recommendedValue: true,
        confidence: 0.8,
        reasoning: `High error rate detected (${(patterns.errorRate * 100).toFixed(1)}%). Intelligent routing can help select more reliable models.`,
        expectedImpact: 'Reduce errors by 20-40%',
        priority: 'high'
      });
    }

    return recommendations;
  }

  /**
   * Analyze model selection patterns
   */
  private async analyzeModelSelection(patterns: any): Promise<ConfigurationRecommendation[]> {
    const recommendations: ConfigurationRecommendation[] = [];

    // Check if too many different models are being used (fragmentation)
    const modelCount = Object.keys(patterns.callsByModel).length;
    const topModelCalls = Math.max(...Object.values(patterns.callsByModel) as number[]);
    const topModelShare = patterns.totalCalls > 0 ? topModelCalls / patterns.totalCalls : 0;

    if (modelCount > 10 && topModelShare < 0.3 && patterns.totalCalls > 100) {
      const topModel = Object.entries(patterns.callsByModel)
        .sort(([, a]: any[], [, b]: any[]) => b - a)[0]?.[0];

      if (topModel) {
        recommendations.push({
          setting: 'modelPriorities',
          currentValue: 'distributed',
          recommendedValue: `prioritize_${topModel}`,
          confidence: 0.65,
          reasoning: `Model usage is fragmented across ${modelCount} models. Top model (${topModel}) only has ${(topModelShare * 100).toFixed(1)}% share. Consolidating could improve consistency.`,
          expectedImpact: 'Improve consistency and reduce complexity',
          priority: 'medium'
        });
      }
    }

    return recommendations;
  }

  /**
   * Calculate overall configuration score
   */
  private calculateOverallScore(
    recommendations: ConfigurationRecommendation[],
    patterns: any
  ): number {
    let score = 100;

    // Deduct points for high-priority recommendations
    recommendations.forEach(rec => {
      if (rec.priority === 'high') score -= 15;
      else if (rec.priority === 'medium') score -= 8;
      else score -= 3;
    });

    // Adjust based on usage patterns
    if (patterns.errorRate > 0.1) score -= 20;
    if (patterns.avgLatency > 5000) score -= 15;
    if (patterns.avgCost > 0.01 && patterns.totalCalls > 100) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Apply a single recommendation
   */
  private async applyRecommendation(
    recommendation: ConfigurationRecommendation,
    userId?: string
  ): Promise<void> {
    const settings = await llmRouterSettingsService.getEffectiveSettings(userId);

    switch (recommendation.setting) {
      case 'defaultCostPreference':
        await llmRouterSettingsService.updateSettings(userId, {
          defaultCostPreference: recommendation.recommendedValue as 'low' | 'balanced' | 'quality'
        });
        break;

      case 'enableIntelligentRouting':
        await llmRouterSettingsService.updateSettings(userId, {
          enableIntelligentRouting: recommendation.recommendedValue as boolean
        });
        break;

      case 'modelPriorities':
        // This would require more complex logic to update priorities
        logger.info(`Model priority recommendation: ${recommendation.reasoning}`);
        break;

      default:
        logger.warn(`Unknown setting: ${recommendation.setting}`);
    }
  }

  /**
   * Auto-configure system based on analysis
   */
  async autoConfigure(userId?: string, projectId?: string): Promise<{
    applied: number;
    failed: number;
    score: number;
  }> {
    const analysis = await this.analyzeConfiguration(userId, projectId);
    const result = await this.applyRecommendations(analysis.recommendations, userId);

    return {
      applied: result.applied,
      failed: result.failed,
      score: analysis.overallScore
    };
  }
}

export const autoConfigurationService = new AutoConfigurationService();




