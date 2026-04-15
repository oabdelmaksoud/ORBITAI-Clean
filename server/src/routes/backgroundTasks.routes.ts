/**
 * Background Tasks Routes
 * Handles background task execution when browser is closed
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { backgroundTaskService } from '../services/backgroundTaskService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const router = express.Router();

/**
 * POST /api/background-tasks/start
 * Start a background task (called when browser is about to close)
 * Supports token in Authorization header OR in request body (for sendBeacon compatibility)
 */
router.post('/start', async (req, res, next) => {
  try {
    // Support token in header (normal) or body (for sendBeacon)
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // Verify token manually (since sendBeacon can't send headers)
    let userId: string;
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; email: string; plan: string };
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const {
      projectId,
      taskId,
      agent,
      task,
      projectContext,
      artifacts,
      useInternet,
      mcpServers,
      standards
    } = req.body;

    // Remove token from body if it was there
    delete req.body.token;

    if (!projectId || !taskId || !agent || !task) {
      throw new AppError('projectId, taskId, agent, and task are required', 400);
    }

    // Verify project belongs to user
    const project = await Project.findOne({
      _id: projectId,
      userId: userId
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Verify task exists
    const taskExists = project.tasks?.some((t: any) => t.id === taskId);
    if (!taskExists) {
      throw new AppError('Task not found in project', 404);
    }

    // Start background task
    const backgroundTaskId = await backgroundTaskService.startBackgroundTask(
      projectId,
      userId,
      taskId,
      agent,
      task,
      projectContext || project.description || '',
      artifacts || [],
      useInternet || false,
      mcpServers || [],
      standards || []
    );

    logger.info(`User ${userId} started background task ${backgroundTaskId} for task ${taskId}`);

    res.json({
      success: true,
      data: {
        backgroundTaskId,
        message: 'Background task started. Will continue for up to 15 minutes.',
        maxDuration: 15 * 60 * 1000 // 15 minutes in milliseconds
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/background-tasks/stop
 * Stop a background task
 */
router.post('/stop/:backgroundTaskId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { backgroundTaskId } = req.params;

    // Verify task belongs to user
    const activeTasks = backgroundTaskService.getActiveTasks(req.user!.id);
    const task = activeTasks.find(t => t.id === backgroundTaskId);

    if (!task) {
      throw new AppError('Background task not found or access denied', 404);
    }

    await backgroundTaskService.stopBackgroundTask(backgroundTaskId, 'user');

    res.json({
      success: true,
      message: 'Background task stopped'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/background-tasks
 * Get active background tasks for current user
 */
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;

    const tasks = projectId
      ? backgroundTaskService.getActiveTasks(req.user!.id, projectId as string)
      : backgroundTaskService.getActiveTasks(req.user!.id);

    res.json({
      success: true,
      data: tasks.map(t => ({
        id: t.id,
        projectId: t.projectId,
        taskId: t.taskId,
        taskTitle: t.task.title,
        startedAt: t.startedAt,
        remainingTime: backgroundTaskService.getRemainingTime(t.id),
        maxDuration: 15 * 60 * 1000
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/background-tasks/:backgroundTaskId/status
 * Get status of a specific background task
 */
router.get('/:backgroundTaskId/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { backgroundTaskId } = req.params;

    const activeTasks = backgroundTaskService.getActiveTasks(req.user!.id);
    const task = activeTasks.find(t => t.id === backgroundTaskId);

    if (!task) {
      throw new AppError('Background task not found or access denied', 404);
    }

    const remainingTime = backgroundTaskService.getRemainingTime(backgroundTaskId);

    res.json({
      success: true,
      data: {
        id: task.id,
        projectId: task.projectId,
        taskId: task.taskId,
        taskTitle: task.task.title,
        startedAt: task.startedAt,
        remainingTime,
        maxDuration: 15 * 60 * 1000,
        isActive: true
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

