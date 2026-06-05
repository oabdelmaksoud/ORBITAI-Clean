import express from 'express';
import { authenticateToken, denyGuests, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { validate } from '../middleware/validate.js';
import { executeAgentTaskSchema } from '../validators/agent.validator.js';
import { agentExecutionEngine } from '../services/agentExecutionEngine.service.js';

const router = express.Router();

router.use(authenticateToken);

// Execute agent task - protected by agent_creation feature flag
router.post(
  '/execute',
  denyGuests,
  checkFeatureAccess('agent_creation'),
  validate(executeAgentTaskSchema),
  async (req: AuthRequest & FeatureRequest, res, next) => {
    try {
      const { projectId, agentId, taskId } = req.body;

      if (!projectId || !agentId || !taskId) {
        throw new AppError('Project ID, Agent ID, and Task ID are required', 400);
      }

      // Verify project belongs to user
      const project = await Project.findOne({
        _id: projectId,
        userId: req.user!.id,
      });

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      // Find the agent and task in the project
      const agent = project.agents?.find((a: any) => a.id === agentId);
      const task = project.tasks?.find((t: any) => t.id === taskId);

      if (!agent) {
        throw new AppError('Agent not found in project', 404);
      }

      if (!task) {
        throw new AppError('Task not found in project', 404);
      }

      // Multi-agent engine (dim 8): actually run the agent against the task via the LLM router
      // (previously this was a no-op that told the client to call another endpoint).
      logger.info(`[AgentEngine] Executing agent=${agentId} on task=${taskId}`);
      const runResult = await agentExecutionEngine.runAgent(
        {
          id: agent.id,
          role: agent.role,
          name: agent.name,
          goal: agent.goal,
          systemPrompt: agent.systemPrompt,
          preferredLLM: agent.preferredLLM,
          tools: agent.tools,
        },
        task.description || task.title,
        { userId: req.user!.id, projectId, taskId }
      );

      res.json({
        success: runResult.success,
        data: {
          output: runResult.output,
          modelUsed: runResult.modelUsed,
          error: runResult.error,
          agent: { id: agent.id, role: agent.role, name: agent.name },
          task: { id: task.id, title: task.title, status: task.status },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Run a sequence of agents as a pipeline (multi-agent orchestration — dim 8)
router.post(
  '/run-sequence',
  denyGuests,
  checkFeatureAccess('agent_creation'),
  async (req: AuthRequest & FeatureRequest, res, next) => {
    try {
      const { agents, task, projectId, taskId } = req.body;
      if (!Array.isArray(agents) || agents.length === 0 || !task) {
        throw new AppError('agents (non-empty array) and task are required', 400);
      }
      const result = await agentExecutionEngine.runSequence(agents, task, {
        userId: req.user!.id,
        projectId,
        taskId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Get agent status
router.get('/status/:agentId', async (req: AuthRequest, res, next) => {
  try {
    const { agentId } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      throw new AppError('Project ID is required', 400);
    }

    // Verify project belongs to user
    const project = await Project.findOne({
      _id: projectId,
      userId: req.user!.id,
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Find the agent in the project
    const agent = project.agents?.find((a: any) => a.id === agentId);

    if (!agent) {
      throw new AppError('Agent not found in project', 404);
    }

    // Find tasks assigned to this agent
    const agentTasks = project.tasks?.filter((t: any) => t.assignedTo === agent.role) || [];
    const activeTasks = agentTasks.filter((t: any) => t.status === 'In Progress');
    const completedTasks = agentTasks.filter((t: any) => t.status === 'Completed');

    res.json({
      success: true,
      data: {
        agentId: agent.id,
        agent: {
          id: agent.id,
          role: agent.role,
          name: agent.name,
          description: agent.description,
        },
        status: activeTasks.length > 0 ? 'active' : 'idle',
        lastActivity: project.lastModified || project.createdAt,
        tasks: {
          total: agentTasks.length,
          active: activeTasks.length,
          completed: completedTasks.length,
          pending: agentTasks.filter((t: any) => t.status === 'Pending').length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
