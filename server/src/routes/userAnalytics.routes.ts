import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { User } from '../models/User.model.js';
import { Project } from '../models/Project.model.js';
import { ActivityEvent } from '../models/ActivityEvent.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/analytics/users/churn-prediction
 * Predict user churn based on activity patterns
 */
router.get('/churn-prediction', async (_req: AdminRequest, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all users
    const users = await User.find({}).lean();

    // Get activity data for each user
    const userActivity = await ActivityEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: ninetyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$userId',
          lastActivity: { $max: '$timestamp' },
          activityCount: { $sum: 1 },
          activityLast30Days: {
            $sum: {
              $cond: [{ $gte: ['$timestamp', thirtyDaysAgo] }, 1, 0]
            }
          },
          activityLast60Days: {
            $sum: {
              $cond: [{ $gte: ['$timestamp', sixtyDaysAgo] }, 1, 0]
            }
          }
        }
      }
    ]);

    const activityMap = new Map(
      userActivity.map(item => [item._id, item])
    );

    // Calculate churn risk for each user
    const churnPredictions = users.map(user => {
      const activity = activityMap.get(user.id) || {
        lastActivity: user.lastLogin || user.createdAt,
        activityCount: 0,
        activityLast30Days: 0,
        activityLast60Days: 0
      };

      const daysSinceLastActivity = Math.floor(
        (now.getTime() - new Date(activity.lastActivity).getTime()) / (24 * 60 * 60 * 1000)
      );
      const daysSinceSignup = Math.floor(
        (now.getTime() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      );

      // Churn risk scoring algorithm
      let riskScore = 0;
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

      // Factor 1: Days since last activity
      if (daysSinceLastActivity > 90) riskScore += 40;
      else if (daysSinceLastActivity > 60) riskScore += 30;
      else if (daysSinceLastActivity > 30) riskScore += 20;
      else if (daysSinceLastActivity > 14) riskScore += 10;

      // Factor 2: Activity decline
      if (activity.activityLast30Days === 0 && activity.activityLast60Days > 0) riskScore += 30;
      else if (activity.activityLast30Days < activity.activityLast60Days / 2) riskScore += 20;

      // Factor 3: No login in 30 days
      if (!user.lastLogin || daysSinceLastActivity > 30) riskScore += 20;

      // Factor 4: Account age vs activity
      if (daysSinceSignup > 30 && activity.activityCount < 5) riskScore += 10;

      // Factor 5: Plan downgrade risk (Free users more likely to churn)
      if (user.plan === 'Free' && daysSinceLastActivity > 14) riskScore += 10;

      // Determine risk level
      if (riskScore >= 70) riskLevel = 'critical';
      else if (riskScore >= 50) riskLevel = 'high';
      else if (riskScore >= 30) riskLevel = 'medium';
      else riskLevel = 'low';

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        riskScore,
        riskLevel,
        daysSinceLastActivity,
        daysSinceSignup,
        activityCount: activity.activityCount,
        activityLast30Days: activity.activityLast30Days,
        lastActivity: activity.lastActivity,
        predictedChurnDate: riskScore >= 50 
          ? new Date(now.getTime() + (30 - riskScore) * 24 * 60 * 60 * 1000)
          : null
      };
    });

    // Sort by risk score
    churnPredictions.sort((a, b) => b.riskScore - a.riskScore);

    // Summary statistics
    const summary = {
      total: churnPredictions.length,
      critical: churnPredictions.filter(p => p.riskLevel === 'critical').length,
      high: churnPredictions.filter(p => p.riskLevel === 'high').length,
      medium: churnPredictions.filter(p => p.riskLevel === 'medium').length,
      low: churnPredictions.filter(p => p.riskLevel === 'low').length,
      averageRiskScore: churnPredictions.reduce((sum, p) => sum + p.riskScore, 0) / churnPredictions.length
    };

    res.json({
      success: true,
      data: {
        predictions: churnPredictions,
        summary
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/users/segmentation
 * Segment users by behavior and characteristics
 */
router.get('/segmentation', async (_req: AdminRequest, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get user data with activity
    const users = await User.find({}).lean();
    const projects = await Project.find({}).lean();
    const activityEvents = await ActivityEvent.find({
      timestamp: { $gte: ninetyDaysAgo }
    }).lean();

    // Group projects by user
    const projectsByUser = new Map<string, number>();
    projects.forEach(project => {
      if (project.userId) {
        projectsByUser.set(project.userId.toString(), (projectsByUser.get(project.userId.toString()) || 0) + 1);
      }
    });

    // Group activity by user
    const activityByUser = new Map<string, number>();
    activityEvents.forEach(event => {
      if (event.userId) {
        activityByUser.set(event.userId, (activityByUser.get(event.userId) || 0) + 1);
      }
    });

    // Segment users
    const segments = {
      powerUsers: [] as any[],
      activeUsers: [] as any[],
      casualUsers: [] as any[],
      atRiskUsers: [] as any[],
      newUsers: [] as any[],
      inactiveUsers: [] as any[]
    };

    users.forEach(user => {
      const projectCount = projectsByUser.get(user.id) || 0;
      const activityCount = activityByUser.get(user.id) || 0;
      const daysSinceSignup = Math.floor(
        (now.getTime() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      );
      const daysSinceLastActivity = user.lastLogin
        ? Math.floor((now.getTime() - new Date(user.lastLogin).getTime()) / (24 * 60 * 60 * 1000))
        : daysSinceSignup;

      const userData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        projectCount,
        activityCount,
        daysSinceSignup,
        daysSinceLastActivity,
        lastLogin: user.lastLogin
      };

      // Segmentation logic
      if (daysSinceSignup < 7) {
        segments.newUsers.push(userData);
      } else if (daysSinceLastActivity > 30) {
        segments.inactiveUsers.push(userData);
      } else if (daysSinceLastActivity > 14 || activityCount < 5) {
        segments.atRiskUsers.push(userData);
      } else if (projectCount >= 5 && activityCount >= 20) {
        segments.powerUsers.push(userData);
      } else if (activityCount >= 10 || projectCount >= 2) {
        segments.activeUsers.push(userData);
      } else {
        segments.casualUsers.push(userData);
      }
    });

    // Calculate segment statistics
    const segmentStats = {
      powerUsers: {
        count: segments.powerUsers.length,
        percentage: (segments.powerUsers.length / users.length) * 100,
        avgProjects: segments.powerUsers.reduce((sum, u) => sum + u.projectCount, 0) / segments.powerUsers.length || 0,
        avgActivity: segments.powerUsers.reduce((sum, u) => sum + u.activityCount, 0) / segments.powerUsers.length || 0
      },
      activeUsers: {
        count: segments.activeUsers.length,
        percentage: (segments.activeUsers.length / users.length) * 100,
        avgProjects: segments.activeUsers.reduce((sum, u) => sum + u.projectCount, 0) / segments.activeUsers.length || 0,
        avgActivity: segments.activeUsers.reduce((sum, u) => sum + u.activityCount, 0) / segments.activeUsers.length || 0
      },
      casualUsers: {
        count: segments.casualUsers.length,
        percentage: (segments.casualUsers.length / users.length) * 100,
        avgProjects: segments.casualUsers.reduce((sum, u) => sum + u.projectCount, 0) / segments.casualUsers.length || 0,
        avgActivity: segments.casualUsers.reduce((sum, u) => sum + u.activityCount, 0) / segments.casualUsers.length || 0
      },
      atRiskUsers: {
        count: segments.atRiskUsers.length,
        percentage: (segments.atRiskUsers.length / users.length) * 100
      },
      newUsers: {
        count: segments.newUsers.length,
        percentage: (segments.newUsers.length / users.length) * 100
      },
      inactiveUsers: {
        count: segments.inactiveUsers.length,
        percentage: (segments.inactiveUsers.length / users.length) * 100
      }
    };

    res.json({
      success: true,
      data: {
        segments,
        segmentStats,
        totalUsers: users.length
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/users/lifecycle
 * Analyze user lifecycle stages
 */
router.get('/lifecycle', async (_req: AdminRequest, res, next) => {
  try {
    const now = new Date();
    const users = await User.find({}).lean();
    const projects = await Project.find({}).lean();
    const activityEvents = await ActivityEvent.find({}).lean();

    // Group data by user
    const projectsByUser = new Map<string, any[]>();
    projects.forEach(project => {
      if (project.userId) {
        const userId = project.userId.toString();
        if (!projectsByUser.has(userId)) {
          projectsByUser.set(userId, []);
        }
        projectsByUser.get(userId)!.push(project);
      }
    });

    const activityByUser = new Map<string, any[]>();
    activityEvents.forEach(event => {
      if (event.userId) {
        if (!activityByUser.has(event.userId)) {
          activityByUser.set(event.userId, []);
        }
        activityByUser.get(event.userId)!.push(event);
      }
    });

    // Analyze lifecycle stages
    const lifecycleStages = {
      onboarding: [] as any[], // 0-7 days, < 3 activities
      activation: [] as any[], // 7-30 days, 3-10 activities
      engagement: [] as any[], // 30-90 days, > 10 activities
      retention: [] as any[], // 90+ days, regular activity
      dormant: [] as any[], // No activity in 30+ days
      churned: [] as any[] // No activity in 90+ days
    };

    users.forEach(user => {
      const userProjects = projectsByUser.get(user.id) || [];
      const userActivities = activityByUser.get(user.id) || [];
      const daysSinceSignup = Math.floor(
        (now.getTime() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      );
      const lastActivity = user.lastLogin || user.createdAt;
      const daysSinceLastActivity = Math.floor(
        (now.getTime() - new Date(lastActivity).getTime()) / (24 * 60 * 60 * 1000)
      );

      const userLifecycle = {
        userId: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        daysSinceSignup,
        daysSinceLastActivity,
        projectCount: userProjects.length,
        activityCount: userActivities.length,
        stage: '' as string
      };

      if (daysSinceLastActivity > 90) {
        userLifecycle.stage = 'churned';
        lifecycleStages.churned.push(userLifecycle);
      } else if (daysSinceLastActivity > 30) {
        userLifecycle.stage = 'dormant';
        lifecycleStages.dormant.push(userLifecycle);
      } else if (daysSinceSignup < 7 && userActivities.length < 3) {
        userLifecycle.stage = 'onboarding';
        lifecycleStages.onboarding.push(userLifecycle);
      } else if (daysSinceSignup < 30 && userActivities.length >= 3 && userActivities.length < 10) {
        userLifecycle.stage = 'activation';
        lifecycleStages.activation.push(userLifecycle);
      } else if (daysSinceSignup < 90 && userActivities.length >= 10) {
        userLifecycle.stage = 'engagement';
        lifecycleStages.engagement.push(userLifecycle);
      } else if (daysSinceSignup >= 90 && userActivities.length >= 10) {
        userLifecycle.stage = 'retention';
        lifecycleStages.retention.push(userLifecycle);
      } else {
        userLifecycle.stage = 'activation';
        lifecycleStages.activation.push(userLifecycle);
      }
    });

    // Calculate stage statistics
    const stageStats = Object.keys(lifecycleStages).map(stage => ({
      stage,
      count: lifecycleStages[stage as keyof typeof lifecycleStages].length,
      percentage: (lifecycleStages[stage as keyof typeof lifecycleStages].length / users.length) * 100
    }));

    res.json({
      success: true,
      data: {
        lifecycleStages,
        stageStats,
        totalUsers: users.length
      }
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
















