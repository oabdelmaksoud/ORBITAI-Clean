import express from 'express';
import { authenticateToken, denyGuests, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { validate } from '../middleware/validate.js';
import { executeAgentTaskSchema } from '../validators/agent.validator.js';

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

      // Forward to the actual execution endpoint
      // This route is a convenience wrapper that forwards to /api/gemini/execute-task
      logger.info(`Agent route forwarding execution: agent=${agentId}, task=${taskId}`);

      // Return success - actual execution happens via /api/gemini/execute-task
      // The frontend should call that endpoint directly for full functionality
      res.json({
        success: true,
        data: {
          message: 'Agent task execution should be performed via /api/gemini/execute-task endpoint',
          taskId,
          agentId,
          agent: {
            id: agent.id,
            role: agent.role,
            name: agent.name,
          },
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
          },
          redirect: {
            endpoint: '/api/gemini/execute-task',
            method: 'POST',
            note: 'Use this endpoint for actual task execution with full features',
          },
        },
      });
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
