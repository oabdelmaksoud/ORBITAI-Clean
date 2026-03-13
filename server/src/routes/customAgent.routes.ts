import express from 'express';
import { CustomAgent } from '../models/CustomAgent.model.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logger } from '../utils/logger.js';
import { isFeatureEnabled } from '../services/featureFlags.service.js';
import mongoose from 'mongoose';

const router = express.Router();

// Middleware to check feature flag
async function checkAgentCustomization(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  try {
    const userRole = req.user?.role || 'public';
    const enabled = await isFeatureEnabled('agent_customization', userRole);
    if (!enabled) {
      throw new AppError('Agent customization is not enabled for your role', 403);
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function checkAgentDeletion(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  try {
    const userRole = req.user?.role || 'public';
    const enabled = await isFeatureEnabled('agent_deletion', userRole);
    if (!enabled) {
      throw new AppError('Agent deletion is not enabled for your role', 403);
    }
    next();
  } catch (error) {
    next(error);
  }
}

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/custom-agents
 * Get all custom agents for the current user
 */
router.get('/', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const { projectId, includePublic } = req.query;

    const query: any = {
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) }
      ],
      isActive: true
    };

    // Include public agents if requested
    if (includePublic === 'true') {
      query.$or.push({ isPublic: true });
    }

    // Filter by project if specified
    if (projectId) {
      query.$or = query.$or.map((condition: any) => ({
        ...condition,
        $or: [
          { projectId: new mongoose.Types.ObjectId(projectId as string) },
          { projectId: { $exists: false } },
          { projectId: null }
        ]
      }));
    }

    const agents = await CustomAgent.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        agents: agents.map(agent => ({
          id: agent._id.toString(),
          ...agent,
          _id: undefined
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/custom-agents/public
 * Get all public custom agents (marketplace)
 */
router.get('/public', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const { search, tags, sort = 'popular' } = req.query;

    const query: any = {
      isPublic: true,
      isActive: true
    };

    if (tags) {
      const tagList = (tags as string).split(',').map(t => t.trim());
      query.tags = { $in: tagList };
    }

    let sortOption: any = { usageCount: -1 }; // Default: most popular
    if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'rating') {
      sortOption = { rating: -1 };
    }

    let agents;
    if (search) {
      agents = await CustomAgent.find({
        ...query,
        $text: { $search: search as string }
      })
        .sort(sortOption)
        .limit(50)
        .lean();
    } else {
      agents = await CustomAgent.find(query)
        .sort(sortOption)
        .limit(50)
        .lean();
    }

    res.json({
      success: true,
      data: {
        agents: agents.map(agent => ({
          id: agent._id.toString(),
          name: agent.name,
          role: agent.role,
          avatar: agent.avatar,
          description: agent.description,
          goal: agent.goal,
          capabilities: agent.capabilities,
          usageCount: agent.usageCount,
          rating: agent.rating,
          ratingCount: agent.ratingCount,
          tags: agent.tags
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/custom-agents/all-projects
 * Get all agents across all projects (admin view)
 * Shows agents created by the system in different projects
 */
router.get('/all-projects', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const userRole = req.user?.role;

    // Only admin/superadmin can see all project agents
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      throw new AppError('You do not have permission to view all project agents', 403);
    }

    // Get all agents that have a projectId (project-specific agents)
    // First, get agents and filter out those with invalid ObjectIds
    const allAgents = await CustomAgent.find({
      projectId: { $exists: true, $ne: null },
      isActive: true
    }).lean();

    // Log for debugging
    logger.info(`[Project Agents] Found ${allAgents.length} agents with projectId`);

    // Filter to only agents with valid ObjectIds
    const agentsWithValidIds = allAgents.filter(agent => {
      try {
        if (!agent.projectId) return false;
        const projectIdStr = String(agent.projectId);
        if (!mongoose.Types.ObjectId.isValid(projectIdStr)) {
          logger.warn(`[Project Agents] Invalid projectId format: ${projectIdStr}`);
          return false;
        }
        if (agent.userId && !mongoose.Types.ObjectId.isValid(String(agent.userId))) {
          logger.warn(`[Project Agents] Invalid userId format: ${agent.userId}`);
          return false;
        }
        return true;
      } catch (error) {
        logger.warn(`[Project Agents] Error validating agent: ${error}`);
        return false;
      }
    });

    logger.info(`[Project Agents] ${agentsWithValidIds.length} agents with valid ObjectIds`);

    // Convert to ObjectIds for aggregation
    const validProjectIds = agentsWithValidIds
      .map(a => a.projectId)
      .filter(id => mongoose.Types.ObjectId.isValid(String(id)))
      .map(id => new mongoose.Types.ObjectId(String(id)));

    if (validProjectIds.length === 0) {
      // No valid agents, return empty result with helpful message
      logger.info('[Project Agents] No agents with valid projectId found');
      return res.json({
        success: true,
        data: {
          totalAgents: 0,
          totalProjects: 0,
          projectAgents: [],
          allAgents: [],
          message: 'No project-specific agents found. Create custom agents and assign them to a project to see them here.'
        }
      });
    }

    // Now run aggregation with only valid ObjectIds
    const projectAgents = await CustomAgent.aggregate([
      {
        $match: {
          projectId: { $in: validProjectIds },
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      {
        $unwind: {
          path: '$project',
          preserveNullAndEmptyArrays: true // Keep agents even if project lookup fails
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'creator'
        }
      },
      {
        $unwind: {
          path: '$creator',
          preserveNullAndEmptyArrays: true // Keep agents even if user lookup fails
        }
      },
      {
        $project: {
          id: { $toString: '$_id' },
          name: 1,
          role: 1,
          mode: 1,
          avatar: 1,
          description: 1,
          goal: 1,
          backstory: 1,
          capabilities: 1,
          isPublic: 1,
          usageCount: 1,
          rating: 1,
          ratingCount: 1,
          tags: 1,
          createdAt: 1,
          updatedAt: 1,
          projectId: { $toString: '$projectId' },
          projectName: '$project.name',
          projectDescription: '$project.description',
          creatorId: { $toString: '$userId' },
          creatorName: '$creator.name',
          creatorEmail: '$creator.email'
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    // Group agents by project
    const agentsByProject: Record<string, any> = {};
    
    for (const agent of projectAgents) {
      const projectId = agent.projectId || 'no-project';
      if (!agentsByProject[projectId]) {
        agentsByProject[projectId] = {
          projectId,
          projectName: agent.projectName || 'Unknown Project',
          projectDescription: agent.projectDescription || '',
          agents: []
        };
      }
      agentsByProject[projectId].agents.push(agent);
    }

    res.json({
      success: true,
      data: {
        totalAgents: projectAgents.length,
        totalProjects: Object.keys(agentsByProject).length,
        projectAgents: Object.values(agentsByProject),
        allAgents: projectAgents
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/custom-agents/:id
 * Get a specific custom agent
 */
router.get('/:id', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const agentId = req.params.id;

    // Validate that agentId is a valid ObjectId before using it
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      throw new AppError('Invalid agent ID format', 400);
    }

    const agent = await CustomAgent.findOne({
      _id: new mongoose.Types.ObjectId(agentId),
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { isPublic: true }
      ]
    }).lean();

    if (!agent) {
      throw new AppError('Custom agent not found', 404);
    }

    res.json({
      success: true,
      data: {
        agent: {
          id: agent._id.toString(),
          ...agent,
          _id: undefined
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/custom-agents
 * Create a new custom agent
 */
router.post('/', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const {
      name,
      role,
      mode,
      avatar,
      description,
      goal,
      backstory,
      systemPrompt,
      capabilities,
      preferredLLM,
      temperature,
      maxTokens,
      tools,
      isPublic,
      tags,
      projectId,
      metadata
    } = req.body;

    // Validate required fields
    if (!name || !role || !description || !goal || !backstory) {
      throw new AppError('Name, role, description, goal, and backstory are required', 400);
    }

    // Check if user already has an agent with this name
    const existing = await CustomAgent.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      name: name.trim(),
      isActive: true
    });

    if (existing) {
      throw new AppError('You already have an agent with this name', 400);
    }

    const newAgent = new CustomAgent({
      userId: new mongoose.Types.ObjectId(userId),
      projectId: projectId ? new mongoose.Types.ObjectId(projectId) : undefined,
      name: name.trim(),
      role: role.trim(),
      mode: mode || 'Reasoning',
      avatar: avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${name}&backgroundColor=transparent`,
      description: description.trim(),
      goal: goal.trim(),
      backstory: backstory.trim(),
      systemPrompt: systemPrompt?.trim(),
      capabilities: capabilities || [],
      preferredLLM,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
      tools: tools || [],
      isPublic: isPublic || false,
      tags: tags || [],
      metadata: metadata || {}
    });

    await newAgent.save();

    await logAudit(req, {
      action: 'custom_agent.created',
      entityType: 'custom_agent',
      entityId: newAgent._id.toString(),
      details: { name: newAgent.name, role: newAgent.role }
    });

    logger.info(`User ${req.user?.email} created custom agent: ${newAgent.name}`);

    res.status(201).json({
      success: true,
      data: {
        agent: {
          id: newAgent._id.toString(),
          ...newAgent.toObject(),
          _id: undefined
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/custom-agents/:id
 * Update a custom agent
 */
router.put('/:id', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const agentId = req.params.id;

    const agent = await CustomAgent.findOne({
      _id: new mongoose.Types.ObjectId(agentId),
      userId: new mongoose.Types.ObjectId(userId)
    });

    if (!agent) {
      throw new AppError('Custom agent not found or you do not have permission to edit it', 404);
    }

    const allowedUpdates = [
      'name', 'role', 'mode', 'avatar', 'description', 'goal', 'backstory',
      'systemPrompt', 'capabilities', 'preferredLLM', 'temperature', 'maxTokens',
      'tools', 'isPublic', 'isActive', 'tags', 'metadata'
    ];

    const updates: any = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // If name is being changed, check for duplicates
    if (updates.name && updates.name !== agent.name) {
      const existing = await CustomAgent.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        name: updates.name.trim(),
        isActive: true,
        _id: { $ne: agent._id }
      });

      if (existing) {
        throw new AppError('You already have an agent with this name', 400);
      }
    }

    Object.assign(agent, updates);
    await agent.save();

    await logAudit(req, {
      action: 'custom_agent.updated',
      entityType: 'custom_agent',
      entityId: agent._id.toString(),
      details: { updates: Object.keys(updates) }
    });

    logger.info(`User ${req.user?.email} updated custom agent: ${agent.name}`);

    res.json({
      success: true,
      data: {
        agent: {
          id: agent._id.toString(),
          ...agent.toObject(),
          _id: undefined
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/custom-agents/:id
 * Delete a custom agent (soft delete)
 */
router.delete('/:id', checkAgentDeletion, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const agentId = req.params.id;

    const query: any = {
      _id: new mongoose.Types.ObjectId(agentId)
    };

    // Only allow users to delete their own agents, unless admin/superadmin
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      query.userId = new mongoose.Types.ObjectId(userId);
    }

    const agent = await CustomAgent.findOne(query);

    if (!agent) {
      throw new AppError('Custom agent not found or you do not have permission to delete it', 404);
    }

    // Soft delete
    agent.isActive = false;
    await agent.save();

    await logAudit(req, {
      action: 'custom_agent.deleted',
      entityType: 'custom_agent',
      entityId: agent._id.toString(),
      details: { name: agent.name }
    });

    logger.info(`User ${req.user?.email} deleted custom agent: ${agent.name}`);

    res.json({
      success: true,
      message: 'Custom agent deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/custom-agents/:id/clone
 * Clone a public agent to your own collection
 */
router.post('/:id/clone', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const agentId = req.params.id;

    const sourceAgent = await CustomAgent.findOne({
      _id: new mongoose.Types.ObjectId(agentId),
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { isPublic: true }
      ]
    });

    if (!sourceAgent) {
      throw new AppError('Agent not found or is not available for cloning', 404);
    }

    // Create a clone with a new name
    const cloneName = `${sourceAgent.name} (Copy)`;
    
    const clonedAgent = new CustomAgent({
      userId: new mongoose.Types.ObjectId(userId),
      name: cloneName,
      role: sourceAgent.role,
      mode: sourceAgent.mode,
      avatar: sourceAgent.avatar,
      description: sourceAgent.description,
      goal: sourceAgent.goal,
      backstory: sourceAgent.backstory,
      systemPrompt: sourceAgent.systemPrompt,
      capabilities: sourceAgent.capabilities,
      preferredLLM: sourceAgent.preferredLLM,
      temperature: sourceAgent.temperature,
      maxTokens: sourceAgent.maxTokens,
      tools: sourceAgent.tools,
      isPublic: false, // Clones start as private
      tags: sourceAgent.tags,
      metadata: {
        ...sourceAgent.metadata,
        clonedFrom: sourceAgent._id.toString()
      }
    });

    await clonedAgent.save();

    // Increment usage count of source agent
    await CustomAgent.updateOne(
      { _id: sourceAgent._id },
      { $inc: { usageCount: 1 } }
    );

    await logAudit(req, {
      action: 'custom_agent.cloned',
      entityType: 'custom_agent',
      entityId: clonedAgent._id.toString(),
      details: { 
        sourceName: sourceAgent.name,
        sourceId: sourceAgent._id.toString()
      }
    });

    logger.info(`User ${req.user?.email} cloned agent: ${sourceAgent.name}`);

    res.status(201).json({
      success: true,
      data: {
        agent: {
          id: clonedAgent._id.toString(),
          ...clonedAgent.toObject(),
          _id: undefined
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/custom-agents/:id/rate
 * Rate a public agent
 */
router.post('/:id/rate', checkAgentCustomization, async (req: AuthRequest, res, next) => {
  try {
    const agentId = req.params.id;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    const agent = await CustomAgent.findOne({
      _id: new mongoose.Types.ObjectId(agentId),
      isPublic: true,
      isActive: true
    });

    if (!agent) {
      throw new AppError('Public agent not found', 404);
    }

    // Calculate new average rating
    const currentTotal = (agent.rating || 0) * (agent.ratingCount || 0);
    const newCount = (agent.ratingCount || 0) + 1;
    const newRating = (currentTotal + rating) / newCount;

    agent.rating = Math.round(newRating * 10) / 10; // Round to 1 decimal
    agent.ratingCount = newCount;
    await agent.save();

    res.json({
      success: true,
      data: {
        rating: agent.rating,
        ratingCount: agent.ratingCount
      }
    });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/custom-agents/templates
 * Get predefined agent templates
 */
router.get('/templates/list', checkAgentCustomization, async (_req: AuthRequest, res, next) => {
  try {
    const templates = [
      {
        id: 'code-reviewer',
        name: 'Code Reviewer',
        role: 'Senior Code Reviewer',
        description: 'Expert code reviewer focused on best practices, security, and performance.',
        goal: 'Review code for quality, security vulnerabilities, and performance issues.',
        backstory: 'A seasoned developer with 15+ years of experience in code review and security auditing.',
        capabilities: ['code_review', 'security_analysis', 'performance_optimization'],
        tags: ['code', 'review', 'security']
      },
      {
        id: 'documentation-writer',
        name: 'Doc Writer',
        role: 'Technical Documentation Specialist',
        description: 'Creates comprehensive and clear technical documentation.',
        goal: 'Write clear, concise, and comprehensive documentation for code and APIs.',
        backstory: 'A technical writer who believes good documentation is the bridge between developers and users.',
        capabilities: ['documentation', 'api_docs', 'tutorials'],
        tags: ['documentation', 'writing', 'api']
      },
      {
        id: 'test-engineer',
        name: 'Test Engineer',
        role: 'Quality Assurance Engineer',
        description: 'Designs and implements comprehensive test strategies.',
        goal: 'Ensure software quality through thorough testing strategies and test automation.',
        backstory: 'A QA engineer passionate about finding edge cases and ensuring software reliability.',
        capabilities: ['testing', 'test_automation', 'qa'],
        tags: ['testing', 'qa', 'automation']
      },
      {
        id: 'devops-engineer',
        name: 'DevOps Engineer',
        role: 'DevOps & Infrastructure Specialist',
        description: 'Expert in CI/CD, containerization, and cloud infrastructure.',
        goal: 'Streamline deployment processes and maintain reliable infrastructure.',
        backstory: 'A DevOps veteran who has scaled systems from startup to enterprise level.',
        capabilities: ['devops', 'ci_cd', 'infrastructure', 'cloud'],
        tags: ['devops', 'infrastructure', 'cloud']
      },
      {
        id: 'security-analyst',
        name: 'Security Analyst',
        role: 'Application Security Specialist',
        description: 'Identifies and mitigates security vulnerabilities.',
        goal: 'Protect applications from security threats through analysis and recommendations.',
        backstory: 'A former penetration tester who now helps teams build secure software from the ground up.',
        capabilities: ['security', 'vulnerability_assessment', 'penetration_testing'],
        tags: ['security', 'vulnerability', 'protection']
      },
      {
        id: 'data-analyst',
        name: 'Data Analyst',
        role: 'Data Analysis & Visualization Expert',
        description: 'Transforms data into actionable insights.',
        goal: 'Analyze data patterns and create meaningful visualizations and reports.',
        backstory: 'A data scientist who excels at finding stories hidden in complex datasets.',
        capabilities: ['data_analysis', 'visualization', 'reporting'],
        tags: ['data', 'analytics', 'visualization']
      },
      {
        id: 'notebook-agent',
        name: 'Notebook Agent',
        role: 'Notebook Agent',
        description: 'Data Scientist & Research Analyst with expertise in Python, statistical analysis, and data visualization.',
        goal: 'Transform raw data into actionable insights through interactive analysis, visualization, and comprehensive documentation.',
        backstory: 'A data scientist with a passion for making complex data accessible. Specializes in creating interactive notebooks that combine code, analysis, and visualizations. Believes that the best insights come from combining rigorous analysis with clear communication. Expert in pandas, numpy, matplotlib, and plotly.',
        capabilities: ['data_analysis', 'visualization', 'code_execution', 'research', 'statistical_analysis'],
        tags: ['notebook', 'data', 'analysis', 'visualization', 'python', 'jupyter']
      }
    ];

    res.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    next(error);
  }
});

export default router;


