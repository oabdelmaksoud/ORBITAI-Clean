/**
 * Cost Forecasting Service
 * Linear regression on usage trends and anomaly detection (Z-score based)
 */

import { LLMUsage } from '../models/LLMUsage.model.js';
import { logger } from '../utils/logger.js';

export interface DailyUsage {
  date: string;
  cost: number;
  requests: number;
  tokens: number;
}

export interface CostForecast {
  projectedDaily: number;
  projectedWeekly: number;
  projectedMonthly: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercent: number;
  confidence: number;
  historicalData: DailyUsage[];
}

export interface CostAnomaly {
  date: string;
  cost: number;
  expectedCost: number;
  zScore: number;
  severity: 'low' | 'medium' | 'high';
  deviation: number;
}

export interface WhatIfScenario {
  modelChanges?: { [modelId: string]: { enabled: boolean; trafficPercent?: number } };
  tierChanges?: { [taskType: string]: string };
  trafficChange?: number;
}

export interface WhatIfResult {
  currentProjected: number;
  scenarioProjected: number;
  difference: number;
  percentChange: number;
  breakdown: Array<{
    factor: string;
    impact: number;
  }>;
}

class CostForecastingService {
  private forecastCache: { data: CostForecast; timestamp: number } | null = null;
  private readonly CACHE_TTL = 300000; // 5 minutes

  /**
   * Get historical daily usage data
   */
  async getHistoricalData(days: number = 30): Promise<DailyUsage[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const result = await LLMUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          cost: { $sum: '$totalCost' },
          requests: { $sum: 1 },
          tokens: { $sum: '$totalTokens' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    return result.map(r => ({
      date: r._id,
      cost: r.cost,
      requests: r.requests,
      tokens: r.tokens
    }));
  }

  /**
   * Calculate linear regression for cost forecasting
   */
  private linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
    const n = data.length;
    if (n < 2) {
      return { slope: 0, intercept: data[0] || 0, r2: 0 };
    }

    // X values are just indices (0, 1, 2, ...)
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = data.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R² (coefficient of determination)
    const meanY = sumY / n;
    const ssTotal = data.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssResidual = data.reduce((sum, y, x) => {
      const predicted = intercept + slope * x;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { slope, intercept, r2 };
  }

  /**
   * Generate cost forecast
   */
  async getCostForecast(days: number = 30): Promise<CostForecast> {
    // Check cache
    if (this.forecastCache && Date.now() - this.forecastCache.timestamp < this.CACHE_TTL) {
      return this.forecastCache.data;
    }

    try {
      const historicalData = await this.getHistoricalData(days);

      if (historicalData.length < 3) {
        return {
          projectedDaily: 0,
          projectedWeekly: 0,
          projectedMonthly: 0,
          trend: 'stable',
          trendPercent: 0,
          confidence: 0,
          historicalData
        };
      }

      const costs = historicalData.map(d => d.cost);
      const { slope, intercept, r2 } = this.linearRegression(costs);

      // Project forward
      const nextDayIndex = costs.length;
      const projectedDaily = Math.max(0, intercept + slope * nextDayIndex);
      const projectedWeekly = projectedDaily * 7;
      const projectedMonthly = projectedDaily * 30;

      // Determine trend
      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
      const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
      const trendPercent = avgCost > 0 ? (slope / avgCost) * 100 : 0;

      if (trendPercent > 5) {
        trend = 'increasing';
      } else if (trendPercent < -5) {
        trend = 'decreasing';
      }

      const forecast: CostForecast = {
        projectedDaily,
        projectedWeekly,
        projectedMonthly,
        trend,
        trendPercent,
        confidence: Math.max(0, Math.min(100, r2 * 100)),
        historicalData
      };

      this.forecastCache = { data: forecast, timestamp: Date.now() };
      return forecast;
    } catch (error) {
      logger.error('[CostForecasting] Failed to generate forecast:', error);
      throw error;
    }
  }

  /**
   * Detect anomalies using Z-score
   */
  async detectAnomalies(days: number = 30, threshold: number = 2): Promise<CostAnomaly[]> {
    try {
      const historicalData = await this.getHistoricalData(days);

      if (historicalData.length < 7) {
        return []; // Need at least a week of data
      }

      const costs = historicalData.map(d => d.cost);
      
      // Calculate mean and standard deviation
      const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
      const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) {
        return []; // No variance, no anomalies
      }

      // Find anomalies
      const anomalies: CostAnomaly[] = [];

      for (const data of historicalData) {
        const zScore = (data.cost - mean) / stdDev;
        
        if (Math.abs(zScore) >= threshold) {
          let severity: 'low' | 'medium' | 'high' = 'low';
          if (Math.abs(zScore) >= 3) {
            severity = 'high';
          } else if (Math.abs(zScore) >= 2.5) {
            severity = 'medium';
          }

          anomalies.push({
            date: data.date,
            cost: data.cost,
            expectedCost: mean,
            zScore,
            severity,
            deviation: ((data.cost - mean) / mean) * 100
          });
        }
      }

      return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    } catch (error) {
      logger.error('[CostForecasting] Failed to detect anomalies:', error);
      throw error;
    }
  }

  /**
   * Run a what-if scenario
   */
  async runWhatIfScenario(scenario: WhatIfScenario): Promise<WhatIfResult> {
    try {
      const forecast = await this.getCostForecast(30);
      const currentProjected = forecast.projectedMonthly;
      
      let scenarioProjected = currentProjected;
      const breakdown: Array<{ factor: string; impact: number }> = [];

      // Model changes impact
      if (scenario.modelChanges) {
        // Get model-specific cost data
        const modelCosts = await LLMUsage.aggregate([
          {
            $match: {
              timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          },
          {
            $group: {
              _id: '$modelId',
              totalCost: { $sum: '$totalCost' },
              avgCost: { $avg: '$totalCost' }
            }
          }
        ]);

        const modelCostMap = new Map(modelCosts.map(m => [m._id, m]));
        
        for (const [modelId, change] of Object.entries(scenario.modelChanges)) {
          const modelData = modelCostMap.get(modelId);
          if (modelData) {
            const weeklyModelCost = modelData.totalCost;
            const monthlyModelCost = weeklyModelCost * 4;
            
            if (!change.enabled) {
              // Disabling a model - assume traffic moves to average cost models
              const impact = -monthlyModelCost * 0.8; // 80% savings (some overhead)
              scenarioProjected += impact;
              breakdown.push({
                factor: `Disable ${modelId}`,
                impact
              });
            } else if (change.trafficPercent !== undefined) {
              // Traffic redistribution
              const currentShare = monthlyModelCost / currentProjected;
              const newShare = change.trafficPercent / 100;
              const impact = currentProjected * (newShare - currentShare);
              scenarioProjected += impact;
              breakdown.push({
                factor: `${modelId} traffic to ${change.trafficPercent}%`,
                impact
              });
            }
          }
        }
      }

      // Traffic change impact
      if (scenario.trafficChange !== undefined && scenario.trafficChange !== 0) {
        const trafficImpact = currentProjected * (scenario.trafficChange / 100);
        scenarioProjected += trafficImpact;
        breakdown.push({
          factor: `Traffic ${scenario.trafficChange > 0 ? '+' : ''}${scenario.trafficChange}%`,
          impact: trafficImpact
        });
      }

      // Tier changes (simplified)
      if (scenario.tierChanges) {
        for (const [taskType, newTier] of Object.entries(scenario.tierChanges)) {
          // Estimate impact based on tier (simplified)
          const tierCostMultipliers: Record<string, number> = {
            economy: 0.5,
            standard: 1.0,
            premium: 2.0
          };
          
          const multiplier = tierCostMultipliers[newTier] || 1.0;
          // Assume each task type is ~10% of traffic
          const taskTypeShare = currentProjected * 0.1;
          const impact = taskTypeShare * (multiplier - 1);
          scenarioProjected += impact;
          breakdown.push({
            factor: `${taskType} → ${newTier}`,
            impact
          });
        }
      }

      return {
        currentProjected,
        scenarioProjected: Math.max(0, scenarioProjected),
        difference: scenarioProjected - currentProjected,
        percentChange: currentProjected > 0 
          ? ((scenarioProjected - currentProjected) / currentProjected) * 100 
          : 0,
        breakdown
      };
    } catch (error) {
      logger.error('[CostForecasting] Failed to run what-if scenario:', error);
      throw error;
    }
  }

  /**
   * Get cost breakdown by model/provider
   */
  async getCostBreakdown(days: number = 7): Promise<{
    byModel: Array<{ modelId: string; cost: number; percent: number }>;
    byProvider: Array<{ provider: string; cost: number; percent: number }>;
    byTaskType: Array<{ taskType: string; cost: number; percent: number }>;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byModel, byProvider, byTaskType] = await Promise.all([
      LLMUsage.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$modelId', cost: { $sum: '$totalCost' } } },
        { $sort: { cost: -1 } }
      ]),
      LLMUsage.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$provider', cost: { $sum: '$totalCost' } } },
        { $sort: { cost: -1 } }
      ]),
      LLMUsage.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$taskType', cost: { $sum: '$totalCost' } } },
        { $sort: { cost: -1 } }
      ])
    ]);

    const totalCost = byModel.reduce((sum, m) => sum + m.cost, 0);

    return {
      byModel: byModel.map(m => ({
        modelId: m._id,
        cost: m.cost,
        percent: totalCost > 0 ? (m.cost / totalCost) * 100 : 0
      })),
      byProvider: byProvider.map(p => ({
        provider: p._id,
        cost: p.cost,
        percent: totalCost > 0 ? (p.cost / totalCost) * 100 : 0
      })),
      byTaskType: byTaskType.map(t => ({
        taskType: t._id || 'unknown',
        cost: t.cost,
        percent: totalCost > 0 ? (t.cost / totalCost) * 100 : 0
      }))
    };
  }

  /**
   * Clear forecast cache
   */
  clearCache(): void {
    this.forecastCache = null;
  }
}

export const costForecastingService = new CostForecastingService();
export default costForecastingService;

