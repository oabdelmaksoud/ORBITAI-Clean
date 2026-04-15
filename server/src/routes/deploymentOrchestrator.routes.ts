/**
 * Deployment Orchestration Routes
 * Endpoints for deploying generated code to production
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import {
  deploymentOrchestratorService,
  DeploymentConfig,
  DeploymentResult as _DeploymentResult,
} from '../services/deploymentOrchestrator.service.js';
import { Project } from '../models/Project.model.js';
import { Artifact } from '../models/Artifact.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { webSocketService } from '../services/websocket.service.js';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticateToken);

/**
 * POST /api/deployments/orchestrate
 * Orchestrate deployment of generated code to production
 */
router.post(
  '/orchestrate',
  checkFeatureAccess('deployment'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId, codeArtifactId, platform, environment, customDomain, envVars } = req.body;

      // Validate input
      if (!projectId) throw new AppError('Project ID is required', 400);
      if (!codeArtifactId) throw new AppError('Code artifact ID is required', 400);
      if (!platform) throw new AppError('Platform is required', 400);

      // Fetch project
      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      logger.info(`🚀 Orchestrating deployment for project: ${project.name} → ${platform}`);

      // Emit progress update
      (webSocketService as any).broadcast(userId, {
        type: 'deployment_started',
        projectId,
        platform,
        message: 'Orchestrating deployment...',
      });

      // Create deployment config
      const deploymentConfig: DeploymentConfig = {
        projectId,
        projectName: project.name,
        codeArtifactId,
        platform: platform as any,
        environment: environment || 'production',
        customDomain,
        envVars: envVars || {},
      };

      // Execute deployment orchestration
      const result = await deploymentOrchestratorService.orchestrateDeployment(deploymentConfig);

      if (result.status === 'failed') {
        (webSocketService as any).broadcast(userId, {
          type: 'deployment_failed',
          projectId,
          error: result.error,
        });

        throw new AppError(`Deployment failed: ${result.error}`, 400);
      }

      // Store deployment record
      const deploymentArtifact = new Artifact({
        projectId,
        title: `Deployment: ${platform} - ${result.liveUrl}`,
        type: 'deployment',
        content: JSON.stringify({
          deploymentId: result.deploymentId,
          platform,
          liveUrl: result.liveUrl,
          repositoryUrl: result.repositoryUrl,
          status: result.status,
          logs: result.logs,
          metadata: result.metadata,
          deployedAt: result.deployedAt,
        }),
        createdBy: 'Deployment Agent',
        phase: 'Release Prep',
      });

      await deploymentArtifact.save();

      // Update project
      project.artifacts.push(deploymentArtifact._id);
      project.status = 'deployed';
      (project as any).deploymentUrl = result.liveUrl;
      project.lastModified = new Date();
      await project.save();

      (webSocketService as any).broadcast(userId, {
        type: 'deployment_complete',
        projectId,
        liveUrl: result.liveUrl,
        repositoryUrl: result.repositoryUrl,
        platform,
        message: `✅ Deployed to ${platform}: ${result.liveUrl}`,
      });

      logger.info(`✅ Deployment complete: ${result.liveUrl}`);

      res.json({
        success: true,
        data: {
          deploymentId: result.deploymentId,
          liveUrl: result.liveUrl,
          repositoryUrl: result.repositoryUrl,
          platform,
          status: result.status,
          logs: result.logs,
          estimatedMonthlyCost: result.estimatedCost,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/deployments/status/:deploymentId
 * Get deployment status
 */
router.get('/status/:deploymentId', async (req: AuthRequest, res: Response, next) => {
  try {
    // const _userId = req.user!.id;
    const { deploymentId } = req.params;

    // Fetch deployment artifact
    const artifact = await Artifact.findOne({
      _id: deploymentId,
      type: 'deployment',
    });

    if (!artifact) throw new AppError('Deployment not found', 404);

    const deployment = JSON.parse(artifact.content);

    res.json({
      success: true,
      data: {
        deploymentId: deployment.deploymentId,
        status: deployment.status,
        liveUrl: deployment.liveUrl,
        platform: deployment.platform,
        deployedAt: deployment.deployedAt,
        logs: deployment.logs,
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/deployments/health/:deploymentId
 * Check deployed application health
 */
router.get('/health/:deploymentId', async (req: AuthRequest, res: Response, next) => {
  try {
    const { deploymentId } = req.params;

    // Fetch deployment details
    const artifact = await Artifact.findOne({
      _id: deploymentId,
      type: 'deployment',
    });

    if (!artifact) throw new AppError('Deployment not found', 404);

    const deployment = JSON.parse(artifact.content);

    // Check health endpoint
    const healthUrl = `${deployment.liveUrl}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    let healthData = { status: 'unknown' };
    if (response.ok) {
      healthData = (await response.json()) as any;
    }

    res.json({
      success: true,
      data: {
        deploymentId,
        liveUrl: deployment.liveUrl,
        platform: deployment.platform,
        healthStatus: response.ok ? 'healthy' : 'unhealthy',
        healthData,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/deployments/redeploy/:projectId
 * Redeploy a project to production
 */
router.post(
  '/redeploy/:projectId',
  checkFeatureAccess('deployment'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;

      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      // Get latest code artifact
      const codeArtifact = await Artifact.findOne({
        projectId,
        type: 'code',
      }).sort({ createdAt: -1 });

      if (!codeArtifact) throw new AppError('No generated code found', 404);

      logger.info(`🔄 Redeploying project: ${project.name}`);

      (webSocketService as any).broadcast(userId, {
        type: 'redeployment_started',
        projectId,
        message: 'Redeploying to production...',
      });

      // Get latest deployment
      const latestDeployment = await Artifact.findOne({
        projectId,
        type: 'deployment',
      }).sort({ createdAt: -1 });

      const platform = latestDeployment ? JSON.parse(latestDeployment.content).platform : 'vercel';

      // Orchestrate redeployment
      const result = await deploymentOrchestratorService.orchestrateDeployment({
        projectId,
        projectName: project.name,
        codeArtifactId: codeArtifact._id.toString(),
        platform: platform as any,
        environment: 'production',
      });

      if (result.status === 'failed') {
        throw new AppError(`Redeployment failed: ${result.error}`, 400);
      }

      (webSocketService as any).broadcast(userId, {
        type: 'redeployment_complete',
        projectId,
        liveUrl: result.liveUrl,
      });

      res.json({
        success: true,
        data: {
          deploymentId: result.deploymentId,
          liveUrl: result.liveUrl,
          status: result.status,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/deployments/platforms
 * Get list of supported deployment platforms
 */
router.get('/platforms', async (_req: AuthRequest, res: Response, next) => {
  try {
    const platforms = [
      {
        name: 'vercel',
        displayName: 'Vercel',
        description: 'Global edge network deployment',
        features: ['Auto-scaling', 'Global CDN', 'GitHub integration', 'Free tier'],
        regions: ['Global'],
        startingPrice: 0,
        popularityScore: 95,
        setupTime: '< 2 minutes',
        bestFor: 'Web apps, APIs, NextJS projects',
      },
      {
        name: 'railway',
        displayName: 'Railway',
        description: 'Modern cloud hosting platform',
        features: [
          'GitHub integration',
          'Auto-deploy',
          'Database hosting',
          'Environment variables',
        ],
        regions: ['us-west', 'us-east', 'eu-central'],
        startingPrice: 5,
        popularityScore: 85,
        setupTime: '< 3 minutes',
        bestFor: 'Full-stack apps, PostgreSQL databases',
      },
      {
        name: 'aws',
        displayName: 'AWS Elastic Beanstalk',
        description: 'Enterprise cloud infrastructure',
        features: ['Auto-scaling', 'High availability', 'Load balancing', 'Database options'],
        regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
        startingPrice: 15,
        popularityScore: 90,
        setupTime: '< 5 minutes',
        bestFor: 'Enterprise applications, high traffic',
      },
      {
        name: 'gcp',
        displayName: 'Google Cloud Run',
        description: 'Serverless container platform',
        features: ['Serverless', 'Auto-scaling', 'Pay-per-use', 'Container native'],
        regions: ['us-central1', 'europe-west1', 'asia-northeast1'],
        startingPrice: 10,
        popularityScore: 80,
        setupTime: '< 4 minutes',
        bestFor: 'Containerized apps, serverless workloads',
      },
      {
        name: 'render',
        displayName: 'Render',
        description: 'Modern full-stack cloud platform',
        features: ['GitHub sync', 'Auto-deploy', 'Database hosting', 'Background workers'],
        regions: ['oregon', 'frankfurt', 'singapore'],
        startingPrice: 7,
        popularityScore: 75,
        setupTime: '< 3 minutes',
        bestFor: 'Web apps, databases, background jobs',
      },
    ];

    res.json({
      success: true,
      data: {
        platforms,
        totalCount: platforms.length,
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * Helper methods
 */

// function _mergeEnvVars(project: any, customVars?: Record<string, string>): Record<string, string> {
//   const baseVars: Record<string, string> = {
//     NODE_ENV: 'production',
//     LOG_LEVEL: 'info',
//   };
//
//   // Add any project-specific vars
//   if (project.environmentVariables) {
//     Object.assign(baseVars, project.environmentVariables);
//   }
//
//   // Override with custom vars
//   if (customVars) {
//     Object.assign(baseVars, customVars);
//   }
//
//   return baseVars;
// }

export const deploymentRoutes = router;
