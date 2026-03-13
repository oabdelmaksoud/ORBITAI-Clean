import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, requireSuperAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { checkFeatureAccess } from '../middleware/featureCheck.js';
import { User } from '../models/User.model.js';
import { Project } from '../models/Project.model.js';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/auditLogger.js';
import { e2bService } from '../services/e2b.service.js';
import { apiKeyProvider } from '../services/apiKeyProvider.service.js';
import { getEnvironmentVariables, updateEnvironmentVariables, getEditableVariables } from '../services/envManager.service.js';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

// ============ DASHBOARD & STATS ============

/**
 * GET /api/admin/dashboard
 * Get dashboard statistics
 * Protected by admin_console feature flag
 */
router.get('/dashboard', checkFeatureAccess('admin_console'), async (_req: AdminRequest, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalProjects,
      activeProjects,
      recentUsers,
      recentProjects
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Project.countDocuments(),
      Project.countDocuments({ currentPhase: { $ne: 'Post-Release' } }),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email plan createdAt'),
      Project.find().sort({ createdAt: -1 }).limit(5).select('name userId currentPhase createdAt')
    ]);

    // Calculate stats by plan
    const usersByPlan = await User.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    // Calculate projects by phase
    const projectsByPhase = await Project.aggregate([
      { $group: { _id: '$currentPhase', count: { $sum: 1 } } }
    ]);

    // Calculate projects by methodology
    const projectsByMethodology = await Project.aggregate([
      { $group: { _id: '$methodology', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          totalProjects,
          activeProjects,
          usersByPlan: usersByPlan.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
          projectsByPhase: projectsByPhase.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
          projectsByMethodology: projectsByMethodology.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>)
        },
        recentUsers: recentUsers.map(u => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          plan: u.plan,
          createdAt: u.createdAt
        })),
        recentProjects: recentProjects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          userId: p.userId,
          phase: p.currentPhase,
          createdAt: p.createdAt
        }))
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ============ USER MANAGEMENT ============

/**
 * GET /api/admin/users
 * List all users with pagination and filters
 * Protected by user_management feature flag
 */
router.get('/users', checkFeatureAccess('user_management'), async (req: AdminRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const role = req.query.role as string;
    const plan = req.query.plan as string;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const query: any = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) query.role = role;
    if (plan) query.plan = plan;
    if (isActive !== undefined) query.isActive = isActive;

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users: users.map(u => ({
          id: u._id.toString(),
          ...u,
          _id: undefined
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/users
 * Create a new user
 * Protected by user_management feature flag
 */
router.post('/users', checkFeatureAccess('user_management'), async (req: AdminRequest, res, next) => {
  try {
    const { email, password, name, plan, role } = req.body;

    if (!email || !password || !name) {
      throw new AppError('Email, password, and name are required', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash(password, 10);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      plan: plan || 'Free',
      role: role || 'user',
      isActive: true
    });

    await user.save();

    logger.info(`Admin ${req.admin?.email} created user ${user._id}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/users/:id
 * Get user details
 * Protected by user_management feature flag
 */
router.get('/users/:id', checkFeatureAccess('user_management'), async (req: AdminRequest, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get user's projects
    const projects = await Project.find({ userId: req.params.id })
      .select('name currentPhase methodology createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        projects: projects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          phase: p.currentPhase,
          methodology: p.methodology,
          createdAt: p.createdAt
        }))
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user
 * Protected by user_management feature flag
 */
router.put('/users/:id', checkFeatureAccess('user_management'), async (req: AdminRequest, res, next) => {
  try {
    const { name, email, plan, role, isActive } = req.body;

    // Check if user exists
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (plan !== undefined) updateData.plan = plan;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Handle role update - validate against feature flags
    if (role !== undefined) {
      // Only superadmin can change roles to/from superadmin
      if (role === 'superadmin' || existingUser.role === 'superadmin') {
        if (req.admin?.role !== 'superadmin') {
          throw new AppError('Only superadmin can change superadmin roles', 403);
        }
      }
      
      // Validate that the new role is a valid role
      const validRoles = ['user', 'admin', 'superadmin', 'editor', 'public'];
      if (!validRoles.includes(role)) {
        throw new AppError(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`, 400);
      }
      
      // Check if the admin has permission to assign this role
      // Superadmin can assign any role
      if (req.admin?.role !== 'superadmin') {
        // Regular admins can only assign roles that are enabled in feature flags
        // This ensures role assignments align with feature flag permissions
        const { isFeatureEnabled } = await import('../services/featureFlags.service.js');
        
        // Check if the role being assigned is valid for the feature flags system
        // For now, allow admins to assign any valid role except superadmin
        // (superadmin check is already done above)
        if (role === 'superadmin') {
          throw new AppError('Only superadmin can assign superadmin role', 403);
        }
      }
      
      updateData.role = role;
    }

    // Handle email update with validation
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if email is being changed
      if (normalizedEmail !== existingUser.email) {
        // Check if new email already exists for another user
        const emailExists = await User.findOne({ 
          email: normalizedEmail,
          _id: { $ne: req.params.id } // Exclude current user
        });
        
        if (emailExists) {
          throw new AppError('Email already exists for another user', 400);
        }
        
        updateData.email = normalizedEmail;
      }
    }

    // Update user with $set to ensure proper MongoDB update
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Log audit
    await logAudit(req, {
      action: 'user.update',
      entityType: 'user',
      entityId: user._id.toString(),
      details: {
        updatedFields: Object.keys(updateData),
        oldValues: {
          name: existingUser.name,
          email: existingUser.email,
          plan: existingUser.plan,
          role: existingUser.role,
          isActive: existingUser.isActive
        },
        newValues: {
          name: user.name,
          email: user.email,
          plan: user.plan,
          role: user.role,
          isActive: user.isActive
        }
      }
    });

    logger.info(`Admin ${req.admin?.email} updated user ${req.params.id}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user (only superadmin)
 * Protected by user_management feature flag
 */
router.delete('/users/:id', requireSuperAdmin, checkFeatureAccess('user_management'), async (req: AdminRequest, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Delete all user's projects
    await Project.deleteMany({ userId: req.params.id });
    
    // Delete user
    await User.findByIdAndDelete(req.params.id);

    logger.info(`Superadmin ${req.admin?.email} deleted user ${req.params.id}`);

    res.json({
      success: true,
      message: 'User and all associated projects deleted'
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ============ PROJECT MANAGEMENT ============

/**
 * GET /api/admin/projects
 * List all projects with pagination and filters
 */
router.get('/projects', async (req: AdminRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const phase = req.query.phase as string;
    const methodology = req.query.methodology as string;
    const userId = req.query.userId as string;

    const query: any = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (phase) query.currentPhase = phase;
    if (methodology) query.methodology = methodology;
    if (userId) query.userId = userId;

    const skip = (page - 1) * limit;
    const [projects, total] = await Promise.all([
      Project.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        projects: projects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          description: p.description,
          userId: p.userId,
          currentPhase: p.currentPhase,
          currentSprint: p.currentSprint,
          methodology: p.methodology,
          agentsCount: Array.isArray(p.agents) ? p.agents.length : 0,
          tasksCount: Array.isArray(p.tasks) ? p.tasks.length : 0,
          artifactsCount: Array.isArray(p.artifacts) ? p.artifacts.length : 0,
          useInternet: p.useInternet,
          budget: p.budget,
          createdAt: p.createdAt,
          lastModified: p.lastModified
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/projects/:id
 * Get project details
 */
router.get('/projects/:id', async (req: AdminRequest, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const user = await User.findById(project.userId).select('name email avatar').lean();

    res.json({
      success: true,
      data: {
        project: {
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          currentPhase: project.currentPhase,
          currentSprint: project.currentSprint,
          methodology: project.methodology,
          agents: project.agents || [],
          tasks: project.tasks || [],
          artifacts: project.artifacts || [],
          logs: project.logs || [],
          selectedStandards: project.selectedStandards || [],
          useInternet: project.useInternet,
          budget: project.budget,
          mcpServers: project.mcpServers || [],
          createdAt: project.createdAt,
          lastModified: project.lastModified,
          user: user ? {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            avatar: user.avatar
          } : null
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/admin/projects/:id
 * Update project
 */
router.put('/projects/:id', async (req: AdminRequest, res, next) => {
  try {
    const allowedUpdates = ['name', 'description', 'currentPhase', 'currentSprint', 'methodology', 'useInternet'];
    const updateData: any = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    updateData.lastModified = new Date();

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    logger.info(`Admin ${req.admin?.email} updated project ${req.params.id}`);

    res.json({
      success: true,
      data: {
        project: {
          id: project._id.toString(),
          ...project
        }
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * DELETE /api/admin/projects/:id
 * Delete project
 */
router.delete('/projects/:id', async (req: AdminRequest, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    logger.info(`Admin ${req.admin?.email} deleted project ${req.params.id}`);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/projects/:id/mark-as-sample
 * Mark a project as a sample project (visible to non-logged-in users)
 */
router.post('/projects/:id/mark-as-sample', async (req: AdminRequest, res, next) => {
  try {
    const projectId = req.params.id;
    
    // Check if the ID is a valid MongoDB ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) {
      throw new AppError('Invalid project ID format. Only projects saved to the database can be marked as samples.', 400);
    }
    
    const project = await Project.findById(projectId);

    if (!project) {
      throw new AppError('Project not found. Make sure the project is saved to the database.', 404);
    }

    project.isSample = true;
    await project.save();

    logger.info(`Admin ${req.admin?.email} marked project ${projectId} as sample`);

    res.json({
      success: true,
      message: 'Project marked as sample',
      data: { project }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/projects/:id/unmark-as-sample
 * Unmark a project as a sample project
 */
router.post('/projects/:id/unmark-as-sample', async (req: AdminRequest, res, next) => {
  try {
    const projectId = req.params.id;
    
    // Check if the ID is a valid MongoDB ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) {
      throw new AppError('Invalid project ID format. Only projects saved to the database can be unmarked as samples.', 400);
    }
    
    const project = await Project.findById(projectId);

    if (!project) {
      throw new AppError('Project not found. Make sure the project is saved to the database.', 404);
    }

    project.isSample = false;
    await project.save();

    logger.info(`Admin ${req.admin?.email} unmarked project ${projectId} as sample`);

    res.json({
      success: true,
      message: 'Project unmarked as sample',
      data: { project }
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ============ SYSTEM CONFIGURATION ============

/**
 * GET /api/admin/system/config
 * Get system configuration
 */
router.get('/system/config', async (_req: AdminRequest, res, next) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;
    
    // Import Package model to calculate limits from packages
    const { Package } = await import('../models/Package.model.js');
    const packages = await Package.find({ isActive: true }).lean();
    
    // Calculate limits from active packages
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
      const maxUsersPerPlan: Record<string, number> = {};
      packages.forEach((pkg: any) => {
        const packageName = pkg.displayName || 'Unknown';
        maxUsersPerPlan[packageName] = -1; // -1 means unlimited (customize as needed)
      });

      return {
        maxProjectsPerUser,
        maxUsersPerPlan
      };
    };

    const limits = calculateLimitsFromPackages(packages);
    
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
    
    const config = {
      api: {
        geminiConfigured,
        e2bConfigured,
        openaiConfigured,
        anthropicConfigured,
        deepseekConfigured,
        grokConfigured,
        mongodbConnected: dbConnected,
        weaviateConfigured: !!process.env.WEAVIATE_URL
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
      limits,
      features: {
        multiLLMEnabled: process.env.ENABLE_MULTI_LLM === 'true',
        vectorSearchEnabled: !!process.env.WEAVIATE_URL,
        agentKnowledgeEnabled: true
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/system/stats
 * Get system statistics
 */
router.get('/system/stats', async (_req: AdminRequest, res, next) => {
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
    next(error);
  }
});

/**
 * GET /api/admin/environment
 * Get environment variables (masked for sensitive values)
 * Requires superadmin role
 */
router.get('/environment', requireSuperAdmin, async (req: AdminRequest, res, next) => {
  try {
    const envVars = await getEnvironmentVariables();
    const editableVars = getEditableVariables();
    
    res.json({
      success: true,
      data: {
        variables: envVars,
        editable: editableVars
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * PUT /api/admin/environment
 * Update environment variables
 * Requires superadmin role
 */
router.put('/environment', requireSuperAdmin, async (req: AdminRequest, res, next) => {
  try {
    const { updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      throw new AppError('Invalid request: updates object required', 400);
    }
    
    await updateEnvironmentVariables(updates);
    
    // Log audit event
    await logAudit({
      userId: req.user!.id,
      action: 'update_environment',
      entityType: 'system',
      entityId: 'environment',
      metadata: {
        updatedKeys: Object.keys(updates)
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    logger.info(`Admin ${req.user!.email} updated environment variables: ${Object.keys(updates).join(', ')}`);
    
    res.json({
      success: true,
      message: 'Environment variables updated successfully. Some changes may require server restart.',
      data: {
        updated: Object.keys(updates)
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

// ============ SYSTEM ARTIFACTS ============

/**
 * GET /api/admin/system-artifacts
 * Get all artifacts from all projects (admin only)
 * This provides a centralized view of all system-generated artifacts
 */
router.get('/system-artifacts', async (req: AdminRequest, res, next) => {
  try {
    const { 
      type, 
      phase, 
      projectId,
      limit = 100, 
      offset = 0 
    } = req.query;

    // Build aggregation pipeline to extract artifacts from projects
    const pipeline: any[] = [
      // Unwind the artifacts array
      { $unwind: { path: '$artifacts', preserveNullAndEmptyArrays: false } },
      // Add project info to each artifact
      {
        $project: {
          _id: 0,
          id: '$artifacts.id',
          title: '$artifacts.title',
          type: '$artifacts.type',
          phase: '$artifacts.phase',
          content: '$artifacts.content',
          createdBy: '$artifacts.createdBy',
          timestamp: '$artifacts.timestamp',
          tags: '$artifacts.tags',
          traceRefs: '$artifacts.traceRefs',
          projectId: { $toString: '$_id' },
          projectName: '$name',
          projectPhase: '$currentPhase',
          methodology: '$methodology'
        }
      }
    ];

    // Add filters if provided
    const matchConditions: any = {};
    if (type) {
      matchConditions.type = type;
    }
    if (phase) {
      matchConditions.phase = phase;
    }
    if (projectId) {
      matchConditions.projectId = projectId;
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Sort by timestamp descending (most recent first)
    pipeline.push({ $sort: { timestamp: -1 } });

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Project.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: parseInt(offset as string) });
    pipeline.push({ $limit: parseInt(limit as string) });

    const artifacts = await Project.aggregate(pipeline);

    // Get artifact type statistics
    const typeStats = await Project.aggregate([
      { $unwind: { path: '$artifacts', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$artifacts.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get artifact phase statistics
    const phaseStats = await Project.aggregate([
      { $unwind: { path: '$artifacts', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$artifacts.phase', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get artifacts by agent (createdBy)
    const agentStats = await Project.aggregate([
      { $unwind: { path: '$artifacts', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$artifacts.createdBy', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        artifacts,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        stats: {
          byType: typeStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
          byPhase: phaseStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
          byAgent: agentStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>)
        }
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch system artifacts:', error);
    next(error);
  }
});

export default router;

