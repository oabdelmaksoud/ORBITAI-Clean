/**
 * System Cost Tracking Service
 * Tracks ALL API usage - both user-initiated and system-initiated
 */

import { LLMUsage } from '../models/LLMUsage.model.js';
import { AppError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

export interface SystemCostBreakdown {
  totalCost: number;
  userInitiatedCost: number;
  systemInitiatedCost: number;
  byProvider: Record<string, {
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
    tokens: number;
  }>;
  byModel: Record<string, {
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
    tokens: number;
  }>;
  byRequestType: Record<string, {
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
  }>;
  byContext: Record<string, {
    totalCost: number;
    calls: number;
  }>;
  timeSeries: Array<{
    date: string;
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
  }>;
  topUsers: Array<{
    userId: string;
    totalCost: number;
    calls: number;
    tokens: number;
  }>;
  topProjects: Array<{
    projectId: string;
    totalCost: number;
    calls: number;
    tokens: number;
  }>;
  systemOperations: Array<{
    operation: string;
    totalCost: number;
    calls: number;
  }>;
}

export interface CostAnalysisOptions {
  startDate?: Date;
  endDate?: Date;
  provider?: string;
  modelId?: string;
  includeSystemCalls?: boolean;
  includeUserCalls?: boolean;
  groupBy?: 'day' | 'hour' | 'week' | 'month';
}

export class SystemCostTrackingService {
  /**
   * Check if a usage record is system-initiated
   */
  private isSystemCall(usage: any): boolean {
    return !usage.userId && !usage.projectId;
  }

  /**
   * Get comprehensive system cost breakdown
   */
  async getSystemCostBreakdown(
    options: CostAnalysisOptions = {}
  ): Promise<SystemCostBreakdown> {
    try {
      const {
        startDate,
        endDate,
        provider,
        modelId,
        includeSystemCalls = true,
        includeUserCalls = true,
        groupBy = 'day'
      } = options;

      // Build query
      const query: any = {};
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }
      
      if (provider) query.provider = provider;
      if (modelId) query.modelId = modelId;

      // Filter by call type if specified
      if (!includeSystemCalls && !includeUserCalls) {
        // Return empty if both excluded
        return this.getEmptyBreakdown();
      } else if (!includeSystemCalls) {
        query.$or = [
          { userId: { $exists: true, $ne: null } },
          { projectId: { $exists: true, $ne: null } }
        ];
      } else if (!includeUserCalls) {
        query.$and = [
          { userId: { $exists: false } },
          { projectId: { $exists: false } }
        ];
      }

      // Fetch all usage records
      const allUsage = await LLMUsage.find(query).lean();

      // Initialize breakdown
      const breakdown: SystemCostBreakdown = {
        totalCost: 0,
        userInitiatedCost: 0,
        systemInitiatedCost: 0,
        byProvider: {},
        byModel: {},
        byRequestType: {},
        byContext: {},
        timeSeries: [],
        topUsers: [],
        topProjects: [],
        systemOperations: []
      };

      // Process each usage record
      for (const usage of allUsage) {
        const isSystem = this.isSystemCall(usage);
        const cost = usage.totalCost || 0;
        const tokens = usage.totalTokens || 0;

        // Update totals
        breakdown.totalCost += cost;
        if (isSystem) {
          breakdown.systemInitiatedCost += cost;
        } else {
          breakdown.userInitiatedCost += cost;
        }

        // By provider
        if (!breakdown.byProvider[usage.provider]) {
          breakdown.byProvider[usage.provider] = {
            totalCost: 0,
            userInitiatedCost: 0,
            systemInitiatedCost: 0,
            calls: 0,
            tokens: 0
          };
        }
        breakdown.byProvider[usage.provider].totalCost += cost;
        breakdown.byProvider[usage.provider].calls += 1;
        breakdown.byProvider[usage.provider].tokens += tokens;
        if (isSystem) {
          breakdown.byProvider[usage.provider].systemInitiatedCost += cost;
        } else {
          breakdown.byProvider[usage.provider].userInitiatedCost += cost;
        }

        // By model
        if (!breakdown.byModel[usage.modelId]) {
          breakdown.byModel[usage.modelId] = {
            totalCost: 0,
            userInitiatedCost: 0,
            systemInitiatedCost: 0,
            calls: 0,
            tokens: 0
          };
        }
        breakdown.byModel[usage.modelId].totalCost += cost;
        breakdown.byModel[usage.modelId].calls += 1;
        breakdown.byModel[usage.modelId].tokens += tokens;
        if (isSystem) {
          breakdown.byModel[usage.modelId].systemInitiatedCost += cost;
        } else {
          breakdown.byModel[usage.modelId].userInitiatedCost += cost;
        }

        // By request type
        if (!breakdown.byRequestType[usage.requestType]) {
          breakdown.byRequestType[usage.requestType] = {
            totalCost: 0,
            userInitiatedCost: 0,
            systemInitiatedCost: 0,
            calls: 0
          };
        }
        breakdown.byRequestType[usage.requestType].totalCost += cost;
        breakdown.byRequestType[usage.requestType].calls += 1;
        if (isSystem) {
          breakdown.byRequestType[usage.requestType].systemInitiatedCost += cost;
        } else {
          breakdown.byRequestType[usage.requestType].userInitiatedCost += cost;
        }

        // By context
        const context = usage.context || 'other';
        if (!breakdown.byContext[context]) {
          breakdown.byContext[context] = {
            totalCost: 0,
            calls: 0
          };
        }
        breakdown.byContext[context].totalCost += cost;
        breakdown.byContext[context].calls += 1;

        // Top users
        if (usage.userId) {
          const userIndex = breakdown.topUsers.findIndex(u => u.userId === usage.userId);
          if (userIndex === -1) {
            breakdown.topUsers.push({
              userId: usage.userId,
              totalCost: cost,
              calls: 1,
              tokens
            });
          } else {
            breakdown.topUsers[userIndex].totalCost += cost;
            breakdown.topUsers[userIndex].calls += 1;
            breakdown.topUsers[userIndex].tokens += tokens;
          }
        }

        // Top projects
        if (usage.projectId) {
          const projectIndex = breakdown.topProjects.findIndex(p => p.projectId === usage.projectId);
          if (projectIndex === -1) {
            breakdown.topProjects.push({
              projectId: usage.projectId,
              totalCost: cost,
              calls: 1,
              tokens
            });
          } else {
            breakdown.topProjects[projectIndex].totalCost += cost;
            breakdown.topProjects[projectIndex].calls += 1;
            breakdown.topProjects[projectIndex].tokens += tokens;
          }
        }

        // System operations (for system calls, use requestType as operation)
        if (isSystem) {
          const operation = usage.requestType || 'unknown';
          const opIndex = breakdown.systemOperations.findIndex(o => o.operation === operation);
          if (opIndex === -1) {
            breakdown.systemOperations.push({
              operation,
              totalCost: cost,
              calls: 1
            });
          } else {
            breakdown.systemOperations[opIndex].totalCost += cost;
            breakdown.systemOperations[opIndex].calls += 1;
          }
        }
      }

      // Sort top users and projects
      breakdown.topUsers.sort((a, b) => b.totalCost - a.totalCost);
      breakdown.topProjects.sort((a, b) => b.totalCost - a.totalCost);
      breakdown.systemOperations.sort((a, b) => b.totalCost - a.totalCost);

      // Limit to top 10
      breakdown.topUsers = breakdown.topUsers.slice(0, 10);
      breakdown.topProjects = breakdown.topProjects.slice(0, 10);
      breakdown.systemOperations = breakdown.systemOperations.slice(0, 20);

      // Generate time series
      breakdown.timeSeries = await this.generateTimeSeries(query, groupBy);

      return breakdown;
    } catch (error: any) {
      throw new AppError(`Failed to get system cost breakdown: ${error.message}`, 500);
    }
  }

  /**
   * Generate time series data
   */
  private async generateTimeSeries(
    query: any,
    groupBy: 'day' | 'hour' | 'week' | 'month'
  ): Promise<Array<{
    date: string;
    totalCost: number;
    userInitiatedCost: number;
    systemInitiatedCost: number;
    calls: number;
  }>> {
    try {
      let dateFormat: string;
      let dateGroup: any;

      switch (groupBy) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00:00';
          dateGroup = {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            hour: { $hour: '$timestamp' }
          };
          break;
        case 'day':
          dateFormat = '%Y-%m-%d';
          dateGroup = {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          };
          break;
        case 'week':
          dateFormat = '%Y-W%V';
          dateGroup = {
            year: { $year: '$timestamp' },
            week: { $week: '$timestamp' }
          };
          break;
        case 'month':
          dateFormat = '%Y-%m';
          dateGroup = {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' }
          };
          break;
      }

      const pipeline: any[] = [
        { $match: query },
        {
          $group: {
            _id: dateGroup,
            totalCost: { $sum: '$totalCost' },
            userInitiatedCost: {
              $sum: {
                $cond: [
                  { $or: [{ $ne: ['$userId', null] }, { $ne: ['$projectId', null] }] },
                  '$totalCost',
                  0
                ]
              }
            },
            systemInitiatedCost: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$userId', null] }, { $eq: ['$projectId', null] }] },
                  '$totalCost',
                  0
                ]
              }
            },
            calls: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ];

      const results = await LLMUsage.aggregate(pipeline);

      return results.map((result: any) => {
        let dateStr = '';
        if (groupBy === 'hour') {
          dateStr = `${result._id.year}-${String(result._id.month).padStart(2, '0')}-${String(result._id.day).padStart(2, '0')} ${String(result._id.hour).padStart(2, '0')}:00:00`;
        } else if (groupBy === 'day') {
          dateStr = `${result._id.year}-${String(result._id.month).padStart(2, '0')}-${String(result._id.day).padStart(2, '0')}`;
        } else if (groupBy === 'week') {
          dateStr = `${result._id.year}-W${String(result._id.week).padStart(2, '0')}`;
        } else if (groupBy === 'month') {
          dateStr = `${result._id.year}-${String(result._id.month).padStart(2, '0')}`;
        }

        return {
          date: dateStr,
          totalCost: result.totalCost || 0,
          userInitiatedCost: result.userInitiatedCost || 0,
          systemInitiatedCost: result.systemInitiatedCost || 0,
          calls: result.calls || 0
        };
      });
    } catch (error: any) {
      // If aggregation fails, return empty array
      return [];
    }
  }

  /**
   * Get empty breakdown structure
   */
  private getEmptyBreakdown(): SystemCostBreakdown {
    return {
      totalCost: 0,
      userInitiatedCost: 0,
      systemInitiatedCost: 0,
      byProvider: {},
      byModel: {},
      byRequestType: {},
      byContext: {},
      timeSeries: [],
      topUsers: [],
      topProjects: [],
      systemOperations: []
    };
  }

  /**
   * Get cost summary for a specific period
   */
  async getCostSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number;
    userCost: number;
    systemCost: number;
    totalCalls: number;
    userCalls: number;
    systemCalls: number;
    averageCostPerCall: number;
    costPerDay: number;
  }> {
    try {
      const query = {
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      };

      const [userUsage, systemUsage] = await Promise.all([
        LLMUsage.find({
          ...query,
          $or: [
            { userId: { $exists: true, $ne: null } },
            { projectId: { $exists: true, $ne: null } }
          ]
        }).lean(),
        LLMUsage.find({
          ...query,
          $and: [
            { userId: { $exists: false } },
            { projectId: { $exists: false } }
          ]
        }).lean()
      ]);

      const userCost = userUsage.reduce((sum, u) => sum + (u.totalCost || 0), 0);
      const systemCost = systemUsage.reduce((sum, u) => sum + (u.totalCost || 0), 0);
      const totalCost = userCost + systemCost;

      const userCalls = userUsage.length;
      const systemCalls = systemUsage.length;
      const totalCalls = userCalls + systemCalls;

      const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        totalCost,
        userCost,
        systemCost,
        totalCalls,
        userCalls,
        systemCalls,
        averageCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
        costPerDay: totalCost / daysDiff
      };
    } catch (error: any) {
      throw new AppError(`Failed to get cost summary: ${error.message}`, 500);
    }
  }
}

export const systemCostTrackingService = new SystemCostTrackingService();




