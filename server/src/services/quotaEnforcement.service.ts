/**
 * Quota Enforcement Service
 * Manages and enforces usage quotas for users, projects, and globally
 */

import { UsageQuota, IUsageQuota } from '../models/UsageQuota.model.js';
import { logger } from '../utils/logger.js';

export interface QuotaCheckResult {
  allowed: boolean;
  quotaType: 'user' | 'project' | 'global' | null;
  limitType: 'cost' | 'tokens' | 'requests' | null;
  currentUsage: number;
  limit: number;
  percentUsed: number;
  message: string;
}

export interface QuotaAlert {
  quotaId: string;
  targetType: 'user' | 'project' | 'global';
  targetId?: string;
  targetName?: string;
  threshold: 50 | 75 | 90 | 100;
  limitType: 'cost' | 'tokens' | 'requests';
  period: 'daily' | 'weekly' | 'monthly';
  currentUsage: number;
  limit: number;
  timestamp: Date;
}

class QuotaEnforcementService {
  private alertCallbacks: Array<(alert: QuotaAlert) => void> = [];

  /**
   * Register a callback for quota alerts
   */
  onAlert(callback: (alert: QuotaAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Emit a quota alert
   */
  private emitAlert(alert: QuotaAlert): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('[QuotaEnforcement] Alert callback error:', error);
      }
    }
  }

  /**
   * Check if a request is allowed based on quotas
   */
  async checkQuota(
    userId?: string,
    projectId?: string,
    estimatedCost: number = 0,
    estimatedTokens: number = 0
  ): Promise<QuotaCheckResult> {
    try {
      // Check quotas in order: user -> project -> global
      const quotasToCheck: Array<{ type: 'user' | 'project' | 'global'; id?: string }> = [];
      
      if (userId) {
        quotasToCheck.push({ type: 'user', id: userId });
      }
      if (projectId) {
        quotasToCheck.push({ type: 'project', id: projectId });
      }
      quotasToCheck.push({ type: 'global' });

      for (const { type, id } of quotasToCheck) {
        const quota = await this.getQuota(type, id);
        if (!quota || !quota.enabled) continue;

        // Reset usage if needed
        await this.resetUsageIfNeeded(quota);

        // Check each limit type
        const checks = [
          this.checkCostLimit(quota, estimatedCost),
          this.checkTokenLimit(quota, estimatedTokens),
          this.checkRequestLimit(quota),
        ];

        for (const check of checks) {
          if (!check.allowed && quota.hardLimit) {
            return check;
          }
        }
      }

      return {
        allowed: true,
        quotaType: null,
        limitType: null,
        currentUsage: 0,
        limit: 0,
        percentUsed: 0,
        message: 'Request allowed',
      };
    } catch (error) {
      logger.error('[QuotaEnforcement] Check quota error:', error);
      // Allow on error to prevent blocking
      return {
        allowed: true,
        quotaType: null,
        limitType: null,
        currentUsage: 0,
        limit: 0,
        percentUsed: 0,
        message: 'Quota check failed, allowing request',
      };
    }
  }

  /**
   * Record usage and update quotas
   */
  async recordUsage(
    userId?: string,
    projectId?: string,
    cost: number = 0,
    tokens: number = 0
  ): Promise<void> {
    try {
      const quotasToUpdate: Array<{ type: 'user' | 'project' | 'global'; id?: string }> = [];
      
      if (userId) {
        quotasToUpdate.push({ type: 'user', id: userId });
      }
      if (projectId) {
        quotasToUpdate.push({ type: 'project', id: projectId });
      }
      quotasToUpdate.push({ type: 'global' });

      for (const { type, id } of quotasToUpdate) {
        const quota = await this.getQuota(type, id);
        if (!quota) continue;

        // Reset if needed
        await this.resetUsageIfNeeded(quota);

        // Update usage
        quota.currentUsage.daily.cost += cost;
        quota.currentUsage.daily.tokens += tokens;
        quota.currentUsage.daily.requests += 1;

        quota.currentUsage.weekly.cost += cost;
        quota.currentUsage.weekly.tokens += tokens;
        quota.currentUsage.weekly.requests += 1;

        quota.currentUsage.monthly.cost += cost;
        quota.currentUsage.monthly.tokens += tokens;
        quota.currentUsage.monthly.requests += 1;

        await quota.save();

        // Check for alerts
        await this.checkAndEmitAlerts(quota);
      }
    } catch (error) {
      logger.error('[QuotaEnforcement] Record usage error:', error);
    }
  }

  /**
   * Get a quota by type and ID
   */
  async getQuota(
    targetType: 'user' | 'project' | 'global',
    targetId?: string
  ): Promise<IUsageQuota | null> {
    if (targetType === 'global') {
      return UsageQuota.findOne({ targetType: 'global' });
    }
    return UsageQuota.findOne({ targetType, targetId });
  }

  /**
   * Get all quotas
   */
  async getAllQuotas(): Promise<IUsageQuota[]> {
    return UsageQuota.find().sort({ targetType: 1, targetName: 1 });
  }

  /**
   * Create or update a quota
   */
  async upsertQuota(
    targetType: 'user' | 'project' | 'global',
    targetId: string | undefined,
    data: Partial<IUsageQuota>
  ): Promise<IUsageQuota> {
    const query = targetType === 'global'
      ? { targetType: 'global' }
      : { targetType, targetId };

    const quota = await UsageQuota.findOneAndUpdate(
      query,
      {
        ...data,
        targetType,
        targetId: targetType === 'global' ? undefined : targetId,
      },
      { upsert: true, new: true }
    );

    logger.info(`[QuotaEnforcement] Quota upserted for ${targetType}:${targetId || 'global'}`);
    return quota;
  }

  /**
   * Delete a quota
   */
  async deleteQuota(quotaId: string): Promise<boolean> {
    const result = await UsageQuota.findByIdAndDelete(quotaId);
    return !!result;
  }

  /**
   * Reset usage for a quota
   */
  async resetUsage(
    quotaId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'all'
  ): Promise<void> {
    const quota = await UsageQuota.findById(quotaId);
    if (!quota) return;

    const now = new Date();

    if (period === 'daily' || period === 'all') {
      quota.currentUsage.daily = {
        cost: 0,
        tokens: 0,
        requests: 0,
        lastReset: now,
      };
    }

    if (period === 'weekly' || period === 'all') {
      quota.currentUsage.weekly = {
        cost: 0,
        tokens: 0,
        requests: 0,
        lastReset: now,
      };
    }

    if (period === 'monthly' || period === 'all') {
      quota.currentUsage.monthly = {
        cost: 0,
        tokens: 0,
        requests: 0,
        lastReset: now,
      };
    }

    await quota.save();
    logger.info(`[QuotaEnforcement] Usage reset for quota ${quotaId} (${period})`);
  }

  /**
   * Check and reset usage if period has elapsed
   */
  private async resetUsageIfNeeded(quota: IUsageQuota): Promise<void> {
    const now = new Date();
    let needsSave = false;

    // Daily reset (check if last reset was before today)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (quota.currentUsage.daily.lastReset < todayStart) {
      quota.currentUsage.daily = {
        cost: 0,
        tokens: 0,
        requests: 0,
        lastReset: now,
      };
      needsSave = true;
    }

    // Weekly reset (check if last reset was more than 7 days ago)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (quota.currentUsage.weekly.lastReset < weekAgo) {
      quota.currentUsage.weekly = {
        cost: 0,
        tokens: 0,
        requests: 0,
        lastReset: now,
      };
      needsSave = true;
    }

    // Monthly reset (check if last reset was in a previous month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (quota.currentUsage.monthly.lastReset < monthStart) {
      quota.currentUsage.monthly = {
        cost: 0,
        tokens: 0,
        requests: 0,
        lastReset: now,
      };
      needsSave = true;
    }

    if (needsSave) {
      await quota.save();
    }
  }

  /**
   * Check cost limits
   */
  private checkCostLimit(quota: IUsageQuota, estimatedCost: number): QuotaCheckResult {
    // Check daily
    if (quota.dailyLimit) {
      const newUsage = quota.currentUsage.daily.cost + estimatedCost;
      if (newUsage > quota.dailyLimit) {
        return {
          allowed: false,
          quotaType: quota.targetType,
          limitType: 'cost',
          currentUsage: quota.currentUsage.daily.cost,
          limit: quota.dailyLimit,
          percentUsed: (quota.currentUsage.daily.cost / quota.dailyLimit) * 100,
          message: `Daily cost limit exceeded (${quota.currentUsage.daily.cost.toFixed(2)}/${quota.dailyLimit.toFixed(2)} USD)`,
        };
      }
    }

    // Check monthly
    if (quota.monthlyLimit) {
      const newUsage = quota.currentUsage.monthly.cost + estimatedCost;
      if (newUsage > quota.monthlyLimit) {
        return {
          allowed: false,
          quotaType: quota.targetType,
          limitType: 'cost',
          currentUsage: quota.currentUsage.monthly.cost,
          limit: quota.monthlyLimit,
          percentUsed: (quota.currentUsage.monthly.cost / quota.monthlyLimit) * 100,
          message: `Monthly cost limit exceeded (${quota.currentUsage.monthly.cost.toFixed(2)}/${quota.monthlyLimit.toFixed(2)} USD)`,
        };
      }
    }

    return {
      allowed: true,
      quotaType: null,
      limitType: null,
      currentUsage: 0,
      limit: 0,
      percentUsed: 0,
      message: 'Cost within limits',
    };
  }

  /**
   * Check token limits
   */
  private checkTokenLimit(quota: IUsageQuota, estimatedTokens: number): QuotaCheckResult {
    if (quota.dailyTokenLimit) {
      const newUsage = quota.currentUsage.daily.tokens + estimatedTokens;
      if (newUsage > quota.dailyTokenLimit) {
        return {
          allowed: false,
          quotaType: quota.targetType,
          limitType: 'tokens',
          currentUsage: quota.currentUsage.daily.tokens,
          limit: quota.dailyTokenLimit,
          percentUsed: (quota.currentUsage.daily.tokens / quota.dailyTokenLimit) * 100,
          message: `Daily token limit exceeded`,
        };
      }
    }

    if (quota.monthlyTokenLimit) {
      const newUsage = quota.currentUsage.monthly.tokens + estimatedTokens;
      if (newUsage > quota.monthlyTokenLimit) {
        return {
          allowed: false,
          quotaType: quota.targetType,
          limitType: 'tokens',
          currentUsage: quota.currentUsage.monthly.tokens,
          limit: quota.monthlyTokenLimit,
          percentUsed: (quota.currentUsage.monthly.tokens / quota.monthlyTokenLimit) * 100,
          message: `Monthly token limit exceeded`,
        };
      }
    }

    return {
      allowed: true,
      quotaType: null,
      limitType: null,
      currentUsage: 0,
      limit: 0,
      percentUsed: 0,
      message: 'Tokens within limits',
    };
  }

  /**
   * Check request limits
   */
  private checkRequestLimit(quota: IUsageQuota): QuotaCheckResult {
    if (quota.dailyRequestLimit) {
      if (quota.currentUsage.daily.requests >= quota.dailyRequestLimit) {
        return {
          allowed: false,
          quotaType: quota.targetType,
          limitType: 'requests',
          currentUsage: quota.currentUsage.daily.requests,
          limit: quota.dailyRequestLimit,
          percentUsed: (quota.currentUsage.daily.requests / quota.dailyRequestLimit) * 100,
          message: `Daily request limit exceeded`,
        };
      }
    }

    if (quota.monthlyRequestLimit) {
      if (quota.currentUsage.monthly.requests >= quota.monthlyRequestLimit) {
        return {
          allowed: false,
          quotaType: quota.targetType,
          limitType: 'requests',
          currentUsage: quota.currentUsage.monthly.requests,
          limit: quota.monthlyRequestLimit,
          percentUsed: (quota.currentUsage.monthly.requests / quota.monthlyRequestLimit) * 100,
          message: `Monthly request limit exceeded`,
        };
      }
    }

    return {
      allowed: true,
      quotaType: null,
      limitType: null,
      currentUsage: 0,
      limit: 0,
      percentUsed: 0,
      message: 'Requests within limits',
    };
  }

  /**
   * Check and emit alerts for quota thresholds
   */
  private async checkAndEmitAlerts(quota: IUsageQuota): Promise<void> {
    const thresholds = [50, 75, 90, 100] as const;
    const periods = ['daily', 'monthly'] as const;
    const limitTypes = [
      { key: 'cost', limitField: 'dailyLimit', monthlyField: 'monthlyLimit' },
      { key: 'tokens', limitField: 'dailyTokenLimit', monthlyField: 'monthlyTokenLimit' },
      { key: 'requests', limitField: 'dailyRequestLimit', monthlyField: 'monthlyRequestLimit' },
    ] as const;

    for (const period of periods) {
      for (const { key, limitField, monthlyField } of limitTypes) {
        const limit = period === 'daily' 
          ? (quota as any)[limitField] 
          : (quota as any)[monthlyField];
        
        if (!limit) continue;

        const usage = quota.currentUsage[period][key as 'cost' | 'tokens' | 'requests'];
        const percentUsed = (usage / limit) * 100;

        for (const threshold of thresholds) {
          const alertKey = `threshold${threshold}` as keyof typeof quota.alerts;
          if (!quota.alerts[alertKey]) continue;

          if (percentUsed >= threshold) {
            this.emitAlert({
              quotaId: quota._id.toString(),
              targetType: quota.targetType,
              targetId: quota.targetId,
              targetName: quota.targetName,
              threshold,
              limitType: key as 'cost' | 'tokens' | 'requests',
              period,
              currentUsage: usage,
              limit,
              timestamp: new Date(),
            });
          }
        }
      }
    }
  }
}

export const quotaEnforcementService = new QuotaEnforcementService();
export default quotaEnforcementService;

