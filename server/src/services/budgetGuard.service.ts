/**
 * Budget Guard (cost governance — dimension 16).
 *
 * The harness tracked spend (LLMUsage) but never ENFORCED it. This guard blocks a request when the
 * user's month-to-date LLM spend has reached their configured monthly cap
 * (routingContext.packageLimits.maxMonthlyBudget). Fail-closed on the cap; fail-open on infra error
 * (a Mongo hiccup must not block all traffic — only a real over-cap reading does).
 */

import { logger } from '../utils/logger.js';
import { LLMUsage } from '../models/LLMUsage.model.js';

export class BudgetExceededError extends Error {
  public readonly statusCode = 402; // Payment Required
  constructor(
    public readonly spent: number,
    public readonly cap: number
  ) {
    super(`Monthly LLM budget exceeded: $${spent.toFixed(2)} of $${cap.toFixed(2)} cap`);
    this.name = 'BudgetExceededError';
  }
}

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

class BudgetGuard {
  /** Month-to-date total LLM cost (USD) for a user. */
  async getMonthlySpend(userId: string): Promise<number> {
    const agg = await LLMUsage.aggregate([
      { $match: { userId, timestamp: { $gte: startOfMonthUtc() } } },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ]);
    return agg?.[0]?.total || 0;
  }

  /**
   * Throw BudgetExceededError if the user is at/over their monthly cap. No-op when no user or no cap
   * is configured (so the common path pays nothing). DB errors fail open (logged, request allowed).
   */
  async assertWithinBudget(userId?: string, maxMonthlyBudget?: number): Promise<void> {
    if (!userId || !maxMonthlyBudget || maxMonthlyBudget <= 0) return;
    try {
      const spent = await this.getMonthlySpend(userId);
      if (spent >= maxMonthlyBudget) {
        logger.warn(`[BudgetGuard] Blocking request: user ${userId} spent $${spent} of $${maxMonthlyBudget} cap`);
        throw new BudgetExceededError(spent, maxMonthlyBudget);
      }
    } catch (error) {
      if (error instanceof BudgetExceededError) throw error;
      logger.warn('[BudgetGuard] Budget check failed (allowing request):', error);
    }
  }
}

export const budgetGuard = new BudgetGuard();
