/**
 * LLM Cost Optimization Service
 * Analyzes cost patterns, suggests model switches, and provides cost forecasting
 */

import { logger } from '../utils/logger.js';
import { LLMUsage } from '../models/LLMUsage.model.js';

export interface CostAnalysis {
  period: 'daily' | 'weekly' | 'monthly';
  totalCost: number;
  byProvider: Array<{
    provider: string;
    cost: number;
    percentage: number;
    usage: number; // tokens
  }>;
  byModel: Array<{
    modelId: string;
    cost: number;
    usage: number;
    averageCostPerToken: number;
  }>;
  trends: Array<{
    date: Date;
    cost: number;
    usage: number;
  }>;
  forecast: {
    nextWeek: number;
    nextMonth: number;
    confidence: number; // 0-100
  };
}

export interface OptimizationSuggestion {
  type: 'model_switch' | 'provider_switch' | 'batch_processing' | 'caching';
  description: string;
  potentialSavings: number; // percentage
  impact: 'high' | 'medium' | 'low';
  implementation: string;
}

class LLMCostOptimizationService {
  /**
   * Analyze costs
   */
  async analyzeCosts(
    userId?: string,
    days: number = 30
  ): Promise<CostAnalysis> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const query: any = { createdAt: { $gte: startDate } };
      if (userId) {
        query.userId = userId;
      }

      const usageRecords = await LLMUsage.find(query).lean();

      // Calculate totals
      const totalCost = usageRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
      const totalTokens = usageRecords.reduce((sum, r) => sum + (r.inputTokens || 0) + (r.outputTokens || 0), 0);

      // Group by provider
      const byProvider = this.groupByProvider(usageRecords, totalCost);

      // Group by model
      const byModel = this.groupByModel(usageRecords, totalCost);

      // Calculate trends
      const trends = this.calculateTrends(usageRecords, days);

      // Forecast
      const forecast = this.forecastCosts(trends);

      return {
        period: days <= 7 ? 'daily' : days <= 30 ? 'weekly' : 'monthly',
        totalCost: Math.round(totalCost * 100) / 100,
        byProvider,
        byModel,
        trends,
        forecast
      };
    } catch (error: unknown) {
      logger.error('Cost analysis failed:', error);
      throw error;
    }
  }

  /**
   * Group by provider
   */
  private groupByProvider(
    records: any[],
    totalCost: number
  ): CostAnalysis['byProvider'] {
    const providerMap = new Map<string, { cost: number; usage: number }>();

    for (const record of records) {
      const provider = record.provider || 'unknown';
      if (!providerMap.has(provider)) {
        providerMap.set(provider, { cost: 0, usage: 0 });
      }

      const data = providerMap.get(provider)!;
      data.cost += record.cost || 0;
      data.usage += (record.inputTokens || 0) + (record.outputTokens || 0);
    }

    return Array.from(providerMap.entries()).map(([provider, data]) => ({
      provider,
      cost: Math.round(data.cost * 100) / 100,
      percentage: totalCost > 0 ? Math.round((data.cost / totalCost) * 100) : 0,
      usage: data.usage
    })).sort((a, b) => b.cost - a.cost);
  }

  /**
   * Group by model
   */
  private groupByModel(
    records: any[],
    totalCost: number
  ): CostAnalysis['byModel'] {
    const modelMap = new Map<string, { cost: number; usage: number; count: number }>();

    for (const record of records) {
      const modelId = record.modelId || 'unknown';
      if (!modelMap.has(modelId)) {
        modelMap.set(modelId, { cost: 0, usage: 0, count: 0 });
      }

      const data = modelMap.get(modelId)!;
      data.cost += record.cost || 0;
      data.usage += (record.inputTokens || 0) + (record.outputTokens || 0);
      data.count++;
    }

    return Array.from(modelMap.entries()).map(([modelId, data]) => ({
      modelId,
      cost: Math.round(data.cost * 100) / 100,
      usage: data.usage,
      averageCostPerToken: data.usage > 0
        ? Math.round((data.cost / data.usage) * 1000000) / 1000000
        : 0
    })).sort((a, b) => b.cost - a.cost);
  }

  /**
   * Calculate trends
   */
  private calculateTrends(records: any[], days: number): CostAnalysis['trends'] {
    const dailyData = new Map<string, { cost: number; usage: number }>();

    for (const record of records) {
      const day = new Date(record.createdAt).toISOString().split('T')[0];
      if (!dailyData.has(day)) {
        dailyData.set(day, { cost: 0, usage: 0 });
      }

      const data = dailyData.get(day)!;
      data.cost += record.cost || 0;
      data.usage += (record.inputTokens || 0) + (record.outputTokens || 0);
    }

    return Array.from(dailyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date: new Date(date),
        cost: Math.round(data.cost * 100) / 100,
        usage: data.usage
      }));
  }

  /**
   * Forecast costs
   */
  private forecastCosts(trends: CostAnalysis['trends']): CostAnalysis['forecast'] {
    if (trends.length < 2) {
      return {
        nextWeek: 0,
        nextMonth: 0,
        confidence: 0
      };
    }

    // Simple linear regression
    const recentTrends = trends.slice(-7); // Last week
    const avgDailyCost = recentTrends.reduce((sum, t) => sum + t.cost, 0) / recentTrends.length;

    const nextWeek = avgDailyCost * 7;
    const nextMonth = avgDailyCost * 30;

    // Confidence based on data points
    const confidence = Math.min(100, (trends.length / 30) * 100);

    return {
      nextWeek: Math.round(nextWeek * 100) / 100,
      nextMonth: Math.round(nextMonth * 100) / 100,
      confidence: Math.round(confidence)
    };
  }

  /**
   * Generate optimization suggestions
   */
  async generateSuggestions(userId?: string): Promise<OptimizationSuggestion[]> {
    const analysis = await this.analyzeCosts(userId);
    const suggestions: OptimizationSuggestion[] = [];

    // Check for expensive models used for simple tasks
    const expensiveModels = analysis.byModel.filter(m => m.averageCostPerToken > 0.002);
    if (expensiveModels.length > 0) {
      suggestions.push({
        type: 'model_switch',
        description: `Consider using cheaper models (GPT-4o Mini, Gemini Flash) for simple tasks instead of ${expensiveModels[0].modelId}`,
        potentialSavings: 30,
        impact: 'high',
        implementation: 'Update routing rules to prefer cheaper models for low-complexity tasks'
      });
    }

    // Check for cost trends
    if (analysis.trends.length >= 7) {
      const recentAvg = analysis.trends.slice(-7).reduce((sum, t) => sum + t.cost, 0) / 7;
      const olderAvg = analysis.trends.slice(-14, -7).reduce((sum, t) => sum + t.cost, 0) / 7;

      if (recentAvg > olderAvg * 1.2) {
        suggestions.push({
          type: 'cost_optimization',
          description: 'Costs have increased 20%+ recently. Review model usage patterns.',
          potentialSavings: 20,
          impact: 'medium',
          implementation: 'Analyze recent usage patterns and optimize routing'
        });
      }
    }

    return suggestions;
  }

  /**
   * Alert on budget threshold
   */
  async checkBudgetThreshold(
    userId: string,
    budget: number,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<boolean> {
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const analysis = await this.analyzeCosts(userId, days);

    const threshold = budget * 0.8; // Alert at 80% of budget

    if (analysis.totalCost >= threshold) {
      logger.warn(`Budget threshold reached for user ${userId}: ${analysis.totalCost}/${budget}`);
      return true;
    }

    return false;
  }
}

export const llmCostOptimizationService = new LLMCostOptimizationService();
