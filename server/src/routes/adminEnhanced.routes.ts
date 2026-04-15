import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { User } from '../models/User.model.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

// ============ EXPORT FUNCTIONALITY ============

/**
 * GET /api/admin/export/users
 * Export users to CSV - protected by export_data feature flag
 */
router.get('/export/users', checkFeatureAccess('export_data'), async (req: AdminRequest & FeatureRequest, res, next) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const query: any = {};

    // Apply filters
    if (req.query.role) query.role = req.query.role;
    if (req.query.plan) query.plan = req.query.plan;
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

    const users = await User.find(query).select('-password').lean();

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'ID,Name,Email,Plan,Role,Active,Last Login,Created At\n';
      const csvRows = users.map(u => {
        const lastLogin = u.lastLogin ? new Date(u.lastLogin).toISOString() : '';
        const createdAt = new Date(u.createdAt).toISOString();
        return `${u._id},"${u.name}","${u.email}",${u.plan},${u.role},${u.isActive},${lastLogin},${createdAt}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
      res.send(csvHeader + csvRows);
    } else {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=users-export.json');
      res.json({ users: users.map(u => ({ id: u._id.toString(), ...u, _id: undefined })) });
    }

    await logAudit(req, {
      action: 'users.exported',
      entityType: 'user',
      details: { format, count: users.length }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/export/projects
 * Export projects to CSV - protected by export_data feature flag
 */
router.get('/export/projects', checkFeatureAccess('export_data'), async (req: AdminRequest & FeatureRequest, res, next) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const query: any = {};

    // Apply filters
    if (req.query.phase) query.currentPhase = req.query.phase;
    if (req.query.methodology) query.methodology = req.query.methodology;
    if (req.query.userId) query.userId = req.query.userId;

    const projects = await Project.find(query).lean();

    if (format === 'csv') {
      const csvHeader = 'ID,Name,Description,User ID,Phase,Methodology,Sprint,Tasks Count,Artifacts Count,Created At,Last Modified\n';
      const csvRows = projects.map(p => {
        const tasksCount = Array.isArray(p.tasks) ? p.tasks.length : 0;
        const artifactsCount = Array.isArray(p.artifacts) ? p.artifacts.length : 0;
        const createdAt = new Date(p.createdAt).toISOString();
        const lastModified = p.lastModified ? new Date(p.lastModified).toISOString() : '';
        return `${p._id},"${p.name}","${p.description || ''}",${p.userId},${p.currentPhase || ''},${p.methodology || ''},${p.currentSprint || 1},${tasksCount},${artifactsCount},${createdAt},${lastModified}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=projects-export.csv');
      res.send(csvHeader + csvRows);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=projects-export.json');
      res.json({ projects: projects.map(p => ({ id: p._id.toString(), ...p, _id: undefined })) });
    }

    await logAudit(req, {
      action: 'projects.exported',
      entityType: 'project',
      details: { format, count: projects.length }
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ============ BULK ACTIONS ============

/**
 * POST /api/admin/bulk/users
 * Perform bulk actions on users
 */
router.post('/bulk/users', async (req: AdminRequest, res, next) => {
  try {
    const { action, userIds } = req.body;

    if (!action || !Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('Action and userIds array are required', 400);
    }

    const updateData: any = {};
    let result;

    switch (action) {
      case 'activate':
        updateData.isActive = true;
        result = await User.updateMany({ _id: { $in: userIds } }, { $set: updateData });
        break;
      case 'deactivate':
        updateData.isActive = false;
        result = await User.updateMany({ _id: { $in: userIds } }, { $set: updateData });
        break;
      case 'delete':
        result = await User.deleteMany({ _id: { $in: userIds } });
        break;
      case 'changePlan':
        if (!req.body.plan) {
          throw new AppError('Plan is required for changePlan action', 400);
        }
        updateData.plan = req.body.plan;
        result = await User.updateMany({ _id: { $in: userIds } }, { $set: updateData });
        break;
      default:
        throw new AppError(`Unknown action: ${action}`, 400);
    }

    const affected = 'modifiedCount' in result ? result.modifiedCount : ('deletedCount' in result ? result.deletedCount : 0);

    await logAudit(req, {
      action: `users.bulk.${action}`,
      entityType: 'user',
      details: { action, userIds, count: userIds.length, affected }
    });

    res.json({
      success: true,
      message: `Bulk action "${action}" completed`,
      data: {
        action,
        affected,
        total: userIds.length
      }
    });
  } catch (error: unknown) {
    await logAudit(req, {
      action: 'users.bulk.action',
      entityType: 'user',
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

/**
 * POST /api/admin/bulk/projects
 * Perform bulk actions on projects
 */
router.post('/bulk/projects', async (req: AdminRequest, res, next) => {
  try {
    const { action, projectIds } = req.body;

    if (!action || !Array.isArray(projectIds) || projectIds.length === 0) {
      throw new AppError('Action and projectIds array are required', 400);
    }

    let result;

    switch (action) {
      case 'delete':
        result = await Project.deleteMany({ _id: { $in: projectIds } });
        break;
      case 'archive':
        result = await Project.updateMany(
          { _id: { $in: projectIds } },
          { $set: { currentPhase: 'Post-Release' } }
        );
        break;
      default:
        throw new AppError(`Unknown action: ${action}`, 400);
    }

    const affected = 'modifiedCount' in result ? result.modifiedCount : ('deletedCount' in result ? result.deletedCount : 0);

    await logAudit(req, {
      action: `projects.bulk.${action}`,
      entityType: 'project',
      details: { action, projectIds, count: projectIds.length, affected }
    });

    res.json({
      success: true,
      message: `Bulk action "${action}" completed`,
      data: {
        action,
        affected,
        total: projectIds.length
      }
    });
  } catch (error: unknown) {
    await logAudit(req, {
      action: 'projects.bulk.action',
      entityType: 'project',
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

// ============ FINANCIAL DASHBOARD ============

/**
 * GET /api/admin/financial/dashboard
 * Get financial dashboard data
 */
router.get('/financial/dashboard', async (_req: AdminRequest, res, next) => {
  try {
    // Get package prices from Package model
    const { Package } = await import('../models/Package.model.js');
    const packages = await Package.find({ isActive: true }).lean();
    const planPrices: Record<string, number> = {};
    
    packages.forEach(pkg => {
      // Convert to monthly price
      let monthlyPrice = pkg.price;
      if (pkg.billingCycle === 'yearly') {
        monthlyPrice = pkg.price / 12;
      } else if (pkg.billingCycle === 'lifetime') {
        monthlyPrice = pkg.price / 120; // Assume 10 year lifetime
      }
      planPrices[pkg.displayName] = monthlyPrice;
    });

    // Calculate revenue by plan
    const revenueByPlan = await User.aggregate([
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 }
        }
      }
    ]);

    let totalMRR = 0;
    const revenue = revenueByPlan.reduce((acc, item) => {
      const price = planPrices[item._id] || 0;
      const mrr = price * item.count;
      totalMRR += mrr;
      acc[item._id] = {
        users: item.count,
        price,
        mrr
      };
      return acc;
    }, {} as Record<string, any>);

    // Users by plan (detailed)
    const usersByPlan = await User.aggregate([
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignups = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          plans: {
            $push: '$plan'
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Growth rate calculation
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const [usersLast30, usersLast60] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } })
    ]);

    const growthRate = usersLast60 > 0 
      ? ((usersLast30 - usersLast60) / usersLast60) * 100 
      : 0;

    // Get LLM costs
    let costs = undefined;
    try {
      const { usageTracker } = await import('../services/llm/UsageTracker.js');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStats = await usageTracker.getUsageStats({
        startDate: todayStart
      });
      
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const currentDay = new Date().getDate();
      const projectedMonthlyLLMCost = currentDay > 0 ? (todayStats.totalCost / currentDay) * daysInMonth : 0;

      costs = {
        todayLLMCost: todayStats.totalCost,
        projectedMonthlyLLMCost,
        projectedYearlyLLMCost: projectedMonthlyLLMCost * 12
      };
    } catch (costError: any) {
      // Costs are optional, continue without them
      logger.error('Failed to calculate LLM costs:', costError);
    }

    res.json({
      success: true,
      data: {
        revenue: {
          totalMRR,
          annualRunRate: totalMRR * 12,
          byPlan: revenue
        },
        ...(costs && { costs }),
        users: {
          byPlan: usersByPlan.reduce((acc, item) => {
            acc[item._id] = {
              total: item.count,
              active: item.active,
              inactive: item.count - item.active
            };
            return acc;
          }, {} as Record<string, any>)
        },
        growth: {
          last30Days: usersLast30,
          previous30Days: usersLast60,
          growthRate: Math.round(growthRate * 100) / 100
        },
        signups: recentSignups.map(item => ({
          date: item._id,
          count: item.count,
          plans: item.plans
        }))
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ============ ANALYTICS ============

/**
 * GET /api/admin/analytics/overview
 * Get analytics overview
 */
router.get('/analytics/overview', async (_req: AdminRequest, res, next) => {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // User growth
    const [totalUsers, usersLast30, usersLast7, newUsersToday] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: last30Days } }),
      User.countDocuments({ createdAt: { $gte: last7Days } }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
      })
    ]);

    // Project growth
    const [totalProjects, projectsLast30, projectsLast7, activeProjects] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ createdAt: { $gte: last30Days } }),
      Project.countDocuments({ createdAt: { $gte: last7Days } }),
      Project.countDocuments({ currentPhase: { $ne: 'Post-Release' } })
    ]);

    // User activity (logins in last 7 days)
    const activeUsers7d = await User.countDocuments({
      lastLogin: { $gte: last7Days }
    });

    // Projects by phase
    const projectsByPhase = await Project.aggregate([
      {
        $group: {
          _id: '$currentPhase',
          count: { $sum: 1 }
        }
      }
    ]);

    // Users by plan
    const usersByPlan = await User.aggregate([
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 }
        }
      }
    ]);

    // Daily signups (last 30 days)
    const dailySignups = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: last30Days }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily project creation (last 30 days)
    const dailyProjects = await Project.aggregate([
      {
        $match: {
          createdAt: { $gte: last30Days }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          last30Days: usersLast30,
          last7Days: usersLast7,
          today: newUsersToday,
          active7d: activeUsers7d
        },
        projects: {
          total: totalProjects,
          active: activeProjects,
          last30Days: projectsLast30,
          last7Days: projectsLast7
        },
        breakdown: {
          projectsByPhase: projectsByPhase.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
          usersByPlan: usersByPlan.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>)
        },
        trends: {
          dailySignups: dailySignups.map(item => ({
            date: item._id,
            count: item.count
          })),
          dailyProjects: dailyProjects.map(item => ({
            date: item._id,
            count: item.count
          }))
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;

