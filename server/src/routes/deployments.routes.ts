import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { Deployment } from '../models/Deployment.model.js';
import { Project } from '../models/Project.model.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { checkFeatureAccess } from '../middleware/featureCheck.js';
import { webSocketService } from '../services/websocket.service.js';
import { deploymentService } from '../services/deployment.service.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);
router.use(rateLimiter);

/**
 * GET /api/deployments
 * Get deployments for a project or user
 */
router.get('/', checkFeatureAccess('cloud_deployment'), async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;
    const userId = req.user?.id || '';

    const query: any = { userId };
    if (projectId) {
      query.projectId = projectId;
    }

    const deployments = await Deployment.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      deployments,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/deployments
 * Create a new deployment (supports single or multiple projects)
 */
router.post('/', checkFeatureAccess('cloud_deployment'), async (req: AuthRequest, res, next) => {
  try {
    const { projectId, projectIds, platform, environment } = req.body;
    const userId = req.user?.id || '';

    // Support both single projectId and multiple projectIds
    const projectsToDeploy = projectIds || (projectId ? [projectId] : []);

    if (projectsToDeploy.length === 0 || !platform || !environment) {
      return res.status(400).json({
        success: false,
        error: 'projectId(s), platform, and environment are required'
      });
    }

    // Verify all projects exist and user has access
    const projects = await Project.find({
      _id: { $in: projectsToDeploy },
      userId: userId
    });

    if (projects.length !== projectsToDeploy.length) {
      return res.status(403).json({
        success: false,
        error: 'Some projects not found or access denied'
      });
    }

    // Create deployments for all projects
    const deployments = await Promise.all(
      projects.map(project =>
        Deployment.create({
          projectId: project._id.toString(),
          userId,
          projectName: project.name || 'Untitled Project',
          platform,
          environment,
          status: 'pending',
          logs: [],
        })
      )
    );

    // Emit WebSocket events and start deployments
    deployments.forEach(deployment => {
      webSocketService.broadcastToRoom(`deployment:${deployment._id}`, {
        type: 'deployment.created',
        deployment: {
          id: deployment._id.toString(),
          projectId: deployment.projectId,
          platform: deployment.platform,
          status: deployment.status,
          environment: deployment.environment,
        }
      });

      // Start deployment process (async)
      startDeployment(deployment._id.toString()).catch(err => {
        logger.error(`Failed to start deployment ${deployment._id}:`, err);
      });
    });

    logger.info(`Created ${deployments.length} deployment(s) for ${projectsToDeploy.length} project(s)`);

    res.json({
      success: true,
      deployments: deployments.length === 1 ? deployments[0] : deployments,
      count: deployments.length,
    });
  } catch (error: any) {
    logger.error('Failed to create deployment:', error);
    next(error);
  }
});

/**
 * GET /api/deployments/:id
 * Get deployment details
 */
router.get('/:id', checkFeatureAccess('cloud_deployment'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || '';

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      deployment,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/deployments/:id/stop
 * Stop a deployment
 */
router.post('/:id/stop', checkFeatureAccess('cloud_deployment'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || '';

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (deployment.status !== 'deploying' && deployment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Deployment cannot be stopped in current status'
      });
    }

    deployment.status = 'stopped';
    deployment.completedAt = new Date();
    await deployment.save();

    logger.info(`Stopped deployment ${id}`);

    res.json({
      success: true,
      message: 'Deployment stopped',
      deployment,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/deployments/:id/logs
 * Get deployment logs
 */
router.get('/:id/logs', checkFeatureAccess('cloud_deployment'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || '';

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      logs: deployment.logs || [],
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * Start deployment process (real deployment service)
 */
async function startDeployment(deploymentId: string): Promise<void> {
  try {
    const deployment = await Deployment.findById(deploymentId);
    if (!deployment) return;

    deployment.status = 'deploying';
    deployment.startedAt = new Date();
    const startLog = `[${new Date().toISOString()}] Starting deployment to ${deployment.platform}...`;
    deployment.logs.push(startLog);
    await deployment.save();

    // Emit WebSocket event for status change
    webSocketService.broadcastToRoom(`deployment:${deploymentId}`, {
      type: 'deployment.status',
      deploymentId,
      status: 'deploying',
      log: startLog
    });

    // Use real deployment service
    try {
      const deploymentResult = await deploymentService.deployProject(
        deployment.projectId,
        {
          platform: deployment.platform as any,
          environment: deployment.environment as any,
          envVars: deployment.envVars || {}
        }
      );

      // Update deployment with results
      deployment.status = deploymentResult.success ? 'success' : 'failed';
      deployment.completedAt = new Date();
      deployment.url = deploymentResult.url;
      deployment.error = deploymentResult.error;
      deployment.logs.push(...deploymentResult.logs);

      await deployment.save();
      logger.info(`Deployment ${deploymentId} completed with status: ${deployment.status}`);

      // Emit final WebSocket event
      webSocketService.broadcastToRoom(`deployment:${deploymentId}`, {
        type: 'deployment.completed',
        deploymentId,
        status: deployment.status,
        url: deployment.url,
        error: deployment.error,
        logs: deployment.logs
      });
    } catch (deployError: any) {
      // Deployment service error
      deployment.status = 'failed';
      deployment.completedAt = new Date();
      deployment.error = deployError.message || 'Deployment failed';
      deployment.logs.push(`[${new Date().toISOString()}] Error: ${deployment.error}`);
      await deployment.save();

      webSocketService.broadcastToRoom(`deployment:${deploymentId}`, {
        type: 'deployment.completed',
        deploymentId,
        status: 'failed',
        error: deployment.error,
        logs: deployment.logs
      });
    }
  } catch (error: any) {
    logger.error(`Failed to start deployment ${deploymentId}:`, error);
  }
}

export default router;

