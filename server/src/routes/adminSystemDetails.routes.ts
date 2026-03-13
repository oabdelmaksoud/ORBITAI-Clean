/**
 * Comprehensive System Details Route
 * Provides all system information in one endpoint for admin dashboard
 */

import express from 'express';
import { AdminRequest, requireAdmin } from '../middleware/adminAuth.js';
import { authenticateToken } from '../middleware/auth.js';
import { User } from '../models/User.model.js';
import { Project } from '../models/Project.model.js';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { usageTracker } from '../services/llm/UsageTracker.js';
import { e2bService } from '../services/e2b.service.js';
import { apiKeyProvider } from '../services/apiKeyProvider.service.js';

const router = express.Router();

// Require authentication first, then admin check
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/system/details
 * Get comprehensive system details for admin dashboard
 */
router.get('/details', async (req: AdminRequest, res, next) => {
  try {
    // Get all data in parallel
    const [
      // Basic counts
      totalUsers,
      activeUsers,
      totalProjects,
      activeProjects,
      
      // Database stats
      dbStats,
      
      // User breakdowns
      usersByPlan,
      usersByRole,
      
      // Project breakdowns
      projectsByPhase,
      projectsByMethodology,
      
      // Recent activity
      recentUsers,
      recentProjects,
      
      // Package data
      packages,
      
      // LLM usage (today)
      llmUsageToday,
      
      // Health check data
      memoryUsage,
      
    ] = await Promise.all([
      // Basic counts
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Project.countDocuments(),
      Project.countDocuments({ currentPhase: { $ne: 'Post-Release' } }),
      
      // Database stats
      Project.db?.db?.stats().catch(() => null) || Promise.resolve(null),
      
      // User breakdowns
      User.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      
      // Project breakdowns
      Project.aggregate([
        { $group: { _id: '$currentPhase', count: { $sum: 1 } } }
      ]),
      Project.aggregate([
        { $group: { _id: '$methodology', count: { $sum: 1 } } }
      ]),
      
      // Recent activity
      User.find().sort({ createdAt: -1 }).limit(5).select('name email plan createdAt isActive').lean(),
      Project.find().sort({ createdAt: -1 }).limit(5).select('name userId currentPhase createdAt').lean(),
      
      // Packages
      import('../models/Package.model.js').then(m => m.Package.find({ isActive: true }).lean()),
      
      // LLM usage today
      usageTracker.getUsageStats({
        startDate: new Date(new Date().setHours(0, 0, 0, 0)),
        endDate: new Date()
      }).catch(() => ({
        totalCalls: 0,
        totalTokens: 0,
        totalCost: 0,
        byProvider: {}
      })),
      
      // Memory usage
      Promise.resolve(process.memoryUsage()),
    ]);

    // Calculate task and artifact counts
    const [totalTasks, totalArtifacts] = await Promise.all([
      Project.aggregate([
        { $unwind: '$tasks' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      Project.aggregate([
        { $unwind: '$artifacts' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Calculate active users in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers7d = await User.countDocuments({
      lastLogin: { $gte: sevenDaysAgo }
    });

    // Calculate recent signups
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const usersLast30Days = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const projectsLast30Days = await Project.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Database connection status
    const dbConnected = mongoose.connection.readyState === 1;
    
    // Check API configurations (checks both database and environment variables)
    const [
      geminiConfigured,
      e2bConfigured,
      openaiConfigured,
      anthropicConfigured,
      deepseekConfigured,
      grokConfigured
    ] = await Promise.all([
      apiKeyProvider.hasApiKey('gemini'),
      e2bService.isConfigured(),
      apiKeyProvider.hasApiKey('openai'),
      apiKeyProvider.hasApiKey('anthropic'),
      apiKeyProvider.hasApiKey('deepseek'),
      apiKeyProvider.hasApiKey('grok')
    ]);
    
    // System information
    const systemInfo = {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3001', 10),
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      }
    };

    // API configuration
    const apiConfig = {
      geminiConfigured,
      e2bConfigured,
      openaiConfigured,
      anthropicConfigured,
      deepseekConfigured,
      grokConfigured,
      mongodbConnected: dbConnected,
      weaviateConfigured: !!config.weaviateUrl
    };

    // Feature flags
    const features = {
      multiLLMEnabled: config.enableMultiLLM,
      vectorSearchEnabled: !!config.weaviateUrl,
      agentKnowledgeEnabled: true
    };

    // System limits - calculated from active packages
    const calculateLimitsFromPackages = (packages: any[]) => {
      if (!packages || packages.length === 0) {
        // Fallback to defaults if no packages
        return {
          maxProjectsPerUser: parseInt(process.env.MAX_PROJECTS_PER_USER || '10'),
          maxUsersPerPlan: {}
        };
      }

      // Find the maximum maxProjects across all packages
      // Handle -1 (unlimited) specially - if any package is unlimited, show "Unlimited"
      const projectLimits = packages.map((pkg: any) => pkg.limits?.maxProjects ?? 0);
      const hasUnlimited = projectLimits.some((limit: number) => limit === -1);
      
      let maxProjectsPerUser: number | string;
      if (hasUnlimited) {
        maxProjectsPerUser = -1; // Will display as "Unlimited"
      } else {
        const maxLimit = Math.max(...projectLimits, parseInt(process.env.MAX_PROJECTS_PER_USER || '10'));
        maxProjectsPerUser = maxLimit > 0 ? maxLimit : parseInt(process.env.MAX_PROJECTS_PER_USER || '10');
      }

      // Build maxUsersPerPlan from package display names
      // This shows what limits each package allows
      const maxUsersPerPlan: Record<string, number> = {};
      packages.forEach((pkg: any) => {
        const packageName = pkg.displayName || 'Unknown';
        // For now, we'll show unlimited (-1) or a high default
        // You can customize this logic based on your business rules
        maxUsersPerPlan[packageName] = -1; // -1 means unlimited
      });

      return {
        maxProjectsPerUser,
        maxUsersPerPlan,
        // Additional aggregated limits from packages
        packageLimits: packages.map((pkg: any) => ({
          packageName: pkg.displayName,
          maxProjects: pkg.limits?.maxProjects || 0,
          maxAgents: pkg.limits?.maxAgents || 0,
          maxTasks: pkg.limits?.maxTasks || 0,
          maxStorageGB: pkg.limits?.maxStorageGB || 0,
          maxAPICalls: pkg.limits?.maxAPICalls || 0,
          maxTeamMembers: pkg.limits?.maxTeamMembers || 0,
          maxMonthlyBudget: pkg.limits?.maxMonthlyBudget || 0
        }))
      };
    };

    const limits = calculateLimitsFromPackages(packages || []);

    res.json({
      success: true,
      data: {
        // Summary counts
        summary: {
          totalUsers,
          activeUsers,
          activeUsers7d,
          totalProjects,
          activeProjects,
          totalTasks,
          totalArtifacts,
          usersLast30Days,
          projectsLast30Days
        },
        
        // Breakdowns
        breakdowns: {
          usersByPlan: usersByPlan.reduce((acc: any, item: any) => {
            acc[item._id || 'None'] = item.count;
            return acc;
          }, {}),
          usersByRole: usersByRole.reduce((acc: any, item: any) => {
            acc[item._id || 'user'] = item.count;
            return acc;
          }, {}),
          projectsByPhase: projectsByPhase.reduce((acc: any, item: any) => {
            acc[item._id || 'None'] = item.count;
            return acc;
          }, {}),
          projectsByMethodology: projectsByMethodology.reduce((acc: any, item: any) => {
            acc[item._id || 'None'] = item.count;
            return acc;
          }, {})
        },
        
        // Database
        database: dbStats ? {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexSize: dbStats.indexSize,
          objects: dbStats.objects
        } : null,
        
        // Recent activity
        recentActivity: {
          users: recentUsers.map((u: any) => ({
            id: u._id.toString(),
            name: u.name,
            email: u.email,
            plan: u.plan,
            isActive: u.isActive,
            createdAt: u.createdAt
          })),
          projects: recentProjects.map((p: any) => ({
            id: p._id.toString(),
            name: p.name,
            userId: p.userId?.toString(),
            phase: p.currentPhase,
            createdAt: p.createdAt
          }))
        },
        
        // Packages
        packages: packages.map((pkg: any) => ({
          id: pkg._id.toString(),
          displayName: pkg.displayName,
          price: pkg.price,
          billingCycle: pkg.billingCycle,
          features: pkg.features,
          isActive: pkg.isActive
        })),
        
        // LLM Usage (today)
        llmUsage: {
          today: {
            calls: llmUsageToday.totalCalls || 0,
            tokens: llmUsageToday.totalTokens || 0,
            cost: llmUsageToday.totalCost || 0,
            byProvider: llmUsageToday.byProvider || {}
          }
        },
        
        // System info
        system: systemInfo,
        
        // API config
        api: apiConfig,
        
        // Features
        features,
        
        // Limits
        limits,
        
        // Timestamp
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get comprehensive system details:', error);
    next(error);
  }
});

/**
 * GET /api/admin/system/config
 * Get system configuration (legacy endpoint)
 */
router.get('/config', async (req: AdminRequest, res, next) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;
    
    // Check API configurations (checks both database and environment variables)
    const [
      geminiConfigured,
      e2bConfigured,
      openaiConfigured,
      anthropicConfigured,
      deepseekConfigured,
      grokConfigured
    ] = await Promise.all([
      apiKeyProvider.hasApiKey('gemini'),
      e2bService.isConfigured(),
      apiKeyProvider.hasApiKey('openai'),
      apiKeyProvider.hasApiKey('anthropic'),
      apiKeyProvider.hasApiKey('deepseek'),
      apiKeyProvider.hasApiKey('grok')
    ]);
    
    const systemConfig = {
      api: {
        geminiConfigured,
        e2bConfigured,
        openaiConfigured,
        anthropicConfigured,
        deepseekConfigured,
        grokConfigured,
        mongodbConnected: dbConnected,
        weaviateConfigured: !!config.weaviateUrl
      },
      server: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3001', 10),
        uptime: process.uptime(),
        memoryUsage: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          rss: process.memoryUsage().rss
        }
      },
      limits: {
        maxProjectsPerUser: parseInt(process.env.MAX_PROJECTS_PER_USER || '10'),
        maxUsersPerPlan: {
          Free: 1000,
          Pro: 100,
          Enterprise: 50
        }
      },
      features: {
        multiLLMEnabled: config.enableMultiLLM,
        vectorSearchEnabled: !!config.weaviateUrl,
        agentKnowledgeEnabled: true
      }
    };

    res.json({
      success: true,
      data: systemConfig
    });
  } catch (error: unknown) {
    logger.error('Failed to get system config:', error);
    next(error);
  }
});

/**
 * GET /api/admin/system/stats
 * Get system statistics (legacy endpoint)
 */
router.get('/stats', async (req: AdminRequest, res, next) => {
  try {
    const [totalUsers, totalProjects, totalTasks, totalArtifacts] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Project.aggregate([
        { $unwind: '$tasks' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      Project.aggregate([
        { $unwind: '$artifacts' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Database size info
    const dbStats = Project.db?.db ? await Project.db.db.stats() : null;

    res.json({
      success: true,
      data: {
        counts: {
          totalUsers,
          totalProjects,
          totalTasks,
          totalArtifacts
        },
        database: dbStats ? {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize
        } : null
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get system stats:', error);
    next(error);
  }
});

export default router;

