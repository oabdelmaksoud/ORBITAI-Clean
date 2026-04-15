import express, { Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { CustomAgent, ICustomAgent } from '../models/CustomAgent.model.js';
// @ts-ignore
import { paginationSchema } from '../validation/schemas.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/company/agents
 * Get all agents for a company/user with hierarchy information
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - includeInactive: Include inactive agents (default: false)
 * - populateReportsTo: Populate reportsTo field with agent details (default: true)
 */
router.get('/agents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const includeInactive = req.query.includeInactive === 'true';
    const populateReportsTo = req.query.populateReportsTo !== 'false'; // Default to true

    // Build query
    const query: any = {
      userId: req.user!.id,
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    // Execute query with pagination
    let agentsQuery = CustomAgent.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Populate reportsTo if requested
    if (populateReportsTo) {
      agentsQuery = agentsQuery.populate('reportsTo', 'name title role avatar');
    }

    const agents = await agentsQuery.exec();
    const total = await CustomAgent.countDocuments(query);

    // Transform agents to include hierarchy information
    const agentsWithHierarchy = agents.map((agent: ICustomAgent) => {
      const agentObj = agent.toObject();

      // Add hierarchy level (computed field)
      // This is a simplified version - in production, you might want to compute this recursively
      const hierarchyLevel = agent.reportsTo ? 1 : 0;

      return {
        ...agentObj,
        hierarchy: {
          level: hierarchyLevel,
          reportsTo: agent.reportsTo || null,
          hasReports: false, // Will be computed below
        },
      };
    });

    // Check which agents have reports (agents that are being reported to)
    const agentIds = agents.map(a => a._id);
    const agentsWithReports = await CustomAgent.find({
      reportsTo: { $in: agentIds },
    }).distinct('reportsTo');

    const agentsWithReportsSet = new Set(agentsWithReports.map(id => id.toString()));

    // Update hasReports field
    const finalAgents = agentsWithHierarchy.map(agent => ({
      ...agent,
      hierarchy: {
        ...agent.hierarchy,
        hasReports: agentsWithReportsSet.has(agent._id.toString()),
      },
    }));

    logger.info(`Retrieved ${agents.length} agents for user ${req.user!.id}`);

    res.json({
      success: true,
      data: {
        agents: finalAgents,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/company/agents/:id
 * Get a single agent with full hierarchy details
 */
router.get('/agents/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const agent = await CustomAgent.findOne({
      _id: id,
      userId: req.user!.id,
    }).populate('reportsTo', 'name title role avatar');

    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    // Get direct reports
    const directReports = await CustomAgent.find({
      reportsTo: agent._id,
      userId: req.user!.id,
    }).select('name title role avatar');

    // Get reporting chain (all agents above this one)
    const reportingChain: ICustomAgent[] = [];
    let currentAgent: ICustomAgent | null = agent;

    while (currentAgent?.reportsTo) {
      const supervisor: any = await CustomAgent.findById(currentAgent.reportsTo).select(
        'name title role avatar reportsTo'
      );

      if (supervisor) {
        reportingChain.push(supervisor);
        currentAgent = supervisor;
      } else {
        break;
      }
    }

    const agentObj = agent.toObject();

    res.json({
      success: true,
      data: {
        ...agentObj,
        hierarchy: {
          reportsTo: agent.reportsTo || null,
          directReports,
          reportingChain: reportingChain.reverse(),
          level: reportingChain.length,
        },
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/company/agents/hierarchy
 * Get the full agent hierarchy tree
 */
router.get(
  '/agents/hierarchy/tree',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Get all agents for this user
      const agents = await CustomAgent.find({
        userId: req.user!.id,
        isActive: true,
      })
        .select('name title role avatar reportsTo')
        .sort({ name: 1 });

      // Build hierarchy tree
      const agentMap = new Map<string, any>();
      const rootAgents: any[] = [];

      // First pass: create map of all agents
      agents.forEach(agent => {
        agentMap.set(agent._id.toString(), {
          ...agent.toObject(),
          reports: [],
        });
      });

      // Second pass: build tree structure
      agents.forEach(agent => {
        const agentNode = agentMap.get(agent._id.toString());

        if (agent.reportsTo) {
          const parent = agentMap.get(agent.reportsTo.toString());
          if (parent) {
            parent.reports.push(agentNode);
          } else {
            // Parent not found, treat as root
            rootAgents.push(agentNode);
          }
        } else {
          // No reportsTo, this is a root agent
          rootAgents.push(agentNode);
        }
      });

      res.json({
        success: true,
        data: {
          hierarchy: rootAgents,
          totalAgents: agents.length,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

export default router;
