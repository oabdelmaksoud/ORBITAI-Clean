/**
 * LLM Usage Tracker Service
 * Tracks LLM API calls, token usage, and costs
 */

import mongoose from 'mongoose';
import { LLMUsage } from '../../models/LLMUsage.model.js';
import { ModelRegistry, modelRegistry } from './models/ModelRegistry.js';
import { logger } from '../../utils/logger.js';

export interface UsageTrackingData {
  userId?: string;
  projectId?: string;
  modelId: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'ollama' | 'vllm' | 'openai_compatible' | 'custom';
  modelIdentifier: string;
  inputTokens: number;
  outputTokens: number;
  requestType: string;
  agentRole?: string;
  taskType?: string;
  context?: 'wizard' | 'workspace' | 'other'; // Where the LLM call was made
  routerType?: 'end-user' | 'internal' | 'specific' | string; // Which router handled this request
  success: boolean;
  errorMessage?: string;
  latencyMs?: number;
  metadata?: Record<string, any>;
}

export class UsageTracker {
  /**
   * Track an LLM API call
   */
  async trackUsage(data: UsageTrackingData): Promise<void> {
    try {
      // Check if MongoDB is connected before tracking
      if (mongoose.connection.readyState !== 1) {
        logger.debug('MongoDB not connected, skipping usage tracking');
        return;
      }

      // Get model pricing from registry
      const model = modelRegistry.getModel(data.modelId);
      if (!model) {
        logger.warn(`Model ${data.modelId} not found in registry, using default pricing`);
      }

      // Calculate costs
      const inputCost = this.calculateCost(
        data.inputTokens,
        model?.pricing.inputCostPer1MTokens || 0.1
      );
      const outputCost = this.calculateCost(
        data.outputTokens,
        model?.pricing.outputCostPer1MTokens || 0.3
      );
      const totalCost = inputCost + outputCost;

      // Create usage record
      const usage = new LLMUsage({
        userId: data.userId,
        projectId: data.projectId,
        modelId: data.modelId,
        provider: data.provider,
        modelIdentifier: data.modelIdentifier,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.inputTokens + data.outputTokens,
        inputCost,
        outputCost,
        totalCost,
        requestType: data.requestType,
        agentRole: data.agentRole,
        taskType: data.taskType,
        context: data.context || 'other',
        routerType: data.routerType,
        timestamp: new Date(),
        success: data.success,
        errorMessage: data.errorMessage,
        latencyMs: data.latencyMs,
        metadata: data.metadata || {}
      });

      await usage.save();

      // Update RL router with reward (async, non-blocking)
      if (data.agentRole && data.taskType) {
        try {
          const { rlRouterService } = await import('../llmRouterRL.service.js');
          const reward = rlRouterService.calculateReward({
            success: data.success !== false,
            cost: totalCost,
            latency: data.latencyMs || 1000,
            expectedCost: undefined,
            expectedLatency: undefined
          });

          await rlRouterService.updateReward({
            modelId: data.modelId,
            taskType: data.taskType,
            agentRole: data.agentRole,
            reward,
            cost: totalCost,
            latency: data.latencyMs || 1000,
            success: data.success !== false
          });
        } catch (rlError) {
          // RL updates shouldn't break tracking
          logger.debug('RL reward update skipped:', rlError);
        }
      }

      // Trigger knowledge learning if agentRole is present
      if (data.agentRole) {
        try {
          const { learnFromLLMUsage } = await import('../../middleware/agentKnowledgeLearning.js');
          await learnFromLLMUsage(
            data.agentRole,
            data.modelId,
            data.provider,
            data.success !== false,
            data.latencyMs
          );
        } catch (learningError) {
          // Learning failures shouldn't break tracking
          logger.debug('Knowledge learning skipped:', learningError);
        }
      }
    } catch (error: any) {
      logger.error('Failed to track LLM usage:', error);
      // Don't throw - tracking failure shouldn't break the request
    }
  }

  /**
   * Calculate cost from tokens and price per 1M tokens
   */
  private calculateCost(tokens: number, pricePer1MTokens: number): number {
    return (tokens / 1_000_000) * pricePer1MTokens;
  }

  /**
   * Get usage statistics for a time period
   */
  async getUsageStats(options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    projectId?: string;
    provider?: string;
    modelId?: string;
  } = {}): Promise<{
    totalCalls: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    byProvider: Record<string, any>;
    byModel: Record<string, any>;
    recentCalls: any[];
  }> {
    try {
      const { startDate, endDate, userId, projectId, provider, modelId } = options;

      // Build query
      const query: any = {};
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }
      if (userId) query.userId = userId;
      if (projectId) query.projectId = projectId;
      if (provider) query.provider = provider;
      if (modelId) query.modelId = modelId;

      // Aggregate usage
      const allUsage = await LLMUsage.find(query).lean();

      // Calculate totals
      const totalCalls = allUsage.length;
      const totalTokens = allUsage.reduce((sum, u) => sum + u.totalTokens, 0);
      const inputTokens = allUsage.reduce((sum, u) => sum + u.inputTokens, 0);
      const outputTokens = allUsage.reduce((sum, u) => sum + u.outputTokens, 0);
      const totalCost = allUsage.reduce((sum, u) => sum + u.totalCost, 0);

      // Group by provider
      const byProvider: Record<string, any> = {};
      allUsage.forEach(u => {
        if (!byProvider[u.provider]) {
          byProvider[u.provider] = {
            calls: 0,
            tokens: 0,
            cost: 0
          };
        }
        byProvider[u.provider].calls++;
        byProvider[u.provider].tokens += u.totalTokens;
        byProvider[u.provider].cost += u.totalCost;
      });

      // Group by model
      const byModel: Record<string, any> = {};
      allUsage.forEach(u => {
        if (!byModel[u.modelId]) {
          byModel[u.modelId] = {
            calls: 0,
            tokens: 0,
            cost: 0,
            provider: u.provider
          };
        }
        byModel[u.modelId].calls++;
        byModel[u.modelId].tokens += u.totalTokens;
        byModel[u.modelId].cost += u.totalCost;
      });

      // Get recent calls (last 10)
      const recentCalls = await LLMUsage.find(query)
        .sort({ timestamp: -1 })
        .limit(10)
        .lean()
        .select('modelId provider inputTokens outputTokens totalCost timestamp success requestType');

      return {
        totalCalls,
        totalTokens,
        inputTokens,
        outputTokens,
        totalCost,
        byProvider,
        byModel,
        recentCalls
      };
    } catch (error: any) {
      logger.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  /**
   * Get live/real-time usage (last N minutes)
   */
  async getLiveUsage(minutes: number = 5): Promise<{
    calls: number;
    tokens: number;
    cost: number;
    rate: number; // Calls per minute
    byModel: Record<string, any>;
  }> {
    const startDate = new Date(Date.now() - minutes * 60 * 1000);

    const stats = await this.getUsageStats({
      startDate
    });

    return {
      calls: stats.totalCalls,
      tokens: stats.totalTokens,
      cost: stats.totalCost,
      rate: stats.totalCalls / minutes,
      byModel: stats.byModel
    };
  }

  /**
   * Get cost breakdown by time period
   */
  async getCostBreakdown(period: 'today' | 'week' | 'month' = 'today'): Promise<{
    period: string;
    totalCost: number;
    dailyCosts: { date: string; cost: number; calls: number; tokens: number }[];
    byProvider: Record<string, number>;
  }> {
    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const allUsage = await LLMUsage.find({
      timestamp: { $gte: startDate }
    }).lean();

    // Group by day
    const dailyCosts: Record<string, { cost: number; calls: number; tokens: number }> = {};
    const byProvider: Record<string, number> = {};

    allUsage.forEach(u => {
      const date = new Date(u.timestamp).toISOString().split('T')[0];
      if (!dailyCosts[date]) {
        dailyCosts[date] = { cost: 0, calls: 0, tokens: 0 };
      }
      dailyCosts[date].cost += u.totalCost;
      dailyCosts[date].calls++;
      dailyCosts[date].tokens += u.totalTokens;

      byProvider[u.provider] = (byProvider[u.provider] || 0) + u.totalCost;
    });

    return {
      period,
      totalCost: allUsage.reduce((sum, u) => sum + u.totalCost, 0),
      dailyCosts: Object.entries(dailyCosts).map(([date, data]) => ({
        date,
        ...data
      })).sort((a, b) => a.date.localeCompare(b.date)),
      byProvider
    };
  }
}

export const usageTracker = new UsageTracker();

