import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { User } from '../models/User.model.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/financial/forecast
 * Revenue forecasting based on historical data and trends
 */
router.get('/forecast', async (_req: AdminRequest, res, next) => {
  try {
    const { Package } = await import('../models/Package.model.js');
    const packages = await Package.find({ isActive: true }).lean();
    const planPrices: Record<string, number> = {};
    
    packages.forEach(pkg => {
      let monthlyPrice = pkg.price;
      if (pkg.billingCycle === 'yearly') {
        monthlyPrice = pkg.price / 12;
      } else if (pkg.billingCycle === 'lifetime') {
        monthlyPrice = pkg.price / 120;
      }
      planPrices[pkg.displayName] = monthlyPrice;
    });

    const now = new Date();
    const months = 12; // Forecast 12 months ahead

    // Get historical user signups by month
    // Convert createdAt to Date if it's stored as string
    const historicalSignups = await User.aggregate([
      {
        $addFields: {
          createdAtDate: {
            $cond: {
              if: { $eq: [{ $type: '$createdAt' }, 'string'] },
              then: { $toDate: '$createdAt' },
              else: '$createdAt'
            }
          }
        }
      },
      {
        $match: {
          createdAtDate: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAtDate' },
            month: { $month: '$createdAtDate' }
          },
          count: { $sum: 1 },
          plans: { $push: '$plan' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Calculate average monthly growth rate
    const recentMonths = historicalSignups.slice(-6); // Last 6 months
    let totalGrowth = 0;
    for (let i = 1; i < recentMonths.length; i++) {
      const growth = ((recentMonths[i].count - recentMonths[i - 1].count) / recentMonths[i - 1].count) * 100;
      totalGrowth += growth;
    }
    const avgGrowthRate = recentMonths.length > 1 ? totalGrowth / (recentMonths.length - 1) : 0;

    // Get current user distribution by plan
    const currentUsers = await User.aggregate([
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 }
        }
      }
    ]);

    const currentMRR = currentUsers.reduce((sum, item) => {
      const price = planPrices[item._id] || 0;
      return sum + (price * item.count);
    }, 0);

    // Forecast future months
    const forecast = [];
    let projectedMRR = currentMRR;
    let projectedUsers = currentUsers.reduce((sum, item) => sum + item.count, 0);

    for (let i = 1; i <= months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      
      // Project user growth
      const monthlyGrowth = avgGrowthRate / 100;
      projectedUsers = Math.round(projectedUsers * (1 + monthlyGrowth));
      
      // Project MRR (assuming same plan distribution)
      const planDistribution = currentUsers.reduce((acc, item) => {
        acc[item._id] = item.count / currentUsers.reduce((sum, u) => sum + u.count, 0);
        return acc;
      }, {} as Record<string, number>);

      projectedMRR = 0;
      Object.keys(planDistribution).forEach(plan => {
        const price = planPrices[plan] || 0;
        const userCount = Math.round(projectedUsers * planDistribution[plan]);
        projectedMRR += price * userCount;
      });

      forecast.push({
        month: monthDate.toISOString().substring(0, 7),
        monthName: monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        projectedMRR: Math.round(projectedMRR * 100) / 100,
        projectedARR: Math.round(projectedMRR * 12 * 100) / 100,
        projectedUsers,
        growthRate: avgGrowthRate
      });
    }

    res.json({
      success: true,
      data: {
        currentMRR,
        currentARR: currentMRR * 12,
        currentUsers: currentUsers.reduce((sum, item) => sum + item.count, 0),
        avgGrowthRate: Math.round(avgGrowthRate * 100) / 100,
        forecast,
        historicalSignups: historicalSignups.map(item => ({
          month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          count: item.count,
          plans: item.plans
        }))
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/financial/ltv
 * Calculate Customer Lifetime Value (LTV)
 */
router.get('/ltv', async (_req: AdminRequest, res, next) => {
  try {
    const { Package } = await import('../models/Package.model.js');
    const packages = await Package.find({ isActive: true }).lean();
    const planPrices: Record<string, number> = {};
    
    packages.forEach(pkg => {
      let monthlyPrice = pkg.price;
      if (pkg.billingCycle === 'yearly') {
        monthlyPrice = pkg.price / 12;
      } else if (pkg.billingCycle === 'lifetime') {
        monthlyPrice = pkg.price / 120;
      }
      planPrices[pkg.displayName] = monthlyPrice;
    });

    const users = await User.find({}).lean();
    const now = new Date();

    // Calculate average customer lifespan (in months)
    const activeUsers = users.filter(u => u.isActive && u.lastLogin);
    const userLifespans = activeUsers.map(user => {
      const signupDate = new Date(user.createdAt);
      const monthsActive = (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsActive;
    });

    const avgLifespan = userLifespans.length > 0
      ? userLifespans.reduce((sum, lifespan) => sum + lifespan, 0) / userLifespans.length
      : 0;

    // Calculate LTV by plan
    const ltvByPlan: Record<string, any> = {};
    const plans = ['Free', 'Pro', 'Enterprise'];

    plans.forEach(plan => {
      const planUsers = users.filter(u => u.plan === plan);
      const planPrice = planPrices[plan] || 0;
      const avgLTV = planPrice * avgLifespan;

      ltvByPlan[plan] = {
        monthlyPrice: planPrice,
        avgLifespan: Math.round(avgLifespan * 100) / 100,
        avgLTV: Math.round(avgLTV * 100) / 100,
        userCount: planUsers.length,
        totalLTV: Math.round(avgLTV * planUsers.length * 100) / 100
      };
    });

    // Overall LTV
    const overallLTV = Object.values(ltvByPlan).reduce((sum: number, plan: any) => {
      return sum + (plan.avgLTV * plan.userCount);
    }, 0) / users.length;

    res.json({
      success: true,
      data: {
        avgLifespan: Math.round(avgLifespan * 100) / 100,
        overallLTV: Math.round(overallLTV * 100) / 100,
        ltvByPlan,
        totalPotentialLTV: Math.round(
          Object.values(ltvByPlan).reduce((sum: number, plan: any) => sum + plan.totalLTV, 0) * 100
        ) / 100
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/financial/churn-impact
 * Analyze impact of churn on revenue
 */
router.get('/churn-impact', async (_req: AdminRequest, res, next) => {
  try {
    const { Package } = await import('../models/Package.model.js');
    const packages = await Package.find({ isActive: true }).lean();
    const planPrices: Record<string, number> = {};
    
    packages.forEach(pkg => {
      let monthlyPrice = pkg.price;
      if (pkg.billingCycle === 'yearly') {
        monthlyPrice = pkg.price / 12;
      } else if (pkg.billingCycle === 'lifetime') {
        monthlyPrice = pkg.price / 120;
      }
      planPrices[pkg.displayName] = monthlyPrice;
    });

    const now = new Date();
    // const _thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    // const _sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Identify churned users (no login in 60+ days)
    const users = await User.find({}).lean();
    const churnedUsers = users.filter(user => {
      if (!user.lastLogin) return true;
      const daysSinceLogin = (now.getTime() - new Date(user.lastLogin).getTime()) / (24 * 60 * 60 * 1000);
      return daysSinceLogin > 60;
    });

    // Calculate lost revenue
    const lostMRR = churnedUsers.reduce((sum, user) => {
      const price = planPrices[user.plan] || 0;
      return sum + price;
    }, 0);

    // Calculate churn rate
    const churnRate = (churnedUsers.length / users.length) * 100;

    // Project future churn (users at risk)
    const atRiskUsers = users.filter(user => {
      if (!user.lastLogin) return true;
      const daysSinceLogin = (now.getTime() - new Date(user.lastLogin).getTime()) / (24 * 60 * 60 * 1000);
      return daysSinceLogin > 30 && daysSinceLogin <= 60;
    });

    const atRiskMRR = atRiskUsers.reduce((sum, user) => {
      const price = planPrices[user.plan] || 0;
      return sum + price;
    }, 0);

    // Calculate impact scenarios
    const scenarios = {
      current: {
        churnedUsers: churnedUsers.length,
        lostMRR: Math.round(lostMRR * 100) / 100,
        lostARR: Math.round(lostMRR * 12 * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100
      },
      ifAtRiskChurn: {
        potentialChurnedUsers: atRiskUsers.length,
        potentialLostMRR: Math.round(atRiskMRR * 100) / 100,
        potentialLostARR: Math.round(atRiskMRR * 12 * 100) / 100,
        totalImpactMRR: Math.round((lostMRR + atRiskMRR) * 100) / 100,
        totalImpactARR: Math.round((lostMRR + atRiskMRR) * 12 * 100) / 100
      }
    };

    // Churn by plan
    const churnByPlan: Record<string, any> = {};
    churnedUsers.forEach(user => {
      if (!churnByPlan[user.plan]) {
        churnByPlan[user.plan] = {
          count: 0,
          lostMRR: 0
        };
      }
      churnByPlan[user.plan].count++;
      churnByPlan[user.plan].lostMRR += planPrices[user.plan] || 0;
    });

    Object.keys(churnByPlan).forEach(plan => {
      churnByPlan[plan].lostMRR = Math.round(churnByPlan[plan].lostMRR * 100) / 100;
      churnByPlan[plan].lostARR = Math.round(churnByPlan[plan].lostMRR * 12 * 100) / 100;
    });

    res.json({
      success: true,
      data: {
        scenarios,
        churnByPlan,
        atRiskUsers: atRiskUsers.length,
        recommendations: [
          atRiskUsers.length > 0 ? `Engage ${atRiskUsers.length} at-risk users to prevent churn` : null,
          churnRate > 10 ? 'Churn rate is high - consider retention campaigns' : null,
          Object.keys(churnByPlan).length > 0 ? 'Focus retention efforts on high-value plans' : null
        ].filter(Boolean)
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;



