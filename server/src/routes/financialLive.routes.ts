import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { User } from '../models/User.model.js';
import { Package } from '../models/Package.model.js';
import { usageTracker } from '../services/llm/UsageTracker.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/financial/live
 * Get live financial metrics (real-time cost and revenue)
 */
router.get('/live', async (_req: AdminRequest, res, next) => {
  try {
    // Get all active packages with prices
    const packages = await Package.find({ isActive: true }).lean();
    const planPriceMap: Record<string, number> = {};
    
    packages.forEach(pkg => {
      // Convert to monthly price
      let monthlyPrice = pkg.price;
      if (pkg.billingCycle === 'yearly') {
        monthlyPrice = pkg.price / 12;
      } else if (pkg.billingCycle === 'lifetime') {
        monthlyPrice = pkg.price / 120; // Assume 10 year lifetime
      }
      planPriceMap[pkg.displayName] = monthlyPrice;
    });

    // Get current active users by plan
    const usersByPlan = await User.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate live MRR from active subscriptions
    let liveMRR = 0;
    const revenueByPlan: Record<string, {
      users: number;
      price: number;
      mrr: number;
    }> = {};

    usersByPlan.forEach(item => {
      const price = planPriceMap[item._id] || 0;
      const mrr = price * item.count;
      liveMRR += mrr;
      revenueByPlan[item._id] = {
        users: item.count,
        price,
        mrr
      };
    });

    // Get live LLM costs
    // Today's costs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStats = await usageTracker.getUsageStats({
      startDate: todayStart
    });

    // Last 7 days costs
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekStats = await usageTracker.getUsageStats({
      startDate: sevenDaysAgo
    });

    // Last 30 days costs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthStats = await usageTracker.getUsageStats({
      startDate: thirtyDaysAgo
    });

    // Projections
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const projectedMonthlyLLMCost = currentDay > 0 ? (todayStats.totalCost / currentDay) * daysInMonth : 0;

    // Calculate profit metrics
    const netRevenue = liveMRR - projectedMonthlyLLMCost;
    const profitMargin = liveMRR > 0 ? (netRevenue / liveMRR) * 100 : 0;

    res.json({
      success: true,
      data: {
        revenue: {
          liveMRR,
          annualRunRate: liveMRR * 12,
          byPlan: revenueByPlan,
          lastUpdated: new Date().toISOString()
        },
        costs: {
          today: {
            total: todayStats.totalCost,
            calls: todayStats.totalCalls,
            tokens: todayStats.totalTokens
          },
          last7Days: {
            total: weekStats.totalCost,
            calls: weekStats.totalCalls,
            tokens: weekStats.totalTokens,
            avgDaily: weekStats.totalCost / 7
          },
          last30Days: {
            total: monthStats.totalCost,
            calls: monthStats.totalCalls,
            tokens: monthStats.totalTokens,
            avgDaily: monthStats.totalCost / 30
          },
          projected: {
            monthly: projectedMonthlyLLMCost,
            yearly: projectedMonthlyLLMCost * 12
          },
          byProvider: monthStats.byProvider || {},
          lastUpdated: new Date().toISOString()
        },
        profit: {
          netRevenue,
          profitMargin,
          breakEvenMRR: projectedMonthlyLLMCost,
          margin: liveMRR - projectedMonthlyLLMCost
        }
      }
    });
  } catch (error: any) {
    logger.error('Failed to get live financial metrics:', error);
    next(error);
  }
});

export default router;

