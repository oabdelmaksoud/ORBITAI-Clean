/**
 * Background AutoPilot Routes
 * Handles HAND-OFF AI execution in the background when browser is closed
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { backgroundAutoPilotService } from '../services/backgroundAutoPilotService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const router = express.Router();

/**
 * POST /api/background-autopilot/start
 * Start HAND-OFF AI in background (called when browser is about to close)
 * Supports token in Authorization header OR in request body (for sendBeacon compatibility)
 */
router.post('/start', async (req, res, next) => {
  try {
    // Support token in header (normal) or body (for sendBeacon)
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
      return;
    }

    // Verify token manually (since sendBeacon can't send headers)
    let userId: string;
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; email: string; plan: string };
      userId = decoded.userId;
    } catch (error: unknown) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    const {
      projectId,
      projectContext,
      artifacts,
      agents,
      useInternet,
      mcpServers,
      standards,
      currentPhase,
      currentSprint
    } = req.body;

    // Remove token from body if it was there
    delete req.body.token;

    if (!projectId || !agents || !Array.isArray(agents)) {
      throw new AppError('projectId, agents (array) are required', 400);
    }

    // Verify project belongs to user
    const project = await Project.findOne({
      _id: projectId,
      userId: userId
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Start background AutoPilot
    const autoPilotId = await backgroundAutoPilotService.startBackgroundAutoPilot(
      projectId,
      userId,
      projectContext || project.description || '',
      artifacts || [],
      agents,
      useInternet || false,
      mcpServers || [],
      standards || [],
      currentPhase || project.currentPhase || 'Planning',
      currentSprint || project.currentSprint || 1
    );

    logger.info(`User ${userId} started background AutoPilot ${autoPilotId} for project ${projectId}`);

    res.json({
      success: true,
      data: {
        autoPilotId,
        message: 'HAND-OFF AI started in background. Will continue for up to 15 minutes.',
        maxDuration: 15 * 60 * 1000 // 15 minutes in milliseconds
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/background-autopilot/stop
 * Stop HAND-OFF AI background execution
 */
router.post('/stop/:autoPilotId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { autoPilotId } = req.params;

    // Verify AutoPilot belongs to user
    const activeAutoPilots = backgroundAutoPilotService.getActiveAutoPilots(req.user!.id);
    const autoPilot = activeAutoPilots.find(ap => ap.id === autoPilotId);

    if (!autoPilot) {
      throw new AppError('Background AutoPilot not found or access denied', 404);
    }

    await backgroundAutoPilotService.stopBackgroundAutoPilot(autoPilotId, 'user');

    res.json({
      success: true,
      message: 'HAND-OFF AI stopped'
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/background-autopilot
 * Get active HAND-OFF AI jobs for current user
 */
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;

    const autoPilots = projectId
      ? backgroundAutoPilotService.getActiveAutoPilots(req.user!.id, projectId as string)
      : backgroundAutoPilotService.getActiveAutoPilots(req.user!.id);

    res.json({
      success: true,
      data: autoPilots.map(ap => ({
        id: ap.id,
        projectId: ap.projectId,
        currentPhase: ap.currentPhase,
        currentSprint: ap.currentSprint,
        startedAt: ap.startedAt,
        lastTaskExecutedAt: ap.lastTaskExecutedAt,
        remainingTime: backgroundAutoPilotService.getRemainingTime(ap.id),
        maxDuration: 15 * 60 * 1000
      }))
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/background-autopilot/:autoPilotId/status
 * Get status of a specific HAND-OFF AI job
 */
router.get('/:autoPilotId/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { autoPilotId } = req.params;

    const activeAutoPilots = backgroundAutoPilotService.getActiveAutoPilots(req.user!.id);
    const autoPilot = activeAutoPilots.find(ap => ap.id === autoPilotId);

    if (!autoPilot) {
      throw new AppError('Background AutoPilot not found or access denied', 404);
    }

    const remainingTime = backgroundAutoPilotService.getRemainingTime(autoPilotId);

    res.json({
      success: true,
      data: {
        id: autoPilot.id,
        projectId: autoPilot.projectId,
        currentPhase: autoPilot.currentPhase,
        currentSprint: autoPilot.currentSprint,
        startedAt: autoPilot.startedAt,
        lastTaskExecutedAt: autoPilot.lastTaskExecutedAt,
        remainingTime,
        maxDuration: 15 * 60 * 1000,
        isRunning: autoPilot.isRunning
      }
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;













